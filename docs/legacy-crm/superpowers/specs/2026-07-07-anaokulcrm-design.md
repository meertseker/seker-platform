# AnaOkulCRM – Tasarım Dokümanı (Spec)

**Tarih:** 7 Temmuz 2026 (rev. 8 Temmuz 2026)
**Versiyon:** 1.1 — durum makineleri, event log, performans ve operasyonel ayrıntılar eklendi
**Durum:** Kullanıcı onaylı tasarım
**Hedef kullanıcılar:** Anaokulu sahibi/yöneticisi (Mehtap Hanım) ve kayıt danışmanları (Zehra Hanım, Rüya Hanım)

---

## 1. Amaç ve Problem

Okul, lead takibini, veli görüşmelerini ve fiyat kararlarını bir WhatsApp grubu ("Kayıt Randevuları") üzerinden; kesin kayıt ve ödemeleri ise ayrı Excel dosyalarıyla yürütüyor. İki yıllık sohbet dökümünün analizi şunları gösterdi:

- ~362 lead telefonu mesajlara gömülü, yapılandırılmış hiçbir kayıt yok (ayda ~15 yeni lead).
- 242 randevu mesajı, 87 manuel "Hatırlatmadır" mesajı — randevu hatırlatma tamamen elle.
- 146 "kayıt için bilgi bekliyor" mesajı — takip bekleyen lead'ler grup akışında kayboluyor.
- 204 fiyat mesajı; her indirim kararı ("18 mi diyelim, 15 mi?") grup içinde patron onayına takılıyor, bazen 1 gün gecikiyor.
- 44 "ulaşılamadı", 51 iptal/erteleme — no-show ve kayıp lead takibi yok.
- Kaynaklar biliniyor (185 referans, 76 Instagram, 80 reklam) ama hangi kanalın kayda dönüştüğü ölçülemiyor.

**Hedef:** Lead → Kayıtlı Öğrenci → Aktif Ödeme Takibi akışını tek bir mobil öncelikli web uygulamasında toplamak; takip hatırlatmalarını, teklif onayını ve taksit takibini sistematikleştirmek.

## 2. Kapsam Kararları

| Konu | Karar |
|---|---|
| Kapsam | Tam kapsam: lead pipeline + kayıt + ödeme takibi tek üründe |
| Online tahsilat | **Yok.** Ödemeler dışarıda (havale/POS/elden) alınır, sistemde yalnızca takip edilir |
| Roller | 2 rol: Yönetici ve Danışman |
| Veli iletişimi | MVP'de yok; tüm bildirim ve görevler ekip içi (uygulama içi) |
| Geçmiş veri | Uygulama özelliği değil; geliştirici tarafından tek seferlik seed (WhatsApp + Excel), sistem dolu teslim edilir |
| Dil | Türkçe, tek dil |
| Platform | Mobil öncelikli responsive web |

## 3. Mimari

- **Frontend/Backend:** Next.js 15+ (App Router, Server Components + Server Actions)
- **Veritabanı & Auth:** Supabase (Postgres, Supabase Auth, Row Level Security)
- **Barındırma:** Vercel (uygulama) + Supabase Cloud (veri)
- **Kimlik doğrulama:** E-posta/şifre ile giriş; 3 kullanıcı hesabı teslimde hazır oluşturulur. Kayıt (sign-up) ekranı yoktur; kullanıcıları yönetici davet edemez, hesaplar geliştirici tarafından açılır.
- **Yetkilendirme:** Roller `profiles` tablosunda tutulur; RLS politikaları rol ayrımını veritabanı seviyesinde uygular.

### KVKK ve güvenlik ilkeleri

- Tüm trafik HTTPS; Supabase erişimi RLS olmadan asla açılmaz.
- Çocuğa dair yalnızca gerekli minimum veri tutulur: ad, doğum ay/yılı. Sağlık/alerji gibi özel nitelikli veri alanı MVP'de **yoktur** (serbest metin notlarına yazılabilir; ekip bilgilendirilir).
- Kart/banka verisi hiçbir koşulda tutulmaz (online tahsilat kapsam dışı).
- Ortam değişkenleri (Supabase service key vb.) yalnızca Vercel ortamında; repoya girmez.
- WhatsApp export'u ve türetilmiş ham veriler repoya commit edilmez (`.gitignore`).

