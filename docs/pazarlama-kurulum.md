# Pazarlama entegrasyonu: sahibin kurulum listesi

> **Sahip notu (migrasyon sırası):** `0007` ve `0008` migrasyonları, sunucuda zaten uygulanmış `0009`'dan önce sıralanır.
> Canlıya almadan önce `npx supabase migration list` ile durumu kontrol et, ardından
> `npx supabase db push --include-all` çalıştır.

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

## 2. API erişimi (developer token artık yok)
> Google, developer token'ı **9 Eylül 2026'da kaldırdı**. Erişim düzeyi artık OAuth istemcisinin bulunduğu
> Google Cloud projesine bağlı. API Center'dan başvuru yapmayın; o başvurular işlenmiyor.
> Kaynak: https://developers.google.com/google-ads/api/docs/first-call/dev-token
- [ ] §1'deki Cloud projesinde **faturalandırma hesabı bağlı ve aktif** olsun. Free Trial veya askıdaki
      faturalandırma, Explorer onayını engelliyor (Google'ın bilinen sorunu). Google Ads API ücretsiz; bu sadece uygunluk şartı.
- [ ] Cloud Console → APIs & Services → **Google Ads API** → Overview → "Upgrade access level" → Next access level
      **Explorer** → **Apply for access**. Otomatik incelenir (canlı hesaplara günde 2.880 işlem; bizim ihtiyacımız günde ~5).
- [ ] Onay gelmeden harcama sorgusu `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` hatası verir; panel bunu
      "Explorer erişimi almadı" diye bildirir. Dönüşüm gönderimi (Data Manager API) bundan etkilenmez.
- [ ] Google Ads'te yönetici hesabı (MCC) **gerekmez**. Varsa MCC ID'si (tiresiz) → `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, yoksa boş bırak.
- [ ] Okulun reklam hesabı ID'si (sağ üstteki 123-456-7890, tiresiz) → `GOOGLE_ADS_CUSTOMER_ID`.
- Bilinen sorun: proje 9 Eylül'den önce Test düzeyinde kullanıldıysa ve sonradan yükseltildiyse `AUTHORIZATION_ERROR`
  alabilir. Çözüm: yeni bir Cloud projesi açıp oradan Explorer başvurusu.

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
- [ ] Yukarıdaki 7 değeri (`GOOGLE_ADS_LOGIN_CUSTOMER_ID` boş olabilir) `/opt/seker/.env` dosyasına ekle, `docker compose up -d panel` ile paneli yeniden başlat.

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
- Kontrol betiği `apps/panel/scripts/ads/check.ts` (`pnpm ads:check`) **yerelde**, repo kopyasından çalıştırılır.
  Konteyner içinde çalışmaz: runner imajında betik, `tsx` ve `dotenv` bulunmaz.
- Production değerleri hiçbir dosyaya yazılmaz (`apps/panel/.env` dahil). Her değer yalnızca o PowerShell
  veya bash oturumunda `export` / `$env:` ile verilir ve işi bitince temizlenir.

### 8a. Ortam değişkenlerini oturuma ver ve betiği çalıştır
Değerleri `<…>` yerlerine kendi kasanızdan yapıştırın; değerleri sohbete, dosyaya veya commit'e yazmayın.
Explorer onayı henüz gelmediyse 2. adım hata yazar ama 3. adım (dönüşüm doğrulaması) yine çalışır.

PowerShell:
```powershell
cd apps/panel
$env:GOOGLE_ADS_CLIENT_ID = "<client-id>"
$env:GOOGLE_ADS_CLIENT_SECRET = "<client-secret>"
$env:GOOGLE_ADS_REFRESH_TOKEN = "<refresh-token>"
$env:GOOGLE_ADS_CUSTOMER_ID = "<reklam-hesabi-id>"
$env:GOOGLE_ADS_LOGIN_CUSTOMER_ID = "<mcc-id>"
$env:GOOGLE_ADS_CONVERSION_ACTION_RANDEVU = "<randevu-ctid>"
$env:GOOGLE_ADS_CONVERSION_ACTION_KAYIT = "<kayit-ctid>"
pnpm ads:check
Remove-Item Env:GOOGLE_ADS_*
```

bash:
```bash
cd apps/panel
export GOOGLE_ADS_CLIENT_ID="<client-id>"
export GOOGLE_ADS_CLIENT_SECRET="<client-secret>"
export GOOGLE_ADS_REFRESH_TOKEN="<refresh-token>"
export GOOGLE_ADS_CUSTOMER_ID="<reklam-hesabi-id>"
export GOOGLE_ADS_LOGIN_CUSTOMER_ID="<mcc-id>"
export GOOGLE_ADS_CONVERSION_ACTION_RANDEVU="<randevu-ctid>"
export GOOGLE_ADS_CONVERSION_ACTION_KAYIT="<kayit-ctid>"
pnpm ads:check
unset GOOGLE_ADS_CLIENT_ID GOOGLE_ADS_CLIENT_SECRET GOOGLE_ADS_REFRESH_TOKEN \
      GOOGLE_ADS_CUSTOMER_ID GOOGLE_ADS_LOGIN_CUSTOMER_ID GOOGLE_ADS_CONVERSION_ACTION_RANDEVU GOOGLE_ADS_CONVERSION_ACTION_KAYIT
```

### 8b. Beklenen sonuç ve sorun giderme
- [ ] Beklenen çıktı:
      ```
      1/3 OAuth: tamam
      2/3 Harcama: son 7 günde N kampanya-gün satırı
      3/3 Data Manager (validateOnly): HTTP 200 …
      ```
- [ ] 2. satır `HATA — … CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION …` ise Explorer başvurusu (§2) henüz onaylanmamıştır.
- [ ] 3. adımda HTTP 400 ve mesaj "gclid" ile ilgiliyse (sahte gclid) bağlantı ve yetki doğrudur; sorun yok.
- [ ] 401 veya 403 ise: §1'deki kapsamları (scope), "In production" durumunu ve Data Manager API'nin etkin
      olduğunu kontrol et.
- [ ] Betik hiçbir gizli değer yazdırmaz; çıktıyı yine de paylaşmadan önce gözden geçir.

### 8c. Cron'u bir kez elle tetikleme (sunucu)
- [ ] Bu adım harcama çektiği için Cloud projesinin Explorer erişimi almış olması gerekir.
- [ ] `docker compose -f /opt/seker/docker-compose.yml exec cron sh -c 'curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://panel:3000/api/cron/ads'`
      Beklenen: `{"ok":true,"spendRows":N,"sent":0,"failed":0,"skipped":0}` (N ≥ 0).
- [ ] Panel → Pazarlama tablosunda dünün harcamasının göründüğünü doğrula.

### 8d. Uçtan uca dönüşüm (gerçek hesaba gerçek dönüşüm gönderir)
- [ ] Bu adım gerçek reklam hesabına gerçek bir dönüşüm gönderir; yalnızca canlı formdan, KVKK rızası verilmiş
      adaylar gönderilir. Eski siteden içe aktarılan adaylar hiçbir zaman gönderilmez (bkz. §7).
- [ ] Gerçek bir reklam tıklamasıyla siteden form doldur (test adayı); panelde adayı "Randevu"ya al.
- [ ] Ertesi sabah (veya cron'u elle tetikleyerek) `/pazarlama` listesinde satırın "Gönderildi" olduğunu gör.
- [ ] Google Ads'te "Panel · Randevu" dönüşümü 24–48 saat içinde görünür (Google'ın işleme süresi).
- [ ] Not: "Gönderildi" yalnızca Google'ın isteği kabul ettiği anlamına gelir (satırdaki `requestId: …` Data Manager yanıt
      kimliğidir); dönüşümün gerçekten hesaba yazıldığı Google Ads'te doğrulanır.

## Explorer onayı beklerken
- Google Ads → Raporlar → Kampanyalar raporu; segment "Gün"; kolonlar: Gün, Kampanya kimliği, Kampanya, Maliyet,
  Tıklamalar, Gösterimler → İndir → CSV. Panel → Pazarlama → "Harcama CSV'si yükle".
