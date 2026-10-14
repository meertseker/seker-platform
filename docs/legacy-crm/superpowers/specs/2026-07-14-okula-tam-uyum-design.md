# AnaOkulCRM — "Okula Tam Uyum" Tasarım Dokümanı (Spec)

**Tarih:** 2026-07-14
**Durum:** Onaylandı → implementasyon planına hazır
**Kapsam:** Domain uyumu (A) + eklenen özellikler (household, ayrılış-iade, WhatsApp köprüsü) + araştırma-temelli UX yeniden tasarımı.
**Kapsam dışı (ayrı planlar):** Seed/veri göçü (B), canlıya alma/handoff/eğitim (C).
**Besleyen araştırma:** `docs/research/2026-07-14-ux-arastirma-sentezi.md` (Perplexity, 115 kaynak) + arka plan deep-research (105 ajan, adversarial doğrulama).

---

## 1. Amaç ve İlkeler

Uygulamayı, WhatsApp grubunda yürüyen gerçek anaokulu kayıt sürecine **tam uyumlu** ve teknik olmayan danışmanların terk etmeyeceği kadar **sürtünmesiz** hale getirmek.

**Tasarım anayasası (araştırmadan):**
1. **Benimseme > özellik.** CRM başarısızlığının %90+'ı insan/kullanım kaynaklı. Danışman ekranı *danışman üretkenliği* için tasarlanır, yönetici görünürlüğü için değil.
2. **Sürtünme = ölüm.** ≤4 zorunlu alan, akıllı varsayılanlar, 2-dokunuş kayıt. %72 kullanıcı işlevselliği sadelik için takas eder.
3. **Çift-iş = ölüm.** CRM WhatsApp'ın rakibi değil uzantısı: her lead'de "WhatsApp'ta aç", numara-bazlı eşleştirme.
4. **Mobil-öncelik.** Danışman ekranı = ana ürün. Kurucu dashboard'u ikincil.
5. **Görünür fayda.** "Bugün" aksiyon kuyruğu + günlük mikro-hedef + kurucuya "unutulan lead" farkı.

**Personalar:** *Danışman* (Zehra/Rüya — teknik değil, mobil, saha) · *Kurucu* (fiyat/teklif onayı, dashboard).

---

## 2. Veri Modeli Değişiklikleri (Migration 0003 — additive)

Mevcut RLS/guard'lar korunur; hepsi additive.

### 2.1 Enum genişletmeleri
- `appointments.type` CHECK → `okul_ziyareti | telefon | demo | oryantasyon`
- `leads.source` CHECK → `... | etkinlik`
- `leads.status` CHECK → `... | beklemede` (gelecek sezona bilinçli park; unutulmuş ≠ ertelenmiş)
- `installments.status` CHECK → `bekliyor | odendi | iptal`

### 2.2 Yeni sütunlar
- `price_list_items.capacity int null` — sezon+program kontenjanı (null = sınırsız)
- `leads`: `ingilizce_gerekli boolean default false`, `ozel_durum boolean default false`, `ozel_durum_note text`, `wants_summer boolean default false`
- `students`: `left_date date`, `leave_reason text`
- `leads.beklemede_sezon text null` — beklemede iken hedef sezon (opsiyonel)

### 2.3 Household (aile) — yeni tablolar
```
families (
  id uuid pk, family_code text unique, primary_parent_name text,
  phone text, discount_type text null, created_at, updated_at )
```
- `leads.family_id uuid null references families(id)`
- `students.family_id uuid null references families(id)`
- Model: **veli = ana kişi (families), öğrenci/lead = bağlı kayıt** (NetpusCRM deseni, doğrulandı).
- Kardeş indirimi **aileye** bağlı, çocuğa değil; konfigüre edilebilir (`discount_type`: yok | yuzde_10 | ozel). Kardeş ayrılınca yeniden hesap.

### 2.4 İade kaydı — yeni tablo
```
refunds (
  id uuid pk, student_id uuid references students(id),
  amount numeric(12,2), method text, refund_date date,
  note text, created_by uuid references profiles(id), created_at )
```

### 2.5 Yaz okulu
Ekstra tablo yok — ayrı `season` değeri (ör. `2025-yaz`) + kendi `price_list`'i. `leads.wants_summer` ilgi işareti.

### 2.6 Migration güvenliği
Tüm değişiklikler additive; mevcut satırlar defaults ile geçerli. RLS politikaları yeni tablolara `is_staff()` select + rol-bazlı write ile genişletilir (families staff-write, refunds yönetici-write). `lost_reason_required` kısıtı `beklemede`yi etkilemez.

---

## 3. Özellik Tasarımları

### F0 — Tasarım Sistemi + Erişilebilirlik Temeli
- **Token'lar** (`globals.css` / Tailwind `@theme`): palet ve tipografi (bkz. araştırma sentezi §6). Primary `#2563EB`, nötr taban `#F5F7FA`, Inter.
- **Durum rozetleri:** renk + ikon + metin (renk-körü güvenli). Yeni/Randevu/Teklif/Kazanıldı/Kaybedildi/Takipsiz-Beklemede için sabit bileşen.
- **A11y standardı (lint/checklist):** kontrast ≥4.5:1 (UI ≥3:1), gövde ≥16px kritik metinde, dokunma 44px (min 24×24), görünür odak, %200 zoom + metin-aralığı dayanıklılığı (Türkçe genişleme), label zorunlu.

