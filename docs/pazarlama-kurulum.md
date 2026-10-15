# Pazarlama entegrasyonu: sahibin kurulum listesi

## 1. Google Cloud projesi
- [ ] console.cloud.google.com → yeni proje "seker-platform".
- [ ] APIs & Services → Library: "Google Ads API" ve "Data Manager API" etkinleştir.
- [ ] OAuth consent screen: User type **External**, uygulama adı "Şeker Panel".
      Scopes: `https://www.googleapis.com/auth/adwords`, `https://www.googleapis.com/auth/datamanager`.
- [ ] **Publishing status: In production.** "Testing" durumunda kalırsa refresh token 7 günde geçersiz olur
      ve senkron sessizce durur. Doğrulanmamış uygulama uyarısı çıkması sorun değil (tek kullanıcı biziz).
- [ ] Credentials → OAuth client ID → "Web application",
      Authorized redirect URI: `https://developers.google.com/oauthplayground`.
      Client ID ve secret'ı not et → `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`.

## 2. Developer token
- [ ] ads.google.com → Yönetici hesabı (MCC) yoksa oluştur, okulun reklam hesabını bağla.
- [ ] MCC → Tools → API Center → developer token al (başta "Test" seviyesinde gelir).
- [ ] Aynı ekrandan **Explorer access** başvurusu yap (canlı hesaplara günde 2.880 işlem; bizim ihtiyacımız günde ~5).
      Token → `GOOGLE_ADS_DEVELOPER_TOKEN`. MCC ID (tiresiz) → `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
- [ ] Okulun reklam hesabı ID'si (tiresiz) → `GOOGLE_ADS_CUSTOMER_ID`.
- Not: Dönüşümler Data Manager API ile OAuth üzerinden yüklenir. Developer token yalnızca harcamayı
  okumak (Google Ads API searchStream) için gerekir. Token onaylanana kadar harcama "Token beklerken"
  bölümündeki CSV ile yüklenebilir; dönüşüm yüklemeleri ise OAuth, müşteri ID'si ve dönüşüm işlem ID'leri
  hazır olunca çalışabilir.

## 3. Refresh token
- [ ] https://developers.google.com/oauthplayground → sağ üst dişli → "Use your own OAuth credentials" → client ID/secret.
- [ ] Scope kutusuna iki scope'u yaz: `https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/datamanager`.
- [ ] "Authorize APIs" → reklam hesabına erişimi olan Google hesabıyla gir → "Exchange authorization code for tokens".
- [ ] Refresh token → `GOOGLE_ADS_REFRESH_TOKEN`.

## 4. Dönüşüm işlemleri
- [ ] Google Ads → Hedefler → Dönüşümler → Yeni dönüşüm işlemi → **İçe aktar** → **Tıklamalardan içe aktar (Website)**.
- [ ] İki işlem oluştur:
  - "Panel · Randevu" — Kategori: Randevu talep et, Değer: değer kullanma, Sayım: Bir.
  - "Panel · Kayıt" — Kategori: Satın alma/Kayıt, Değer: her dönüşüm için farklı değer (varsayılan 0 TRY), Sayım: Bir.
- [ ] Her birinin ID'si (URL'deki `ctId=` değeri) → `GOOGLE_ADS_CONVERSION_ACTION_RANDEVU`, `GOOGLE_ADS_CONVERSION_ACTION_KAYIT`.
- [ ] Teklif stratejisinde hangisinin "birincil" olacağına karar ver. Öneri: ilk 2 ay "Panel · Randevu" birincil
      (kayıt sayısı akıllı teklif için çok az), "Panel · Kayıt" ikincil.

## 5. Kampanya eşleştirmesi
- [ ] Hesap ayarları → Otomatik etiketleme **açık** (gclid için).
- [ ] Hesap düzeyi **Son URL soneki (Final URL suffix)**:
      `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}`
      Böylece sitenin yakaladığı `utm_campaign` = kampanya ID'si olur ve panel adayları kampanyaya bağlar.

## 6. Sunucu
- [ ] Yukarıdaki 8 değeri `/opt/seker/.env` dosyasına ekle, `docker compose up -d panel` ile paneli yeniden başlat.

## 7. Veri rızası ve geri çekme
- Eski siteden içe aktarılan adaylar hiçbir zaman Google'a gönderilmez. Bunların eski rızası yalnızca telefon görüşmesini kapsıyordu.
- Bir veli reklam verisi rızasını geri çekerse, o adayı Supabase SQL düzenleyicisinde (sahip tarafından) şu sorguyla işaretle:
  ```sql
  update public.leads set ad_consent_revoked_at = now() where id = '<lead-id>';
  ```
  Bu tarihten sonra bu aday Google'a bir daha gönderilmez.

## 8. Canlı doğrulama
- OAuth kontrolü, test veri gönderimi (ingest) ve cron tetikleme, yukarıdaki kimlik bilgileri ayarlandıktan sonra
  sahip tarafından yapılır. Bu adımlardan önce hiçbir şey çalıştırılmaz.
- Kontrol betiği: `apps/panel/scripts/ads/check.ts` (`ads:check`). Production değerleri yerelde
  `apps/panel/.env` dosyasına kopyalanmaz; betik panel konteynerinin içinde, konteynerin kendi ortam
  değişkenleriyle çalışır.

### 8a. Sunucuda konteyner ve betik kontrolü
- [ ] `docker compose -f /opt/seker/docker-compose.yml exec panel node --version` ile konteynerin ayakta olduğunu gör.
- [ ] Betiğin imajda bulunduğunu doğrula (`exec panel ls scripts/ads/check.ts`). Yoksa bu adımı durdur ve
      imajın betik ile `tsx` bağımlılığını içerip içermediğini kontrol et.

### 8b. Bağlantı kontrolü (OAuth, harcama, validateOnly)
- [ ] `docker compose -f /opt/seker/docker-compose.yml exec panel npx tsx scripts/ads/check.ts` çalıştır.
      Beklenen çıktı:
      ```
      1/3 OAuth: tamam
      2/3 Harcama: son 7 günde N kampanya-gün satırı
      3/3 Data Manager (validateOnly): HTTP 200 …
      ```
- [ ] 3. adımda HTTP 400 ve mesaj "gclid" ile ilgiliyse (sahte gclid) bağlantı ve yetki doğrudur; sorun yok.
- [ ] 401 veya 403 ise: §1'deki kapsamları (scope), "In production" durumunu ve Data Manager API'nin etkin
      olduğunu kontrol et.
- [ ] Betik hiçbir gizli değer yazdırmaz; çıktıyı yine de paylaşmadan önce gözden geçir.

### 8c. Cron'u bir kez elle tetikleme
- [ ] `docker compose -f /opt/seker/docker-compose.yml exec cron sh -c 'curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://panel:3000/api/cron/ads'`
      Beklenen: `{"ok":true,"spendRows":N,"sent":0,"failed":0,"skipped":0}` (N ≥ 0).
- [ ] Panel → Pazarlama tablosunda dünün harcamasının göründüğünü doğrula.

### 8d. Uçtan uca dönüşüm
- [ ] Gerçek bir reklam tıklamasıyla siteden form doldur (test adayı); panelde adayı "Randevu"ya al.
- [ ] Ertesi sabah (veya cron'u elle tetikleyerek) `/pazarlama` listesinde satırın "Gönderildi" olduğunu gör.
- [ ] Google Ads'te "Panel · Randevu" dönüşümü 24–48 saat içinde görünür (Google'ın işleme süresi).

## Token beklerken
- Google Ads → Raporlar → Kampanyalar raporu; segment "Gün"; kolonlar: Gün, Kampanya kimliği, Kampanya, Maliyet,
  Tıklamalar, Gösterimler → İndir → CSV. Panel → Pazarlama → "Harcama CSV'si yükle".
