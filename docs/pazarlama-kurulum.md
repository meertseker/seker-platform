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
- [ ] 3. adımda HTTP 400 ve `events.events[0].destination_references` / `Resource not found` (NOT_FOUND) dönerse
      bu sahte gclid'in hesapta bulunmamasıdır; bağlantı, yetki ve dönüşüm ID'si doğrudur (2026-10-16 doğrulandı).
      Dönüşüm ID'si yanlışsa `INVALID_CONVERSION_ACTION_ID`, hesap yanlışsa 403 gelir.
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

## Instagram (Meta)
Meta tarafı Google ile aynı mantıkla çalışır: değerler girilene kadar her şey "yapılandırılmamış" der, hata vermez, hiçbir şey gönderilmez ya da çekilmez. Meta hesap düzenini (7 adım) tamamlamadan bu bölümü uygulama.

### Ortam değişkenleri (`/opt/seker/.env`)
| Değişken | Ne işe yarar | Boşsa |
|---|---|---|
| `META_ACCESS_TOKEN` | Marketing API erişim belirteci (harcama okuma) | Harcama çekilmez, "yapılandırılmamış" |
| `META_APP_SECRET` | `appsecret_proof` üretimi (Graph isteklerini imzalar) | Aynı |
| `META_AD_ACCOUNT_ID` | Reklam hesabı (`act_` önekli ya da değil) | Aynı |
| `META_PIXEL_ID` | Conversions API'nin olay göndereceği piksel | CAPI gönderimi atlanır |
| `META_CAPI_TEST_CODE` | Olay Yöneticisi "Test Olayları" kodu (isteğe bağlı) | Gönderimler gerçek veriye yazılır |
| `META_CAPI_ENABLED` | CAPI ana anahtarı; yalnız `true` ise açık | Kapalı: kuyruk birikir, satırlar `bekliyor` kalır |
| `NEXT_PUBLIC_META_PIXEL_ID` | Sitedeki piksel; yalnız `NEXT_PUBLIC_CONSENT_VERSION=2` iken ve çerez bandında "Kabul Et" seçilirse yüklenir | Hiçbir Meta betiği yüklenmez (v1 iken kimlik girilmiş olsa da) |
| `NEXT_PUBLIC_CONSENT_VERSION` | Form onay metni sürümü; `2` değilse 1 | 1 (hukuk onayı gelene kadar böyle kalır) |
| `SITE_PUBLIC_URL` | Sitenin açık adresi (CAPI `Lead` olayında `event_source_url`) | `https://yeni.sekeranaokulu.com` kullanılır |

`NEXT_PUBLIC_CONSENT_VERSION` ve `NEXT_PUBLIC_META_PIXEL_ID` **sitenin (apps/web)** derlemesine gömülür; değiştirince paneli değil **siteyi (web) yeniden derle ve yayınla**. Yönetilen Meta sürümü Graph API **v26.0**.

**Yayın sırası:** migration `0016_reklam_cok_platform.sql` production veritabanına **web yayınından önce** uygulanmalı. Yeni site Instagram reklam ziyaretlerini `meta_ads` kaynağıyla sayar; `site_visit_daily` kaynak kontrolü 0016'dan önce bu değeri reddeder ve form yeni alanları (`client_user_agent`, uzun `fbclid`) yazamaz.

### Ne ne zaman çalışır
- Her gün 06:00 cron'u (`/api/cron/ads`) Google'ın yanında Meta'dan son 7 günün harcamasını **reklam düzeyinde** çeker. 7 gün geriye bakmak Meta'nın geç düzelttiği rakamları yakalar; aynı gün tekrar çalışırsa satırlar güncellenir, çoğalmaz.
- Meta yapılandırılmamışsa cron yanıtı Meta'sız halle birebir aynıdır.
- CAPI gönderimi `META_CAPI_ENABLED=true` olmadan hiç çalışmaz. Açıldığında 7 günden eski bekleyen olaylar gönderilmez (`atlandi · olay 7 günden eski`).
- `Lead` olayları ve aşama olayları (`Schedule`/`Enrolled`) ayrı isteklerde gider. Meta bir isteği kalıcı hatayla (4xx) reddederse olaylar tek tek denenir; yalnız bozuk olan `Hata` olur (elle yeniden denenir). Ağ hatası, 5xx ve 429 geçicidir: satır `Bekliyor` kalır, hata metni yazılır, ertesi sabah yeniden denenir (7 gün sınırına kadar).
- `Lead` olayı tarayıcı bilgisi (user agent) olmadan gönderilmez (`atlandi · tarayıcı bilgisi yok`); tarayıcı bilgisi yalnız çerez onayı veren velide kaydedilir.
- v2 onayı olmayan Meta velilerinin kuyruk satırları baştan `atlandi · onay sürümü eski (Meta yok)` açılır.