### F1 — Domain Şema (yukarıdaki migration 0003) + `constants.ts` güncellemeleri
Enum etiketleri, `EVENT_LABELS`'a yeni olaylar (ayrılış, iade, beklemeye alma), form seçenekleri.

### F2 — Danışman Deneyimi (mobil-öncelik)
- **"Bugün" ekranı:** önceliklendirilmiş aksiyon kuyruğu (liste değil). Üstte "Bugün odaklan: 3 iş" (skor: vade+aşama+değer+son aktivite). Sekmeler: Bugün / Vadesi Geçen / Tümü. Her satır: birincil CTA (Ara / WhatsApp) + Ertele. Günlük mikro-hedef çubuğu.
- **Hızlı lead formu:** ≤4 zorunlu (çocuk adı, veli adı, telefon, kaynak). Akıllı varsayılan (kaynak=son, tarih=bugün, atanan=ben, sezon=aktif). Telefon numerik+format, non-blocking validasyon. Numara çakışmasında "zaten var" uyarısı.
- **Pipeline mobil:** segment sekmeli liste + swipe (sağ=sonraki, sol=önceki, uzun-bas=aşama sheet). Desktop drag-drop korunur. Demo/oryantasyon aşama görünürlüğü.
- **WhatsApp click-to-chat:** lead & öğrenci detayında + "Bugün" satırlarında `wa.me/<normalize telefon>` butonu. `app_settings`'e 2-3 düzenlenebilir mesaj şablonu.

### F3 — Aile & Finans
- **Household görünümü:** lead/öğrenci detayında "bu ailenin diğer çocukları"; aynı `family_id` veya telefonla öneri + tek-tık bağla.
- **Kardeş indirimi:** aile `discount_type` kuralı; teklif/ödeme planında otomatik uygulanır; kardeş ayrılınca yeniden hesap uyarısı.
- **Kontenjan rozeti (soft):** teklif & dönüştürme ekranında "Tam Gün 18/20"; dolunca kırmızı uyarı, engellemez. Doluluk = sezon+program aktif öğrenci sayısı.
- **Ayrılış-iade akışı:** öğrenci "ayrıldı" → `left_date`/`leave_reason` + gelecekteki `bekliyor` taksitler otomatik `iptal` + iade kaydı (tutar/yöntem/tarih, yönetici onaylı). Fatura görünümü: **toplam / ödenen / kalan / gecikme**.

### F4 — Bildirim & Eskalasyon + Kurucu Dashboard
- **SLA & eskalasyon:** lead sıcaklığına göre SLA; mesai-dışı "Paused"; merdiven eskalasyon (T0 atama → T+2s danışman → T+1g danışman+yedek → kurucu). Mevcut `takipsizlik_gun`/otomatik görev motoru üstüne. `beklemede` lead'lere takipsizlik görevi açılmaz.
- **Bildirim yükü:** aynı lead/görev için gün başına ≤1 kesinti; kanal matrisi (app-içi > push > e-posta digest; SMS/WhatsApp opt-in).
- **Kurucu dashboard kartları:** "WhatsApp'tan gelen ≠ CRM'e girilen" farkı, kaynak-bazında dönüşüm, program doluluk, "danışman bugün X kayıt güncelledi", unutulan-lead trendi.

---

## 4. Fazlama ve Bağımlılıklar

| Faz | Bağımlılık | Özet |
|---|---|---|
| F0 | — | Tasarım sistemi + a11y temeli |
| F1 | F0 (token'lar) | Migration 0003 + constants |
| F2 | F1 | Danışman "Bugün"/form/pipeline/WhatsApp |
| F3 | F1 | Household/kardeş/kontenjan/ayrılış-iade |
| F4 | F1, F2 | Bildirim/eskalasyon + dashboard |

F2 ve F3 F1 sonrası paralel gidebilir.

---

## 5. Test Yaklaşımı
- **Şema/RLS:** yeni tablolar ve guard'lar için `tests/rls` genişletmesi (danışman vs yönetici yazma sınırları; families/refunds).
- **İş kuralı birim testleri:** kontenjan doluluk hesabı, kardeş indirimi yeniden hesap, ayrılışta taksit iptali + iade tutarı, beklemede→takipsizlik istisnası.
- **A11y:** kontrast/dokunma/odak için checklist + otomatik denetim (axe benzeri) kritik ekranlarda.
- **Akış doğrulaması:** lead→demo→teklif→öğrenci→ayrılış tam turu; WhatsApp deep-link; mobil swipe.

---

## 6. Kapsam Dışı (bilinçli)
Veliye otomatik ödeme hatırlatması (ileride), seed/veri göçü (B planı), canlıya alma + gerçek personel hesapları + eğitim (C planı), tam waitlist otomasyonu (kontenjan v2), WhatsApp Business API entegrasyonu (şimdilik sadece click-to-chat).