## 4. Roller ve Yetkiler

| Yetki | Yönetici | Danışman |
|---|---|---|
| Lead oluşturma/düzenleme, pipeline taşıma | ✔ | ✔ |
| Randevu oluşturma/sonuçlandırma | ✔ | ✔ |
| Teklif oluşturma | ✔ | ✔ |
| Teklif **onaylama / karşı rakam verme** | ✔ | ✖ |
| Fiyat listesi yönetimi | ✔ | ✖ |
| Lead → öğrenci dönüştürme, ödeme planı oluşturma | ✔ | ✔ |
| Taksit "ödendi" işaretleme | ✔ | ✔ |
| Ödendi kaydını geri alma / taksit düzenleme | ✔ | ✖ |
| Dashboard ve raporlar | ✔ | ✔ (danışman performans kırılımı hariç) |
| Kullanıcı listesi görüntüleme | ✔ | ✖ |

## 5. Veri Modeli

Tüm tablolarda `id (uuid)`, `created_at`, `updated_at`. Silme işlemleri soft-delete değildir; lead/öğrenci silme yalnızca Yönetici yetkisindedir ve onay diyaloğu ister.

### 5.1 `profiles`
Supabase Auth kullanıcısına 1:1. Alanlar: `full_name`, `role ('yonetici' | 'danisman')`, `is_active`.

### 5.2 `leads`
- `parent_name` (zorunlu), `phone` (zorunlu, normalize edilmiş +90 formatı, tekrarlı kayıt uyarısı verir)
- `child_name` (ops.), `child_birth_month` (ops.), `child_birth_year` (ops.)
- `source`: `referans | instagram | reklam | tabela_gecerken | telefon | diger` (+ `source_detail` serbest metin, ör. referans veren veli adı)
- `status` (pipeline aşaması): `yeni | ulasildi | randevu | gorusme_yapildi | teklif | kazanildi | kaybedildi`
- `lost_reason`: `fiyat | uzaklik | baska_okul | ulasilamadi | vazgecti | diger` — status `kaybedildi` ise **zorunlu**
- `assigned_to` (profiles FK), `converted_student_id` (students FK, nullable)

### 5.3 `lead_notes`
Lead'e bağlı, **yalnızca insan yazımı** notlar: `lead_id`, `author_id`, `body`. Sistem olayları burada değil, `events` tablosunda tutulur (§5.11); lead detayındaki aktivite akışı iki kaynağı zaman sırasıyla birleştirir.

### 5.4 `appointments`
`lead_id`, `scheduled_at`, `type ('okul_ziyareti' | 'telefon')`, `outcome ('bekliyor' | 'geldi' | 'gelmedi' | 'ertelendi' | 'iptal')`, `outcome_note`. Aynı saat diliminde (±45 dk) başka randevu varsa oluşturma sırasında çakışma uyarısı gösterilir (engellemez).

### 5.5 `price_lists` ve `price_list_items`
Sezon bazlı: `season ('2026-2027' vb.)`, `is_active`. Kalemler: `program ('tam_gun' | 'yarim_gun' | 'uc_gun' | 'play_grup')`, `monthly_fee`, `registration_fee`. Yönetici yönetir.

### 5.6 `offers`
- `lead_id`, `created_by`, `program`, `list_price` (aktif fiyat listesinden otomatik), `offered_price`, `installment_count`, `note`
- `status`: `onay_bekliyor | onaylandi | revize_edildi | reddedildi | gecersiz`
- `decided_by`, `decided_at`, `counter_price` (revize durumunda yöneticinin verdiği rakam), `superseded_by_offer_id` (nullable — yerine geçen teklif)
- Kural: `offered_price >= list_price` ise otomatik onaylanır (onay akışına girmez). İndirimli her teklif yönetici onayı bekler.
- Geçiş kuralları ve invariantlar §6.2'de.

