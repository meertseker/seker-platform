# GÖREV — AnaOkulCRM Gerçek Üretim Seed'i (WhatsApp leadleri + yıllık Excel öğrenci/ödeme kayıtları)

> Bu bir uygulama görevidir. Aşağıdaki her şeyi eksiksiz uygula. Belirsizlik olursa **uydurma**; ilgili adımda tarif edilen "insan onay checkpoint"inde dur ve sor. Bu veri **üretime** gidecek gerçek okul verisidir.

---

## 0. Bağlam

`anaokulcrm/` — tek bir anaokulu için Next.js + Supabase CRM. İki rol: `yonetici` (kurucu), `danisman`. Veli adayı (lead) → randevu → teklif → öğrenci → ödeme akışı var. Şema hazır ve **doğru**; migration'lar `anaokulcrm/supabase/migrations/0001_schema.sql`, `0002_offer_lead_guards.sql`, `0003_domain_uyum.sql`.

**Şu anki problem:** Mevcut seed, WhatsApp'tan gelen tüm bilgiyi tek bir serbest-metin `note` alanına gömmüş; ~3089 anlamsız lead, 0 gerçek öğrenci, 0 ödeme planı. Yapısal alanlar (durum, çocuk, kaynak, aile, öğrenci, ödeme) boş. Uygulama bu yüzden "anlamsız" görünüyor.