### Reklam bağlantı soneki
Her Instagram reklamının "URL parametreleri" alanına (ya da `meta-apply.mjs` kurulumunda `url_tags` olarak otomatik) şu yazılır:
```
utm_source=instagram&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content=<içerik kodu>
```
`<içerik kodu>` reklam adının başındaki kod (örn. `R-2645-A`). Panel reklamı `utm_medium=paid_social` ile tanır; `fbclid` tek başına reklam sayılmaz (Meta organik bağlantılara da ekler). Reklam adı içerik koduyla başlamazsa kod boş kalır ve rapor o reklamı içerik bazında eşleştiremez.

### CAPI'yi açma adımları
Sırayla, atlamadan:
1. **Hukuk onayı:** v2 onay metni (reklam amaçlı veri paylaşımı) hukuk tarafından onaylanır.
2. **Onay sürümü v2:** `NEXT_PUBLIC_CONSENT_VERSION=2`, **siteyi (web)** yeniden derle ve yayınla. Okul gizlilik sayfasını site düzenleyicide değiştirdiyse (slot `legal.gizlilik.body`), düzenlenmiş metin koddaki varsayılanın yerine geçer: v2 Meta maddeleri (Meta tıklama kimliği, `_fbc`/`_fbp`, tarayıcı bilgisi, Meta Platforms Ireland'a aktarım) oraya da elle eklenmeli. Çerez Politikası (`legal.cerez.body`) düzenlendiyse Meta pikseli çerezleri (`_fbp`, `_fbc`) de oraya eklenmeli. Piksel kimliği (`NEXT_PUBLIC_META_PIXEL_ID`) **yalnız v2 açıldıktan sonra** girilir; Olay Yöneticisi > piksel ayarlarında **Otomatik Gelişmiş Eşleştirme kapalı olmalı** (site de `autoConfig` kapalı başlatır; form alanları piksele okutulmaz). Yalnız v2 onaylı ve çerez bandında reklam çerezini kabul etmiş adaylar `Lead`; v2 onaylılar `Schedule`/`Enrolled` için gönderilir. Eski onaylılar (v1, içe aktarılan, telefon onaylı) Meta'ya hiç gitmez.
3. **Test kodu haftası:** `META_CAPI_TEST_CODE` doldur. Masaüstünden `node meta-capi-test.mjs` ile tek `Lead` test olayı gönder; Olay Yöneticisi > Test Olayları'nda görünmesini, piksel ile sunucu olayının tekilleştiğini (aynı `event_id`) ve eşleşme kalitesini bir hafta izle.
4. **Aç:** sorun yoksa `META_CAPI_TEST_CODE`'u boşalt, `META_CAPI_ENABLED=true` yap, `docker compose up -d panel`. Ertesi sabah `/pazarlama` listesinde Meta satırlarının "Gönderildi" olduğunu doğrula.

Çocuğa ait hiçbir veri (ad, yaş, doğum tarihi, semt, not) Meta'ya gitmez; yalnız SHA-256'lı telefon ve lead kimliği, çerez onayı varsa `fbc`/`fbp` ve (yalnız `Lead`'de) tarayıcı bilgisi.

### Instagram'a yayın (Paket B)
Panel onaylanan Reels'i Instagram'a kendisi gönderir (Content Publishing API: konteyner → durum → yayın). Kapalı gelir; aşağıdakiler tamamlanmadan açma.

| Değişken | Ne işe yarar | Boşsa |
|---|---|---|
| `META_INSTAGRAM_USER_ID` | Instagram işletme hesabı kimliği (zaten organik sayılar için var) | Bağlantı kartı gri "Kurulmadı", yayın yok |
| `META_FACEBOOK_PAGE_ID` | Instagram'ın bağlı olduğu Facebook sayfası. Meta Business Suite → Ayarlar → Sayfa → Sayfa kimliği | Bağlantı kartı gri, "Facebook sayfası bağlı değil" |
| `IG_PUBLISH_ENABLED` | İçerik yayını ana anahtarı; yalnız `true` ise Instagram'a gider | "Instagram'da yayınla" yalnız kayda yazar (`ad_change_log`, `uygulanmadi_kapali`), Instagram'a hiçbir istek gitmez |

- **Hesap şartları:** Instagram hesabı profesyonel (işletme) olmalı ve bir Facebook sayfasına bağlı olmalı. Sistem kullanıcısı anahtarında `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` (sayfada İşletme rolüyle `ads_management` ya da `ads_read`) izinleri.
- **Açma:** Paket B canlıya alındıktan sonra Ayarlar → Bağlantılar'da "Instagram hesabı" ve "Facebook sayfası" satırları yeşilken `IG_PUBLISH_ENABLED=true`, `docker compose up -d panel`. Kapalıyken basılan "Yayınla"lar sonradan **kendiliğinden yayınlanmaz**; Zehra yeniden basar.
- **Cron:** `*/5 7-22 * * *` → `/api/cron/content` (koordinatör crontab'a ekler). Zamanlanmış yayınlar ve Instagram'ın işlemeyi bitirmediği videolar bu koşuda tamamlanır. Gece (23:00–07:00) koşu yok; o saate planlanan yayın sabah 07:00'den sonraki ilk koşuda çıkar.
- **Günlük yayın hakkı** API'den okunur (`content_publishing_limit`); Meta sayfaları 25, 50 ve 100 diye farklı sayılar veriyor, panel hesabın gerçek sayısını gösterir.
- **Bağlantı kartları** sabah 06:00 cron'unda ve Ayarlar açılınca (15 dakika önbellekli) yenilenir. Kartlar yalnız okur; hiçbir şey yazmaz.
- **İlk gerçek yayında doğrulanacaklar:** (1) Meta imzalı Supabase video adresini indirebiliyor mu (hata 2207052 "videoyu indiremedi" gelirse bu varsayım yanlıştır; Mert'e yaz). (2) Konteyner hata durumundaki `status` metninin biçimi (panel içindeki rakamı alt kod olarak okur).

### Masaüstü betikleri
`C:\Users\meert\Desktop\seker-reklam-araclar\` içinde (repo dışı, anahtar dosyası `seker-meta-ads-anahtarlar.txt`):
- `meta-read.mjs`: yalnız okur (hesap, kampanyalar, reklam setleri, reklamlar, son 7 gün özeti).
- `meta-capi-test.mjs`: test koduyla tek `Lead` olayı.
- `meta-apply.mjs <plan.json> [--apply]`: kampanya, reklam seti ve reklamı **duraklatılmış** kurar; `--apply` yoksa yalnız doğrulama. Bütçeyi (kuruş çarpanı henüz teyitsiz) Reklam Yöneticisi'nde kontrol edip açmak sana kalır.

### Masaüstü anahtar dosyasındaki isteğe bağlı satırlar
`seker-meta-ads-anahtarlar.txt` içinde zorunlu üç satırın (`META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_AD_ACCOUNT_ID`) yanında isteğe bağlı olarak:
- `META_SITE_URL`: `meta-capi-test.mjs` için gerekli (test `Lead` olayının `event_source_url` değeri).
- `META_PAGE_ID`: `meta-apply.mjs` ile sıfırdan kreatif kurulacaksa Facebook sayfası.
- `META_INSTAGRAM_USER_ID`: aynı kreatifte kullanılacak Instagram hesabı.