### 5.7 `students`
Lead'den dönüştürülür (`leads.converted_student_id` ile bağ korunur): `full_name`, `birth_month/year`, `parent_name`, `phone`, `season`, `program`, `start_date`, `status ('aktif' | 'ayrildi' | 'mezun')`.

### 5.8 `payment_plans` ve `installments`
- Plan: `student_id`, `season`, kalem tipi `item_type ('aidat' | 'kayit_ucreti' | 'servis' | 'yemek' | 'diger')`, `total_amount`, `installment_count`.
- Plan oluşturma sihirbazı: toplam tutar + taksit sayısı + ilk vade → eşit taksitleri otomatik üretir; taksitler tek tek düzenlenebilir (tutar/vade).
- Taksit: `plan_id`, `due_date`, `amount`, `status ('bekliyor' | 'odendi')`, `paid_at`, `paid_amount`, `payment_method ('havale' | 'nakit' | 'pos' | 'diger')`, `marked_by`.
- "Gecikti" saklanan bir durum değildir; `status='bekliyor' AND due_date < bugün` sorguyla türetilir (görsel olarak kırmızı gösterilir, bkz. §6.3). Kısmi ödeme: `paid_amount < amount` ise kalan için sistem otomatik yeni taksit satırı önerir.

### 5.9 `tasks`
Takip görevleri: `lead_id` (ops.), `assigned_to`, `due_date`, `title`, `status ('acik' | 'tamamlandi')`, `auto_generated boolean`. Otomatik üretim kuralları §8'de.

### 5.10 `notifications`
Uygulama içi bildirim: `user_id`, `type`, `payload (jsonb)`, `read_at`. Örn. "Teklif onayı bekliyor", "Teklifiniz onaylandı: 18.000 TL".

### 5.11 `events` (audit / olay günlüğü)
Append-only domain olay günlüğü: `entity_type ('lead' | 'offer' | 'student' | 'installment' | 'appointment' | 'price_list')`, `entity_id`, `event_type` (ör. `durum_degisti`, `teklif_onaylandi`, `taksit_odendi`, `odeme_geri_alindi`, `danisman_degisti`, `fiyat_listesi_guncellendi`), `actor_id`, `payload (jsonb — eski/yeni değerler)`, `created_at`.

- Tüm durum geçişleri, teklif kararları, taksit ödendi/geri alma işlemleri ve fiyat listesi değişiklikleri buraya yazılır — kim, ne zaman, neyi değiştirdi sorusunun tek cevabı.
- RLS ile **UPDATE ve DELETE tamamen kapalıdır** (append-only invariant); yazma yalnızca server action'lar üzerinden yapılır.
- Lead aktivite akışı ve ileride eklenebilecek raporlar bu tablodan beslenir.