**Amaç:** İki gerçek kaynaktan, tamamen **yapısal** (her bilgi kendi sütununda, note'a gömülmeden) bir üretim seed'i üret ve yükle:

1. **Leadler (veli adayı hunisi)** → WhatsApp analiz dosyalarından (gerçek).
2. **Öğrenciler + ödeme planları** → yıllara göre tutulan **Excel dosyalarından** (gerçek — insan sağlayacak).
3. İkisini telefon + isimle **birbirine bağla** (lead → öğrenciye dönüşüm).

---

## 1. KESİN KURALLAR (ihlal etme)

1. **Hiçbir bilgiyi `note`/`lead_notes`'a gömme.** İsim, telefon, çocuk, doğum, kaynak, durum, referans, aşama → hepsi kendi **yapısal sütununda**. `lead_notes` yalnızca gerçekten serbest, kısa insan yorumu içindir (ör. "akşam aranmak istiyor").
2. **Ödeme verisini UYDURMA.** Tutarlar, ödenen aylar, taksitler yalnızca Excel'deki gerçek rakamlardan gelir. Excel'de yoksa o öğrenci için ödeme planı **oluşturma**.
3. **Öğrenciyi UYDURMA.** Öğrenciler yalnızca Excel'den gelir. WhatsApp'ta "kayıt oldu" görünse bile Excel'de yoksa lead olarak kalır (bkz. Adım 6).
4. **Telefonu normalize et** — her yerde `anaokulcrm/lib/phone.ts` içindeki `normalizeTurkishPhone` ile E.164 (`+90...`). Eşleştirme normalize telefon üzerinden yapılır.
5. **Idempotent ol.** Script iki kez çalışınca mükerrer satır oluşmamalı (doğal anahtar: lead=telefon, öğrenci=telefon+full_name+season, aile=phone/family_code). Mevcut `upload.ts` deseni ve `events.seed_import` işaretini kullan/genişlet.
6. **Şema kısıtlarına harfiyen uy** (Bölüm 2). Enum dışı değer, zorunlu alan boş, `paid_fields` ihlali = hata; böyle satırı yazma, atla ve raporla.
7. **Üretim güvenliği:** Yükleme yalnızca `--dry-run` ile önizlendikten ve insan onayından sonra gerçek çalışır. Asla otomatik prod'a basma.
8. **Silme değil, statü.** Ölü/isimsiz eski leadleri silme; doğru terminal duruma çek (`kaybedildi`+sebep veya `beklemede`).

---

## 2. HEDEF ŞEMA (birebir — enum değerleri dahil)

Yalnızca aşağıdaki tablo/enum'lara yaz. Kaynak: `0001_schema.sql` + `0003_domain_uyum.sql`.

### `families` (aile / kardeş grubu)
`id`, `family_code` (text, unique, zorunlu — ör. `AILE-0001`), `primary_parent_name` (zorunlu), `phone`, `discount_type` ∈ {`yok`,`yuzde_10`,`ozel`} (default `yok`), `discount_note`.

### `leads`
- `parent_name` (zorunlu — bilinmiyorsa `"İsimsiz"`), `phone` (zorunlu, E.164), `child_name`, `child_birth_month` (1–12), `child_birth_year` (2010–2035).
- `source` ∈ {`referans`,`instagram`,`reklam`,`tabela_gecerken`,`telefon`,`etkinlik`,`diger`} (zorunlu).
- `source_detail` (referansta "kim getirdi", etkinlikte etkinlik adı vb.).
- `status` ∈ {`yeni`,`ulasildi`,`randevu`,`gorusme_yapildi`,`teklif`,`beklemede`,`kazanildi`,`kaybedildi`}.
- `lost_reason` ∈ {`fiyat`,`uzaklik`,`baska_okul`,`ulasilamadi`,`vazgecti`,`diger`} — **`status='kaybedildi'` ise zorunlu**.
- `assigned_to` (profiles.id — WhatsApp `sender`'ından eşle, Bölüm 5.6).
- `converted_student_id` (öğrenciye dönüştüyse students.id).
- Yeni bayraklar: `ingilizce_gerekli` (bool), `ozel_durum` (bool), `ozel_durum_note`, `wants_summer` (bool), `beklemede_sezon` (text), `family_id`.
- `last_activity_at` — WhatsApp'taki son temas tarihi.

### `appointments`
`lead_id` (zorunlu), `scheduled_at` (zorunlu), `type` ∈ {`okul_ziyareti`,`telefon`,`demo`,`oryantasyon`}, `outcome` ∈ {`bekliyor`,`geldi`,`gelmedi`,`ertelendi`,`iptal`}, `outcome_note`, `created_by` (profiles.id, zorunlu).

### `students`
`full_name` (çocuk adı, zorunlu), `birth_month`, `birth_year`, `parent_name` (zorunlu), `phone` (zorunlu), `season` (text, zorunlu — ör. `2024-2025`), `program` ∈ {`tam_gun`,`yarim_gun`,`uc_gun`,`play_grup`} (zorunlu), `start_date`, `status` ∈ {`aktif`,`ayrildi`,`mezun`}, `left_date`, `leave_reason`, `family_id`.

### `payment_plans`
`student_id` (zorunlu), `season` (zorunlu), `item_type` ∈ {`aidat`,`kayit_ucreti`,`servis`,`yemek`,`diger`}, `total_amount` (>0), `installment_count` (1–12), `source_offer_id` (opsiyonel).

### `installments`
`plan_id` (zorunlu), `due_date` (zorunlu), `amount` (>0), `status` ∈ {`bekliyor`,`odendi`,`iptal`}.
**`paid_fields` kısıtı:** `odendi` ise `paid_at`, `paid_amount`(>0), `payment_method` ∈ {`havale`,`nakit`,`pos`,`diger`}, `marked_by`(profiles.id) **hepsi dolu** olmalı; `bekliyor`/`iptal` ise **hepsi null**.

### `refunds` (yalnız ayrılan öğrenci iadesi varsa)
`student_id` (zorunlu), `amount` (>0), `method` ∈ {`havale`,`nakit`,`pos`,`diger`}, `refund_date` (zorunlu), `note`, `created_by` (profiles.id, zorunlu).

### `events` (append-only log)
Her yüklenen kök varlık için bir `seed_import` event yaz: `entity_type` ∈ {`lead`,`offer`,`student`,`installment`,`appointment`,`price_list`,`family`,`refund`}, `entity_id`, `event_type='seed_import'`, `actor_id`.

### Referans (yazma, kullan): `profiles`, `price_lists`, `price_list_items`
Programlar ve aktif sezon fiyatları burada. Excel'de ücret yoksa çapraz kontrol için kullanılabilir. Gerçek personel profilleri (Bölüm 5.6) prod'da mevcut olmalı.

---

## 3. VERİ KAYNAKLARI

### A. WhatsApp analizi (leadler) — `analysis/`
- **`analysis/lead_analysis.json`** — 474 kayıt, ana kaynak. Her kayıt:
  `phone`, `name` (çıkarılmış veli adı, kısmen dolu), `date` (ilk temas), `sender` (personel), `intro` (zengin serbest metin: veli/çocuk adı, doğum, kaynak, referans, talep, aşama anlatısı), `intro_resolved`, `waiting_info`, `n_occurrences`, `occurrence_dates` (zaman çizelgesi), `followups` (telefonla eşleşen sonraki mesajlar).
- Destekleyici: `analysis/refined.json`, `analysis/final.json` (aynı 474 evren, ek sinyaller), `analysis/person_report.txt` (personel istatistikleri).
- `intro` metni çoğu velide **tüm yolculuğu** anlatır (örnek: "2020 Ekim doğumlu → kayıt için bilgi bekliyor → telefonda görüşüldü → görüşmeye geldiler, Gözde görüştü → Eylül düşünüyorlar → deneme dersine davet edildi"). Bu prozadan yapısal alan çıkaracaksın (Bölüm 5).

### B. Yıllık Excel dosyaları (öğrenci + ödeme) — **insan sağlayacak**
- Yıllara göre birden çok Excel (ör. `2023-2024`, `2024-2025`, `2025-2026`...). **Yapısı önceden bilinmiyor.**
- Bu yüzden **Adım 1 = keşif**: dosyaları aç, sayfa/sütun yapısını çıkar, hangi sütunun neye karşılık geldiğini (öğrenci adı, veli, telefon, program, aylık ücret, ödenen aylar/tutar, kayıt ücreti, servis/yemek, kardeş, ayrılış) bir **eşleme tablosu** olarak yaz ve **insan onayına sun**. Onaysız yükleme yapma.

---

## 4. PIPELINE (adım adım)

Her parça tek işi olan ayrı bir script olsun (`anaokulcrm/scripts/seed/` altında). Mevcut `upload.ts`, `parse-whatsapp.ts`, `parse-excel.ts`, `lib/csv.ts` desenini izle/genişlet.

**Adım 0 — Ortam & referans doğrula.** `.env.local` (SUPABASE_URL, SERVICE_ROLE_KEY). Gerçek personel profilleri ve aktif fiyat listesi var mı kontrol et.

**Adım 1 — Excel keşfi (CHECKPOINT).** Tüm Excel'leri oku, sütun→alan eşleme tablosu üret, insana göster, onay al.

**Adım 2 — Lead çıkarımı.** `lead_analysis.json`'daki 474 kaydı, `intro`+`followups` metnini okuyarak Bölüm 5 kurallarıyla yapısal JSON'a çıkar → `out/leads.json`. (LLM çıkarımı; telefon/doğum için deterministik normalizasyon geçişi ekle.)

**Adım 3 — Aile/kardeş tespiti.** Aynı normalize telefon ya da aynı veli + "ikiz/2 çocuk" sinyali → tek `families` satırı, ilgili lead/öğrencilere `family_id`. İndirim `yok` başlar (gerçeği Excel/anne verirse güncelle).

**Adım 4 — Randevu türetme.** `intro`/`followups`'ta "görüşmeye geldi / deneme dersi / oryantasyon / okul gezisi" geçen leadlere gerçek `appointments` satırı (doğru `type` + tarih + `outcome`).

**Adım 5 — Excel → öğrenci/ödeme.** Onaylı eşlemeyle her Excel satırını `students` + `payment_plans` + `installments`'a çevir (Bölüm 6). Ayrılanlara `status='ayrildi'`, `left_date`, gerekiyorsa `refunds`.

**Adım 6 — Reconciliation (lead ↔ öğrenci).** Öğrenciyi normalize telefon (yoksa isim benzerliği) ile lead'e bağla: eşleşen lead `status='kazanildi'`, `converted_student_id=<öğrenci>`, `family_id` paylaş. Öğrencinin lead'i yoksa minimal bir "kazanildi" lead oluştur (kaynak `diger`) ki huni tutarlı olsun. Çift eşleşmeleri raporla.

**Adım 7 — Ölü lead statüsü.** Öğrenciye dönüşmemiş, isimsiz/çocuksuz, uzun süredir temassız leadlere doğru terminal durum: net kayıp sinyali varsa `kaybedildi`+`lost_reason`; "gelecek sezona kaldı/bekliyor" ise `beklemede`+`beklemede_sezon`. Gerisi gerçek aşamasında kalır (`yeni`/`ulasildi`/...).

**Adım 8 — Yükleme (idempotent).** Mevcut kirli seed'i temizle (Bölüm 7), sonra FK-güvenli sırayla yükle: `families` → `students` → `payment_plans` → `installments` → `leads` → `appointments` → (varsa `offers`) → `refunds` → `lead_notes` → `events(seed_import)`. Önce `--dry-run`, insan onayı, sonra gerçek. Mevcut `upload.ts` yalnız leads+students yüklüyor; **tüm ilişkisel grafı kapsayacak şekilde genişlet.**

**Adım 9 — Doğrulama (Bölüm 8).**

---

## 5. LEAD ÇIKARIM KURALLARI (proza → yapısal alan)

`intro` + `followups` metnini oku, şunları çıkar:

**5.1 parent_name** — metindeki veli adı ("… Hanım/Bey", "Anne X", "Baba Y"). İki ebeveyn varsa birincil olanı `parent_name`, diğerini `source_detail`/aile notuna değil, mümkünse aynen `primary_parent_name`. Ad yoksa `"İsimsiz"`.

**5.2 child_name, child_birth_month, child_birth_year** — "2020 Ekim doğumlu", "Ocak 2022", "5 yaş" gibi ifadelerden ay/yıl. "5 yaş" → yıl = ilk temas yılı − 5 (yaklaşık; emin değilsen yıl boş bırak, ay boş). Ay adlarını sayıya çevir (Ocak=1…Aralık=12).

**5.3 source** (WhatsApp'taki ipuçlarından):
- "referans", "… velisi tavsiye", "mezun öğrencimiz X referansıyla" → `referans` (+ `source_detail`="X referansı").
- "Instagram", "IG", "reklamdan gördü", "sosyal medya" → `instagram`.
- "reklam" (Google/afiş kampanya) → `reklam`.
- "tabelayı görüp", "önünden geçerken" → `tabela_gecerken`.
- "aradı", "telefonla ulaştı", kaynak belirsiz telefon teması → `telefon`.
- "etkinlik", "Perlavista/Yaşam Vadisi/Vadide" gibi etkinlik/fuar → `etkinlik` (+ `source_detail`=etkinlik adı).
- Hiçbiri değilse → `diger`.

**5.4 status** (metindeki en ileri aşamaya göre — mevcut duruma):
- Yalnız ilk mesaj, isim/çocuk yok, dönüş yok → `yeni`.
- "aradık/ulaştık/telefonda görüştük", bilgi verildi → `ulasildi`.
- "randevu verildi/oluşturuldu", "deneme dersine/oryantasyona davet" (henüz gelmemiş) → `randevu`.
- "görüşmeye geldiler", "okula geldi görüştük", "deneme dersini yaptı" → `gorusme_yapildi`.
- "fiyat verildi", "teklif iletildi", fiyat/onay pazarlığı → `teklif`.
- "Eylül'ü düşünüyor", "seneye", "şimdilik erteledi ama ilgili" → `beklemede` (+ `beklemede_sezon`).
- Excel'de öğrenci olarak eşleşiyorsa (Adım 6) → `kazanildi`.
- "başka okula yazıldı", "vazgeçti", "ulaşılamadı/meşgule attı defalarca", "uzak", "pahalı buldu" → `kaybedildi` + uygun `lost_reason` (baska_okul/vazgecti/ulasilamadi/uzaklik/fiyat/diger).

**5.5 bayraklar & lost_reason** —
- `ingilizce_gerekli=true`: "Türkçe bilmiyor", "yabancı", "İngilizce konuşuyor", "İnci teacher ile arayalım".
- `ozel_durum=true` (+ `ozel_durum_note`): "dil terapisi", "ergoterapi", "özel gereksinim", "psikoloğa yönlendirildi".
- `wants_summer=true`: "yaz okulu", "yalnızca yüzme/binicilik", yaz dönemi talebi.
- `lost_reason`: fiyat("pahalı"), uzaklik("uzak"), baska_okul("başka okula kayıt"), ulasilamadi("ulaşılamadı/meşgul/dönmedi"), vazgecti("vazgeçti/düşünmüyor"), diger.

**5.6 assigned_to (sender → profil eşlemesi)** — WhatsApp `sender` alanı gerçek personele karşılık gelir. Prod'da bu profiller mevcut olmalı; yoksa **oluştur** (rol: `annem`→`yonetici`, diğerleri `danisman`) ve eşle:
`Zehra GÜRSEL`, `Rüya Yılmaz`, `Klinik Psikolog Merve Özen`, `Gözde ISITAN` → `danisman`; `annem` / `Mehtap Hanım` → `yonetici`. Eşleşmeyen sender → varsayılan bir danışmana ata ve raporla.

**5.7 tarihler** — `first_seen`/`last_activity_at` için `date` ve `occurrence_dates`/`followups` tarihlerini kullan (ilk = first_seen, son = last_activity).

**5.8 note** — Yalnızca yapısal alanlara sığmayan **kısa** insan yorumu `lead_notes`'a (ör. "akşam 17:00'dan sonra aranmak istiyor"). Tüm intro'yu KOPYALAMA.

---

## 6. EXCEL → ÖĞRENCİ / ÖDEME EŞLEME (onaylı eşlemeyle)

Her Excel satırı (bir öğrenci-sezon) için:
- **students:** `full_name`=çocuk adı, `parent_name`, `phone`(norm), `season`=dosya/sezon yılı (ör. `2024-2025`), `program` (Excel'deki tam gün/yarım gün/… → enum eşle), `birth_*` varsa, `start_date`, `status` (ayrılmışsa `ayrildi`+`left_date`+`leave_reason`, mezunsa `mezun`, yoksa `aktif`).
- **payment_plans:** Excel'de aidat/ücret varsa `item_type='aidat'`, `total_amount`=yıllık toplam (veya aylık×taksit), `installment_count`. Ayrı kayıt ücreti/servis/yemek sütunu varsa **ayrı plan** (`kayit_ucreti`/`servis`/`yemek`).
- **installments:** Plana göre taksitleri üret. Excel "ödenen aylar/ödenen tutar" gösteriyorsa o taksitler `odendi` (+`paid_at`≈o ayın tarihi, `paid_amount`, `payment_method`=Excel'de yoksa makul varsayılan `havale` **yalnızca yöntem bilinmiyorsa**, `marked_by`=ilgili yönetici profili). Ödenmemiş gelecek taksitler `bekliyor`. İptal/ayrılış sonrası taksitler `iptal`.
  - **paid_fields kısıtına dikkat:** `odendi` satırında dört alan da dolu olmalı.
- Excel'de ödeme rakamı **hiç yoksa** o öğrenci için plan/taksit oluşturma (Kural 2). Öğrenci yine de `students`'a girer.

Belirsiz/eksik Excel hücrelerinde tahmin etme; satırı "eksik" olarak raporla, öğrenciyi ödeme olmadan yükle.

---

## 7. MEVCUT KİRLİ SEED'İ TEMİZLEME

Mevcut DB'deki tüm uygulama verisi (leads/students/…) test/kirli seed'tir; gerçek veri yoktur. FK-güvenli sırada temizle (referans tabloları KORU: `profiles`, `price_lists`, `price_list_items`, `app_settings`):
`events` → `refunds` → `installments` → `payment_plans` → `offers` → `appointments` → `tasks` → `notifications` → `lead_notes` → `leads` → `students` → `families`.
Bunu **açık, tek seferlik ve dry-run'da sayıları raporlayan** bir temizlik adımı olarak yap; insan onayından sonra çalıştır.

---

## 8. DOĞRULAMA & KABUL KRİTERLERİ

Yükleme sonrası şunları çalıştır ve raporla:
1. **Sayılar:** kaç lead (durum bazında dağılım), kaç öğrenci (sezon/program bazında), kaç aile, kaç plan/taksit (odendi/bekliyor/iptal), kaç randevu.
2. **Bütünlük:** her `kazanildi` lead'in `converted_student_id`'si dolu; her öğrencinin geçerli `program`/`season`'ı var; her `odendi` taksit `paid_fields`'ı sağlıyor; kaybedildi olan her lead'in `lost_reason`'ı var.
3. **Note temizliği:** hiçbir yapısal bilgi (telefon/isim/tarih/durum) yalnızca `note`/`lead_notes`'ta gömülü değil — örnekle doğrula.
4. **Reconciliation:** kaç öğrenci lead'e bağlandı, kaç öğrencinin lead'i yoktu (yeni lead açıldı), çift eşleşme var mı.
5. **Idempotency:** script'i ikinci kez `--dry-run` çalıştır → "0 yeni satır" göstermeli.
6. **RLS/guard:** service_role ile yazıldığı için guard trigger'ları geçilir; yine de yazılan enum/kısıtların hiçbiri ihlal edilmemiş olmalı (yükleme hatasız bitmeli).
7. **tsc + lint + testler** temiz.

**Kabul:** Uygulama açıldığında "Bugün" ve "Veliler" ekranı gerçek, canlı, aşaması doğru leadleri; "Öğrenciler" gerçek öğrencileri; öğrenci detayında gerçek ödeme planını gösteriyor. Ölü arşiv varsayılan görünümü boğmuyor.

---

## 9. TESLİM EDİLECEK ÇIKTI

1. `anaokulcrm/scripts/seed/` altında: lead çıkarım, excel-parse (genişletilmiş), aile tespit, reconciliation, ve tüm grafı yükleyen genişletilmiş `upload.ts`.
2. `out/` altında ara ürünler (leads.json/csv, students.csv, families.csv, payments.csv…).
3. Excel sütun→alan **eşleme tablosu** (Adım 1 çıktısı).
4. **Yükleme raporu** (Bölüm 8 sayıları + eksik/atlanan satırlar + reconciliation özeti).
5. Kısa README güncellemesi: yeni pipeline nasıl çalıştırılır.

Önce Adım 1 (Excel keşfi) ve Adım 8 dry-run çıktısını insana göster; onay almadan gerçek yükleme ve temizlik yapma.
