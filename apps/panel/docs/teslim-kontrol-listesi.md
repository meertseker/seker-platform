# Teslim Kontrol Listesi (Task 17 — Uçtan Uca Doğrulama)

Bu belge, AnaOkulCRM projesinin lokal doğrulamasını (spec §13) kontrol listesi olarak
kayıt altına alır. Her madde, çalışan lokal Supabase + `npm run dev` ortamına karşı
gerçekten uygulanarak işaretlenmiştir (tarayıcı otomasyonu: geçici olarak kurulan
Playwright ile; commit'e dahil edilmemiştir — yalnızca bu belge teslim edilir).

Test kullanıcıları: `yonetici@test.local` / `danisman@test.local`, şifre `sifre123`.
Tarih: 2026-07-11 (Europe/Istanbul, uygulamanın kendi "Bugün" başlığından doğrulandı).

## Adım 1 — Testler ve build

- [x] `npx supabase db reset` — temiz durumdan başlamak için (RLS testleri fixture'ları
      her çalıştırmada kendi taze satırlarını oluşturduğu için reset zorunlu değil, ama
      manuel test verisiyle karışmaması için önce sıfırlandı).
- [x] `npm test` — **57/57 test PASS** (8 test dosyası: 6 birim + `tests/rls/rls.test.ts`).
      Süre ~1s. Hata/uyarı yok.
- [x] `npm run build` — **hatasız tamamlandı** (Next.js 16.2.10, Turbopack).
      Derleme sırasında görülen tek uyarı (verbatim):
      `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`
      Bu, mevcut `middleware.ts` dosyasının Next 16'daki yeni adlandırmasıyla ilgili
      bir kütüphane uyarısıdır; build'i veya çalışma zamanını etkilemez, Task 17
      kapsamında kod değişikliği yapılmadı (controller'a bilgi notu).

## Adım 2 — E2E senaryo (spec §13, lokalde gerçek uygulama üzerinde)

Senaryoda oluşturulan test lead'i: **Ayşe Yılmaz (E2E)** / çocuk **Deniz Yılmaz**,
program **Tam Gün** (liste fiyatı 22.000 ₺), teklif **19.999,95 ₺** (indirim, otomatik
onay eşiğinin altında → onay bekliyor akışı tetiklenir).

- [x] **Yeni lead oluştur** — `/leads/new` formu dolduruldu (veli adı, telefon, kaynak:
      Referans, çocuk adı/doğum ayı-yılı). Sonuç: lead oluşturuldu, `/leads/{id}`'ye
      yönlendirildi.
- [x] **Randevu planla** — Lead detayında "Okul Ziyareti", bugün 10:00. Randevu listede
      "Bekliyor" durumunda göründü.
- [x] **Çakışan ikinci randevu dene (uyarı görülmeli)** — Aynı gün 10:20 için ikinci
      randevu denendi (çakışma penceresi `app_settings.cakisma_dakika` = 45 dk).
      Sonuç: sarı uyarı kutusu göründü — *"Bu saate yakın başka randevu var: ...
      Yine de kaydet?"* — "Vazgeç" ile iptal edildi, ikinci randevu kaydedilmedi.
- [x] **Randevu sonucu "geldi"** — İlk randevuda "Geldi" butonuna basıldı, rozet
      "Geldi" olarak güncellendi.
- [x] **Lead durumu "Görüşme Yapıldı"** — Durum seçiminden `gorusme_yapildi` seçildi,
      kaydedildi ve doğrulandı (select değeri `gorusme_yapildi`).
- [x] **Danışman olarak indirimli teklif ver** — `danisman@test.local` ile giriş
      yapılmış haldeyken Tam Gün / 10 taksit / 19.999,95 ₺ teklif oluşturuldu.
      Sonuç: teklif listede **"Onay Bekliyor"** rozetiyle göründü (liste fiyatının
      altında olduğu için otomatik onaylanmadı — spec §5.6 kuralı doğru çalıştı).
- [x] **Yönetici bildirimi görür** — `yonetici@test.local` ile giriş yapıldı, zil
      ikonu açıldı: *"Onay bekleyen yeni teklif: 19.999,95 ₺"* bildirimi görüldü.
- [x] **Yönetici onaylar** — `/teklifler` sayfasında ilgili satır bulundu, "Onayla"
      tıklandı. Sonuç: teklif onay kuyruğundan kalktı (durumu `onaylandi`'ye geçti,
      lead durumu otomatik `teklif`'e ilerledi).
- [x] **Öğrenciye dönüştür** — Lead detayında "Öğrenciye Dönüştür" ile modal açıldı,
      başlangıç tarihi (bugün) onaylanarak dönüştürüldü. Sonuç: `/ogrenciler/{id}`'ye
      yönlendirildi, öğrenci kaydı "Deniz Yılmaz" adıyla oluştu.
- [x] **10 taksitli plan (kuruş farkı son taksitte)** — Plan sihirbazı, onaylı
      tekliften toplam=19.999,95 ₺ ve taksit sayısı=10 ile otomatik açıldı. İlk vade
      kasıtlı olarak geçmişe (2026-04-11) çekilerek "geciken" senaryosu için veri
      üretildi. Önizleme ve kaydedilen tabloda doğrulama:
      - 1. taksit (11 Nisan 2026): **1.999,99 ₺**
      - 2.–9. taksitler: **1.999,99 ₺** (aynı)
      - **10. (son) taksit (11 Ocak 2027): 2.000,04 ₺** ← kuruş farkı (+5 kuruş) son
        taksite eklendi. Toplam kontrolü: 9 × 1.999,99 + 2.000,04 = 19.999,95 ₺ ✓.
- [x] **Kısmi ödeme al (kalan tutar taksiti oluşmalı)** — 1. taksit (1.999,99 ₺, zaten
      vadesi geçmiş) üzerinde "Ödendi işaretle" ile 1.000,00 ₺ kısmi ödeme girildi.
      Sonuç: taksit tablosu 10 satırdan **11 satıra** çıktı — orijinal taksit "Ödendi"
      (1.000,00 ₺) olarak işaretlendi ve aynı vadeyle (11 Nisan 2026) **999,99 ₺**
      tutarında yeni "Bekliyor" kalan taksiti otomatik oluşturuldu.
- [x] **Ödemeler ekranında geciken görünümü** — `/odemeler` → "Geciken" bölümü:
      ```
      Deniz Yılmaz  Aidat  11 Nisan 2026  (91 gün gecikti)   999,99 ₺
      Deniz Yılmaz  Aidat  11 Mayıs 2026  (61 gün gecikti) 1.999,99 ₺
      Deniz Yılmaz  Aidat  11 Haziran 2026 (30 gün gecikti) 1.999,99 ₺
      Toplam: 4.999,97 ₺
      ```
      (11 Temmuz vadeli taksit bugüne denk geldiği için "geciken" değil, ayrı
      bekleyen olarak doğru şekilde hariç tutuldu.)
- [x] **Dashboard sayıları (huni'de bu lead görünmeli)** — `/dashboard`, seçili ay
      2026-07. Senaryo öncesi/sonrası karşılaştırma:
      - Öncesi: Lead 0 · Randevu 0 (%0) · Görüşme 0 (%0) · Kayıt 0 (%0)
      - Sonrası: **Lead 1 · Randevu 1 (%100) · Görüşme 1 (%100) · Kayıt 1 (%100)**
      Test lead'i huninin her aşamasında doğru sayıldı (randevu alan, görüşmeye
      ulaşan ve kazanılan olarak).
- [x] **Cron çağrısı (curl ile, CRON_SECRET header)** — Gerçek `curl` ile üç çağrı:
      - Doğru secret: `curl -H "Authorization: Bearer dev-cron-secret" .../api/cron/daily`
        → `200 {"ok":true,"staleLeads":1,"appts":0}`
      - Yanlış secret: → `401 {"error":"unauthorized"}`
      - Header yok: → `401 {"error":"unauthorized"}`
      Guard doğru çalışıyor; kural 1 (takipsiz lead görevi) tetiklendi.
- [x] **Bugün ekranında üretilen görev/randevular** — Takipsizlik testi için ikinci
      bir lead ("Takipsiz Test Velisi (E2E)") oluşturulup `last_activity_at` servis
      anahtarıyla 5 gün geriye çekildi (`takipsizlik_gun`=3 eşiğini aşacak şekilde),
      sonra cron tekrar çağrıldı. Sonuç: `/` (Bugün) ekranında danışmanın "Açık
      görevlerim" listesinde **"Takip et: Takipsiz Test Velisi (E2E) (3+ gündür işlem
      yok)"** görevi göründü. Ayrıca "Bugünkü randevular" bölümünde bugün saat 10:00
      için oluşturulan **Ayşe Yılmaz (E2E)** randevusu (sonucu "Geldi") doğru şekilde
      listelendi.

### Kullanılan roller

- **Danışman** (`danisman@test.local`): lead oluşturma, randevu, teklif oluşturma,
  takipsiz test lead'i oluşturma.
- **Yönetici** (`yonetici@test.local`): bildirim görme, teklif onaylama, öğrenciye
  dönüştürme, ödeme planı oluşturma, kısmi ödeme alma, ödemeler/dashboard görüntüleme.

### Temizlik

Senaryo sonunda `npx supabase db reset` çalıştırılarak test verileri (lead'ler,
öğrenci, ödeme planı, bildirimler, görevler) tamamen temizlendi; lokal veritabanı
yalnızca seed verisiyle (2 test kullanıcı, fiyat listesi) baş durumda bırakıldı.

## Üretim kurulumu (kullanıcı ile birlikte yapılacak)

Aşağıdaki adımlar proje sahibinin gerçek hesaplarını, ödeme bilgilerini ve onayını
gerektirdiği için bu görev kapsamında **uygulanmamıştır**. Kullanıcı ile birlikte,
canlı bir oturumda yapılmalıdır:

- [ ] Supabase Cloud projesi oluşturma
- [ ] `npx supabase link` + `npx supabase db push` (üretim şemasını uygulama)
- [ ] 3 gerçek kullanıcıyı Supabase Auth'ta oluşturma + `profiles` satırlarının
      SQL editöründe eklenmesi
- [ ] Vercel projesi bağlama ve üretim env değişkenlerinin girilmesi
      (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` — üretim değerleri, dev değerleri
      değil)
- [ ] Vercel'e deploy + üretimde smoke test (login, lead oluştur/sil)
- [ ] Task 16 seed CSV'lerinin (leads.csv, students.csv) kullanıcı onayından
      geçirilmesi
- [ ] Onaylanan CSV'lerin `upload.ts` ile üretim ortamına yüklenmesi ve spot kontrol
      (lead sayısı, öğrenci sayısı, dashboard rakamları)
- [ ] Aylık CSV yedek önerisinin (spec §12) kullanıcıya iletilmesi ve sürecin
      benimsenmesi

## Bilinen sınırlamalar

- **Seed heuristiği hiç "kazanıldı" üretmiyor** — Task 16'da işlenen WhatsApp
  sohbet dökümlerinde "kayıt oldu" / kazanım bildiren net bir dil kalıbı
  bulunmadığından, üretilen `leads.csv` içinde `kazanildi` durumuna otomatik
  atanan hiçbir satır yok. Gerçek kayıtları işaretlemek için CSV'nin insan
  tarafından gözden geçirilip düzeltilmesi gerekir.
- **`students.csv` program/sezon/tutar alanları boş** — Kaynak veri bir Excel
  çağrı kaydı dökümü olduğundan bu alanlar sistemde tutulmuyor; üretim
  yüklemesinden önce bu sütunların elle doldurulması gerekir.

(Bu iki madde Task 16 seed raporundan aynen taşınmıştır; Task 17 kapsamında
yeniden doğrulanmamıştır çünkü Adım 4 — üretime seed uygulama — kullanıcı ile
birlikte yapılacak adımlar arasındadır.)