### 5.12 Enum ve yapılandırma stratejisi
- Enum benzeri tüm değerler Postgres native enum yerine `text` + `CHECK` constraint olarak tutulur (migration'sız değer ekleyebilmek için).
- Değer listeleri ve Türkçe etiketleri tek bir `lib/constants.ts` modülünde merkezi tanımlanır; UI ve doğrulama yalnızca buradan okur.
- `source` ve `lost_reason` listeleri MVP'de sabittir; v2'de yöneticinin düzenleyebileceği lookup tablosuna taşınmaya uygun tasarlanmıştır (kod tarafında değerler string olarak geçer, hard-coded switch yoktur).
- Ayarlanabilir iş kuralları (takipsizlik eşiği 3 gün, randevu çakışma penceresi ±45 dk, otomatik onay eşiği) `app_settings` (key-value, jsonb) tablosunda tutulur; MVP'de UI'dan düzenlenmez ama koda gömülmez.

## 6. Durum Makineleri ve İş Kuralları (İnvariantlar)

### 6.1 Lead durum makinesi
İleri akış: `yeni → ulasildi → randevu → gorusme_yapildi → teklif → kazanildi`.

- **Her aşamadan** `kaybedildi`ye geçilebilir; `lost_reason` zorunludur (UI modal + DB CHECK).
- **Geri geçiş** (yanlış tıklama düzeltme) her aşamada serbesttir; her geçiş `events`e yazılır.
- `kaybedildi` bir lead "Yeniden Aç" aksiyonuyla `ulasildi` durumuna döner; `lost_reason` temizlenir, event yazılır.
- `kazanildi → öğrenciye dönüştürme` sonrası lead **kilitlenir**: durum değiştirilemez, yalnızca not eklenebilir. Dönüştürme geri alınamaz (öğrenci silme ayrı ve yönetici yetkisindedir).
- Bir lead'in durumu `randevu` iken `outcome='bekliyor'` olan en az bir randevusu olması beklenir; randevu sonuçlanınca UI danışmanı sonraki duruma yönlendirir (zorlamaz).

### 6.2 Teklif durum makinesi
`onay_bekliyor → onaylandi | revize_edildi | reddedildi` (karar yalnızca Yönetici; `decided_by/decided_at` set edilir).

- **Aynı lead'de aynı anda en fazla 1 adet `onay_bekliyor` teklif** olabilir (partial unique index: `offers(lead_id) WHERE status='onay_bekliyor'`).
- **`onaylandi` teklif değiştirilemez (immutable).** Rakam değişecekse yeni teklif oluşturulur; yeni teklif kesinleştiğinde eski aktif teklif otomatik `gecersiz` olur ve `superseded_by_offer_id` set edilir.
- **`reddedildi` teklif tekrar `onay_bekliyor` olamaz**; danışman yeni teklif oluşturur.
- **`revize_edildi`** = yönetici `counter_price` verdi ve bu teklif kapandı. Danışman "Karşı rakamla teklif oluştur" kısayoluyla `counter_price` üzerinden yeni teklif açar; rakamı yönetici belirlediği için bu teklif **otomatik `onaylandi`** doğar (ikinci onay turu gerekmez).
- **Öğrenciye dönüştürme yalnızca lead'de `onaylandi` bir teklif varken yapılabilir**; dönüşümde bu teklif ödeme planına referans olur (aidat tutarı ve taksit sayısı ön-doldurulur).

### 6.3 Taksit ve ödeme invariantları
- Bir plandaki taksitlerin toplamı her zaman `payment_plans.total_amount`a eşittir; taksit düzenlemede uygulama bu dengeyi doğrular ve fark varsa kaydetmez.
- `odendi` taksit danışman tarafından hiçbir şekilde değiştirilemez; yalnızca Yönetici "Ödemeyi Geri Al" yapabilir (taksit `bekliyor`a döner, `paid_*` alanları temizlenir, `events`e `odeme_geri_alindi` yazılır).
- `paid_amount > 0` ise `paid_at`, `payment_method` ve `marked_by` zorunludur (DB CHECK).
- Kısmi ödemede kalan tutar için üretilen yeni taksit satırı orijinal taksitin `due_date`ini devralır; plan toplamı invariant'ı korunur.
- Vadesi geçmiş (`gecikti`) türetilmiş bir görünümdür; hiçbir job taksit status'unu `gecikti`ye yazmaz.

## 7. Ekranlar

1. **Giriş** — e-posta/şifre.
2. **Bugün (ana sayfa)** — bugünkü randevular; 3+ gündür işlem görmemiş açık lead'ler; vadesi gelen/geciken görevler; (yöneticiye ek olarak) onay bekleyen teklifler ve geciken taksit özeti.
3. **Pipeline** — kanban görünümü, 7 sütun. Mobilde yatay kaydırma + kart üzerinde hızlı durum değiştirme butonları. Filtre: danışman, kaynak, tarih aralığı. `kaybedildi`ye taşırken neden seçimi zorunlu modal.
4. **Lead detay** — üstte özet kart (veli, telefon → `tel:` linki, çocuk, kaynak, danışman); sekmeler: Aktivite (notlar+sistem olayları), Randevular, Teklifler. "Öğrenciye Dönüştür" butonu yalnızca `kazanildi` durumunda aktif.
5. **Yeni lead formu** — 30 saniyede doldurulacak şekilde: veli adı, telefon, kaynak zorunlu; gerisi opsiyonel. Telefon girildiğinde mevcut lead/öğrenci eşleşmesi kontrol edilir, varsa uyarı gösterilir.
6. **Takvim** — haftalık randevu görünümü, gün bazlı liste (mobil), çakışma uyarıları.
7. **Teklif onay kuyruğu (yönetici)** — bekleyen teklifler listesi; her satırda lead özeti, liste fiyatı, teklif, indirim %; aksiyonlar: Onayla / Karşı Rakam / Reddet.
8. **Öğrenciler** — liste + öğrenci detayı (bilgiler, ödeme planları, taksit tablosu). Taksit satırında "Ödendi işaretle" (tutar + yöntem + tarih).
9. **Ödemeler** — tüm öğrenciler genelinde taksit görünümü: geciken / bu hafta vadesi gelen / bu ay beklenen; toplamlar.
10. **Dashboard** — aylık funnel (yeni lead → randevu → görüşme → kayıt) sayı ve dönüşüm oranları; kaynak bazlı kayıt dönüşümü; kayıp nedenleri dağılımı; bu ay beklenen vs. tahsil edilen; geciken toplam. Danışman bazlı performans kırılımı yalnızca yöneticiye görünür.
11. **Ayarlar (yönetici)** — sezon ve fiyat listesi yönetimi.

## 8. Otomatik Görev ve Bildirim Kuralları

Görevler günlük bir zamanlanmış işle (Vercel Cron → Supabase) üretilir; aynı kural için açık görev varsa yenisi üretilmez:

1. **Takipsiz lead:** `yeni/ulasildi/gorusme_yapildi/teklif` durumundaki lead'de 3 gün (`app_settings`ten) aktivite yoksa → atanan danışmana "Takip et" görevi.
2. **Randevu günü:** Randevu sabahı danışmana (ve yöneticiye) bildirim.
3. **No-show:** Randevu `gelmedi` işaretlenince ertesi güne "Yeniden ara / randevu ver" görevi.
4. **Teklif onayı:** İndirimli teklif oluşunca yöneticiye bildirim; karar verilince danışmana bildirim.
5. **Taksit vadesi:** Vadesi bugün olan ve geciken taksitler için "Ödemeler" ekranı beslenir; yöneticiye haftalık geciken özeti bildirimi.

Veliye giden hiçbir otomatik mesaj yoktur. Lead detayındaki telefon için `tel:` ve `https://wa.me/<numara>` kısayolları bulunur (mesaj içeriği MVP'de şablonsuz, boş açılır).

## 9. Tek Seferlik Seed (Teslim Öncesi, Geliştirici Tarafında)

1. `_chat.txt` (9.687 satır) script ile parse edilir: telefon regex'i ile lead adayları bulunur, AI destekli çıkarımla veli adı, çocuk doğum ay/yılı, kaynak, son durum ve özet not üretilir.
2. Excel'lerdeki (`DATA KAYIT 2024-2025.xlsx`) kayıtlı öğrenciler öğrenci kayıtlarına dönüştürülür.
3. Sonuç önce CSV olarak kullanıcıya gösterilir; onay sonrası Supabase'e yüklenir.
4. Ham export ve ara dosyalar repoya girmez; seed script'i repoda kalır ama veri içermez.
5. Tarihi lead'ler en iyi tahmin durumuyla işaretlenir (`kazanildi`, `kaybedildi` vb.). Durumu belirsiz olanlar `kaybedildi/diger` olarak işaretlenir ve lead notuna "seed: durum belirsiz" yazılır.

## 10. Hata Yönetimi

- Form doğrulama Türkçe ve alan bazlı (telefon formatı, zorunlu alanlar, tutar > 0, vade tarihi geçerliliği).
- Sunucu hatalarında kullanıcıya Türkçe genel hata + yeniden dene; veri kaybını önlemek için form içerikleri korunur.
- Yavaş bağlantıda kaydetme butonları "kaydediliyor" durumuna geçer; çift gönderim engellenir.
- RLS ihlali durumunda (yetkisiz istek) istemci 403 mesajı gösterir; UI zaten yetkisiz aksiyonları saklar.

## 11. Performans ve Ölçek

**Beklenen veri hacmi** (WhatsApp analizinden türetilmiş): ~180 lead/yıl, ~100 aktif öğrenci, ~1.500 taksit/yıl, ~5.000 event/yıl. 10 yıllık kullanımda dahi tablolar on binler mertebesinde kalır.

- **Dashboard ve raporlar canlı SQL ile hesaplanır.** Bu ölçekte cache, materialized view veya ayrı rapor tablosu **bilinçli olarak kullanılmaz** — erken optimizasyon karmaşıklığından kaçınılır. Eşik: bir dashboard sorgusu p95'te 500ms'yi aşarsa ilgili sorgu materialized view'a taşınır (mimari buna uygundur, sorgular view olarak yazılır).
- **İndeksler:** `leads(status)`, `leads(assigned_to, status)`, `leads(phone)`, `appointments(scheduled_at)`, `installments(due_date, status)`, `installments(plan_id)`, `events(entity_type, entity_id, created_at)`, `notifications(user_id, read_at)`, `offers(lead_id) WHERE status='onay_bekliyor'` (partial unique).
- Listeler sayfalanır (50 kayıt); pipeline kanban'ı yalnızca açık lead'leri yükler (`kazanildi/kaybedildi` ayrı arşiv görünümünde).

## 12. Operasyonel Ayrıntılar

- **Saat dilimi:** Tüm tarih/saat işlemleri `Europe/Istanbul`; DB'de `timestamptz` tutulur, gösterim TR. Günlük görev cron'u 06:00 (TR) çalışır.
- **Para birimi:** Yalnızca TRY; tutarlar `numeric(12,2)`. Taksit bölmede kuruş farkı son taksite eklenir.
- **Telefon formatı:** Girişte E.164'e normalize edilir (`+905XXXXXXXXX`); tekillik kontrolü ve `wa.me` linkleri bu format üzerinden çalışır.
- **Yedekleme:** Supabase günlük otomatik yedek; ayrıca yöneticiye ayda bir CSV dışa aktarma önerilir (teslim dokümanında anlatılır).
- **Cron güvenliği:** Vercel Cron endpoint'i secret header ile korunur.

## 13. Test Stratejisi

- **Birim testleri:** taksit üretim mantığı (eşit bölme, kuruş yuvarlama son taksite, kısmi ödeme kalanı, plan toplamı invariant'ı), lead ve teklif durum makineleri (geçersiz geçişlerin reddi; kaybedildi → neden zorunlu; onaylanmış teklifin immutable olması; tek aktif `onay_bekliyor` teklif), teklif otomatik onay eşiği.
- **RLS testleri:** danışman rolüyle teklif onaylamanın, taksit geri almanın ve fiyat listesi değiştirmenin reddedildiği; `events` üzerinde UPDATE/DELETE'in tüm roller için reddedildiği.
- **Uçtan uca senaryo (teslim öncesi, seed verisiyle):** yeni lead girişi → randevu → görüşme → indirimli teklif → yönetici onayı → öğrenciye dönüştürme → 10 taksitli plan → taksit ödendi işaretleme → dashboard'da yansıma.

## 14. Kapsam Dışı (Bilinçli Ertelenenler)

- Online tahsilat (iyzico/PayTR), otomatik kart çekimi
- WhatsApp Business API entegrasyonu, veliye otomatik mesaj/şablon
- Veli portalı, e-fatura/muhasebe entegrasyonu
- Uygulama içi veri import ekranı
- Yoklama, sınıf yönetimi, servis rotası gibi operasyon modülleri
- Çoklu şube/kurum desteği

## 15. Başarı Kriterleri

- Ekip yeni lead'i WhatsApp grubuna değil sisteme giriyor (ilk ay ≥ %90).
- Hiçbir açık lead 3 günden fazla dokunulmadan kalmıyor (görev motoru yakalıyor).
- Teklif onayı ortalama süresi < 2 saat (gruptaki 1 güne karşı).
- Aylık tahsilat durumu ve geciken taksitler Excel açmadan dashboard'dan okunabiliyor.
