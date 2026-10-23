# Reklam Konsolu — Tasarım

Tarih: 23.10.2026 · Sahibi: Mert Şeker · Durum: onaylandı (Mert, 23.10 akşam: "hepsini bu gece shipliyoruz")

Kaynaklar (çelişkide bu belge geçerlidir):
- Onay belgesi ve 12 ekran tasarımı: https://claude.ai/artifact/G37pQjW7qanRXmTMxxe3FR (tuval: belge + Z1–Z6, O1–O3, M1–M2)
- Okul sunumu (rol rol akış): https://claude.ai/artifact/PnraphFfFKka7B8pkNsJhH
- Önceki spec (hâlâ geçerli, bu belge onun üstüne gelir): `docs/superpowers/specs/2026-10-19-reklam-suiti-design.md` (K1–K11 kararları)
- Meta API notları: `docs/superpowers/plans/2026-10-19-02-meta-api-notlari.md`

## 1. Neden

Hukuk onayı geldi (23.10). Reklam suiti Aşama 1–4 canlıda ama üç adım hâlâ panelin dışında:
Reels Instagram'da elle paylaşılıyor, yeni reklam sayfası geliştirici işi, reklam Mert ve Claude'un
masaüstü betiğiyle Reklam Yöneticisi'nde kuruluyor. Zehra haftalık döngüyü tek başına yürütemiyor.

Bu tasarımla: öğretmen teslim eder → Zehra panelde önizler, tek tıkla **yayınlar** (Reels Instagram'a,
sayfa canlı adrese) → tek tıkla **reklam testine alır** (panel Meta'da şablondan kurar) → Durdur /
Büyüt / Bütçe platforma gerçekten gider. Hiçbir alan elle doldurulmaz; 9 maddelik kontrol listesi
tamam değilse kurulum düğmesi kapalıdır.

## 2. Hedefler

- G1. **Sayfa yayını (Paket A).** Reklam sayfaları koddan çıkar, veritabanına girer. Panelde telefon ve
  masaüstü önizleme, "Sayfayı yayınla", adres önerisi; 30 saniye içinde canlı. Öğretmenin sayfa görevine
  reklam cümlesi (≤125) ve reklam başlığı (≤40) alanları.
- G2. **Instagram'a yayın (Paket B).** Kontrol kartında video oynatıcı ve Instagram önizlemesi, kapak
  karesi, "Instagram'da yayınla" (şimdi ya da saat seç), yayın durumu ve hata metni, 72 saat sayacının
  gerçek yayın saatinden başlaması, Ayarlar'da bağlantı durumu kartı. Öğretmen görevinde süre ve dikey
  biçim kontrolü.
- G3. **Panelden reklam (Paket C).** Reklam şablonu ayarları, Test ve Büyütme kampanyalarının tek seferlik
  kurulumu, "Reklam testine al" penceresi + 9 kontrol, Reels ve sayfa reklamı kurulumu, "Büyütmeye taşı",
  her kurulum `ad_change_log`'da. Canlı yazım kapalıyken "sadece göster" modu.
- G4. **Takip (Paket D, A ve C'ye dağıtıldı).** Öğretmenin "İçeriğim ne oldu" ekranı; Kampanyalar ve Bu
  hafta'da "Uygulandı · kim · ne zaman · gerekçe" satırı; Rapor'da "Reklam kayıt defteri".
- G5. Bugün canlıda çalışan hiçbir şey bozulmaz: Görev ver, Görevim, Bugün, takip sırası, Bu hafta,
  Kampanyalar, Rapor, Google senkronu, CAPI.

## 3. Hedef olmayanlar

- Google reklamı panelden kurulmaz (Paket E, sonraki tur). Sayfa·Google görevinin sayfası panelden
  yayınlanır; Google'daki 6 kampanyaya metni Mert ekler.
- Yorum ve DM yönetimi panelde yok. Zehra günde iki kez Instagram uygulamasından bakar.
- Haftalık özet e-postası / WhatsApp özeti (WhatsApp numarası gelince ayrı küçük iş).
- Mehtap Hanım için ayrı ekran yok (3b kararı): canlıdaki Bu hafta ve Rapor'a satır eklenir.
- Lead Ads (Instagram içi form), WhatsApp Business Platform.
- Yeni sayfa **şablonu** tasarımı: mevcut `LandingView` şablonu aynen kullanılır.

## 4. Kesinlikle olmaması gerekenler

- MEB kutusu (`approver_face_check`) işaretli değilken Reels'in yayınlanması ya da reklama girmesi.
- Panelin Meta'da **kampanya** kurması "Teste al" düğmesinden: yalnız reklam eklenir; kampanya ve reklam
  seti tek seferlik kurulumdan gelir.
- Aylık Meta bütçesi (`monthlyBudget.metaTl`) aşılacaksa yeni reklam ya da bütçe artışı.
- `ADS_WRITE_ENABLED !== "true"` iken Meta'ya herhangi bir POST (kampanya, reklam, kreatif, kitle dahil).
  Instagram **içerik yayını** bu bayrağa bağlı değildir; kendi bayrağı `IG_PUBLISH_ENABLED` vardır.
- Onayı olmayan veliye Meta çerezi / olayı (K9 aynen geçerli).
- Çocuk verisi (ad, yaş, semt) Meta'ya gitmesi; dışlama kitlesine veli adının gitmesi (yalnız SHA-256 telefon).
- Öğretmenin para, bütçe, veli adı ya da telefonu görmesi.
- Önizleme adresinin arama motoruna açılması ya da token'sız açılması.

## 5. Kısıtlar

- Yığın aynı: Next.js 16 (panel + web), Supabase (Postgres + RLS + Storage), Vitest, Docker + cron
  konteyneri, Lightsail. Yeni bağımlılık gerekçe ister. Sunucu bileşeninde `new Date()` yok (`lib/time`).
- **Meta Graph API v26.0** (`lib/ads/meta/config.ts`). Instagram içerik yayını için hesap profesyonel ve
  bir Facebook sayfasına bağlı olmalı; sistem kullanıcısı anahtarında `instagram_content_publish`,
  `instagram_basic`, `pages_read_engagement`, `ads_management` izinleri. Bunlar Mert'in işi; panel Z6'da
  yeşil/kırmızı gösterir, kod izin yokken "kurulmadı" durumuna düşer ve hata vermez.
- Panelden gelen Meta yazımları ilk hafta "sadece göster": panel ne yapacağını `ad_change_log`'a
  `uygulanmadi_kapali` ile yazar ve ekranda gösterir. Para birimi/bütçe çarpanı (TRY ×100) teyitsiz:
  ilk gerçek yazımdan önce `metaGetDailyBudget` ile okunan değer Reklam Yöneticisi'ndekiyle karşılaştırılır.
- Roller: `/reklam/*` yalnız `yonetici` (Mehtap, Zehra, Rüya), `/reklam/gorev-ver` ayrıca `danisman`;
  `ogretmen` yalnız `/gorevim`. Değişmez.
- Çalışma düzeni (CLAUDE.md): her paket kendi dalı ve worktree'si; main'e push, prod migration, deploy
  yalnız koordinatör. Migration numaraları koordinatörden: **0024 Paket A, 0025 Paket B, 0026 Paket C**
  (koordinatör teyit eder).
- Tasarım dili: `apps/panel/app/globals.css` token'ları, dokunma hedefi ≥44 px, ana düğme 56 px, Türkçe
  metin. Ekran tasarımları (tuval) bağlayıcı referanstır: yerleşim, adımlar, metin tonu.
- Video: Supabase Storage `CONTENT_BUCKET`, `CONTENT_VIDEO_MAX_MB` (varsayılan 50; 200'e çıkarılması
  env işi). Meta Reels: dikey 9:16, ≤ 60 sn reklam için (organik 90 sn'e kadar), MP4/MOV.

## 6. Kararlar

Mert'in onayladıkları (tuval belgesi, 23.10):
- Haftalık döngü ve 12 ekran (bölüm 8). Onay belgesindeki "turuncu kutu" kararlarına itiraz gelmedi.
- Mehtap Hanım için ayrı ekran yok; kim-ne-zaman-gerekçe satırı ve Reklam kayıt defteri eklenir.
- Google bu turda panelden kurulmaz.

Benim kararlarım (Mert itiraz etmedi; Ayarlar'dan ya da küçük işle değişir):
- **K12. Sayfa kaydı.** Yeni tablo `landing_pages` (bölüm 9). Web, kodda olmayan slug için veritabanına
  bakar; kodda sabit 5 sayfa aynen kalır ve slug çakışması yasaktır. Yayın anında panel, web'in
  yeniden doğrulama ucunu (`/api/revalidate`, gizli anahtar `WEB_REVALIDATE_SECRET`) çağırır; hedef 30 sn.
  Önizleme adresi `/lp/onizleme/<preview_token>` (`noindex`, token 32+ bayt, panelden iframe ile açılır).
- **K13. Sayfa alanları.** `content_items.page_fields` (jsonb) mevcut `lp.*` slot yapısını korur; iki yeni
  anahtar eklenir: `adPrimaryText` (≤125) ve `adHeadline` (≤40). Yayınlanınca `landing_pages.fields`'a
  kopyalanır. Yayınlanmış sayfa **panelden** düzenlenir (Z3 "Düzenle" → alanlar → yeniden yayınla);
  site düzenleyiciye bağlanması bu turun dışında (bkz. §15 B9). Görsel: öğretmen mevcut `MediaKey`
  listesinden seçer (yeni görsel yükleme yok: MEB riski).
- **K14. Adres önerisi.** Slug, başlıktan Türkçe karaktersiz üretilir (`ilk-hafta-uyum`), Zehra düzeltebilir;
  yayından sonra değişmez. Eski adres kalır; arşivlenen sayfa 410 değil, "kontenjan" genel sayfasına 302.
- **K15. Reels yayını.** Instagram Content Publishing API: `POST /{ig-user-id}/media`
  (`media_type=REELS`, `video_url`=1 saatlik imzalı Storage URL, `caption`, `thumb_offset`=kapak ms,
  `share_to_feed=true`) → durum `status_code` FINISHED olana kadar `GET /{container}` → `POST
  /{ig-user-id}/media_publish` → `GET /{media}?fields=permalink,timestamp`. İşlem kuyrukludur: "Yayınla"
  konteyneri açar ve ilk yoklamayı yapar; kalanını yeni cron `/api/cron/content` (5 dakikada bir,
  07–22, Pzt–Paz) bitirir. Zamanlanmış yayın da bu cron'dan çıkar (Meta'nın kendi zamanlaması yok).
  Günlük API sınırı (Meta: 24 saatte en çok 25 yayın, builder doğrular) panelde kalan hak olarak görünür.
- **K16. Yayın durumu alanları.** `content_items` yeni kolonlar: `ig_publish_status`
  (`yok|kuyruk|isleniyor|yayinda|hata`, varsayılan `yok`), `ig_container_id`, `ig_publish_error`,
  `ig_publish_scheduled_at`, `ig_publish_requested_by`, `ig_publish_requested_at`. Mevcut `ig_media_id`,
  `ig_published_at`, `ig_permalink` aynen kullanılır; 72 saat sayacı `ig_published_at`'ten başlar.
  Elle bağlantı yapıştırma (`linkInstagramPost`) yedek yol olarak kalır.
- **K17. Video biçim bilgisi.** Yüklemede tarayıcı `<video>` ile süre, en/boy, seçilen kapak karesi
  okunur ve `media_meta`'ya yazılır: `{ durationS, width, height, vertical, coverOffsetMs, subtitled }`.
  `subtitled` öğretmenin işaretlediği kutudur ("Altyazı ekledim"). Reels teslimi: `vertical=true`,
  `durationS ≤ 90`; reklam için ayrıca `≤ 60`. Kare seçilmezse `coverOffsetMs=1000`.
- **K18. Reklam yapısı.** Meta'da iki kalıcı kampanya: **Test** ve **Büyütme**, hedef `OUTCOME_LEADS`,
  kampanya bütçesi (CBO), her birinde tek reklam seti (optimizasyon `LEAD`, piksel `Lead` olayı, 7 gün
  tıklama + 1 gün görüntüleme, kitle şablondan). Kimlikler `app_settings.reklam_kurulum`'da
  (`{ testCampaignId, testAdsetId, scaleCampaignId, scaleAdsetId, createdAt, createdBy }`). "Teste al"
  yalnız **reklam** ekler. Reels reklamı yayınlanmış Instagram gönderisini kullanır
  (`source_instagram_media_id` + `instagram_user_id`; builder API şeklini doğrular). Sayfa reklamı
  bağlantı reklamıdır: sayfanın görseli, `adHeadline`, `adPrimaryText`, bağlantı. Reklam adı
  `"<kod> · <konu>"` (K11), `url_tags`: `utm_source=instagram&utm_medium=paid_social&utm_campaign=
  {{campaign.name}}&utm_content=<kod>`. "Büyütmeye taşı": `POST /{ad_id}/copies` ile Büyütme reklam
  setine kopyala, Test'tekini `PAUSED` yap, içeriği `kazanan` aşamasına al. Tümü PAUSED kurulup son
  adımda ACTIVE yapılır.
- **K19. Reklam şablonu.** `app_settings.reklam_sablonu`: `{ okulAdres, lat, lng, yaricapKm: 8,
  yasMin: 25, yasMax: 45, testGunlukTl: 200, buyutmeGunlukTl: 400, mevcutVelileriHaricTut: true }`.
  Z6 ekranında düzenlenir. Şablon değişince eski reklamlar değişmez; kampanya bütçesi değişikliği
  mevcut `executeAdChange` (`butce` eylemi) ile Kampanyalar'dan yapılır.
- **K20. 9 kontrol.** Bölüm 10'daki liste. Hepsi yeşil değilse "Reklamı kur ve başlat" kapalı ve eksik
  madde metinle yazar. Kontroller saf fonksiyonda (`lib/ads/preflight.ts`), test edilir.
- **K21. Kayıt.** `ad_change_log.action` yeni değerler: `kampanya_kur`, `reklam_kur`, `buyutmeye_tasi`,
  `kitle_guncelle`, `ig_yayin` (Paket B de yayınları buraya yazar). Her kayıtta `actor_id`, `reason`
  (Zehra'nın isteğe bağlı notu ya da sistem gerekçesi), `before`/`after` (gönderilen yük, anahtarsız).
  Rapor'un "Reklam kayıt defteri" bu tablodan okur.
- **K22. Canlı yazım bayrakları.** `ADS_WRITE_ENABLED` tüm Meta reklam yazımlarını kapsar (mevcut).
  `IG_PUBLISH_ENABLED` Instagram içerik yayınını kapsar (yeni, varsayılan kapalı; kapalıyken "Yayınla"
  kaydı yazar, ekranda "yayınlanmadı: kapalı"). İkisi de env; Z6'da durum olarak görünür.
- **K23. Dışlama kitlesi.** Yazılı onaylı mevcut velilerin SHA-256 telefonu Meta Custom Audience
  (`customer_file_source=USER_PROVIDED_ONLY`) olarak yüklenir; reklam setlerinde `excluded_custom_audiences`.
  Haftada bir cron günceller. Paket C'nin **son** görevi; `mevcutVelileriHaricTut=false` ise atlanır.
- **K24. Öğretmen "İçeriğim".** Öğretmen `leads`/`ad_spend_daily` okuyamaz (RLS). Sayılar `security
  definer` fonksiyon `content_owner_summary()` ile döner: içerik başına `{ leads, appointments,
  enrolled, lastSyncAt }`; para alanı yok. Arşiv kartında `learned_note` görünür.
- **K25. Kim-ne-zaman satırı.** `ad_recommendations` kararları ve `ad_change_log` kayıtları zaten
  `actor`/`decided_by` taşır; Bu hafta ve Kampanyalar kartlarında satır olarak gösterilir, yeni kolon
  gerekmez. Rapor'a "Reklam kayıt defteri" bölümü (dönem filtreli, Excel'e dahil).
- **K26. Paket D dağılımı.** D1 (İçeriğim) → Paket A dalı. D2 (uygulandı rozetleri, Bu hafta önerilerinin
  gerçek uygulanması, kayıt defteri) → Paket C dalı. D3 (`ADS_WRITE_ENABLED=true` açılışı) kod değil,
  koordinatör işi; birimler doğrulandıktan sonra.
- **K27. Önerilen başlangıç değerleri** (Mert değiştirmedi): test 200 TL/gün, büyütme 400 TL/gün,
  8 km, 25–45 yaş, hedef 1.000 TL/nitelikli veli. Hepsi Ayarlar'da.

## 7. Mevcut sistem (builder için)

- İçerik: `content_items` (0017; kolonlar bölüm 9'da listelenmez, migration'dan okunur),
  `content_organic_stats`, aşamalar `lib/content/stages.ts`, kodlar `lib/content/codes.ts`, slotlar
  `lib/content/slots.ts`, eylemler `actions/content.ts` (createContentTask, approveContent,
  requestRevision, moveContentStage, saveLearnedNote, linkInstagramPost, requestVideoUpload,
  saveContentDraft, submitContent). Guard trigger `content_items_guard` (yol, MEB, teslim kuralları).
- Ekranlar: `app/(app)/reklam/{gorev-ver,icerik,kampanyalar,hafta,ayarlar}`, `app/(app)/gorevim`,
  Rapor `app/(app)/rapor`.
- Meta: `lib/ads/meta/{config,insights,capi,sync,instagram,objects,writes}.ts`; `instagram.ts`'te
  `listMedia`, `resolveMediaId`, `fetchReelInsights`; `writes.ts`'te `metaSetStatus`,
  `metaSetDailyBudget`, `metaGetDailyBudget`. Tek yazım kapısı `lib/ads/writes.ts` `executeAdChange`
  (önce `ad_change_log`, bayrak kapalıysa `uygulanmadi_kapali`, kapı kırmızıysa gerekçe zorunlu).
- Ayarlar: `lib/ads/ad-settings.ts` (`app_settings` anahtarları), `AD_SETTING_KEYS`.
- Cron: `/api/cron/ads` 06:00 (Google + Meta harcama, CAPI, nesne senkronu, organik sayılar).
  Crontab `infra/cron/crontab`. Env `infra/docker-compose.yml`; web build-time değişkenleri
  `.github/workflows/deploy.yml` (`NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_CONSENT_VERSION`).
- Web: `apps/web/app/(lp)/lp/[slug]/page.tsx` (`generateStaticParams` ile 5 sabit slug,
  `LandingView`, `getReaderData` site düzenleyici içeriği), `content/landingPages.ts`,
  `lib/attribution.ts`, `LeadForm` → `/api/lead` → `create_web_lead`.
- Masaüstü betikleri `Desktop\seker-reklam-araclar\meta-apply.mjs` (PAUSED kurulum, ad kodla başlar,
  url_tags): Paket C bunun panel karşılığıdır; yük şekilleri oradan alınabilir.

## 8. Ekranlar (tuvaldeki tasarımlar bağlayıcı; burada veri ve kurallar)

- **Z1 Kontrol ve onay.** İçerik panosu kart detayı: `<video>` oynatıcı (imzalı URL), Instagram
  önizlemesi (hesap adı, kapak, açıklama), otomatik kontroller listesi (süre, dikey, altyazı işareti,
  yasaklı ifade, öğretmen yüz cevabı), MEB kutusu (`approver_face_check`), "Onayla ve yayına hazırla" /
  "Düzeltme iste". Onaydan sonra Z2 açılır.
- **Z2 Instagram'da yayınla.** Açıklama (düzenlenebilir, `caption`), kapak karesi (`coverOffsetMs`),
  "Şimdi" / "Saat seç", hesap kontrolleri (bağlantı, izin, günlük hak), "Instagram'da yayınla".
  Sonra kart: "Yayında · 72 saat başladı · <permalink>" ya da "Yayınlanamadı: <sebep> · Tekrar dene".
- **Z3 Sayfa önizleme ve yayın.** Telefon (390) ve masaüstü sekmesi, iframe `/lp/onizleme/<token>`;
  slug alanı; alan sayaçları; "Sayfayı yayınla". Sonra "Canlı · <adres> · Site düzenleyicide aç".
- **Z4 Reklam testine al.** Sol: reklam önizlemesi (Reels: gönderi; sayfa: görsel + başlık + cümle).
  Orta: şablondan gelenler (kampanya, bütçe, kitle, hedef, bağlantı, reklam adı). Sağ: 9 kontrol.
  "Reklamı kur ve başlat" (bayrak açıkken) / "Sadece göster, kurma" (her zaman; `uygulanmadi_kapali`
  kaydı) / "Vazgeç". Kurulduktan sonra kart "Testte · reklam <id>".
- **Z5 Kampanyalar.** Mevcut ekran + Instagram satırları (Test/Büyütme), her satırda içerik kodu;
  "Uygulandı · kim · ne zaman · gerekçe" satırı; "Büyütmeye taşı" eylemi kart menüsünde.
- **Z6 Ayarlar: bağlantılar ve şablon.** Bağlantı kartları: Instagram hesabı (`META_INSTAGRAM_USER_ID`
  + `GET /{ig-user-id}?fields=username`), Facebook sayfası (`META_FACEBOOK_PAGE_ID`), reklam hesabı,
  piksel, CAPI (`META_CAPI_ENABLED`), canlı yazım (`ADS_WRITE_ENABLED`), içerik yayını
  (`IG_PUBLISH_ENABLED`), Test/Büyütme kampanyaları (kurulu mu; "Kampanyaları kur" tek seferlik düğme).
  Altta reklam şablonu formu (K19). Durum kontrolü sabah cron'unda ve sayfa açılışında (önbellekli).
- **O1 Reels görevi.** Mevcut Görevim + biçim kontrolü (K17), kapak karesi seçimi, "Altyazı ekledim"
  kutusu, Instagram önizlemesi. Uygun olmayan video yüklenmez, sebep yazar.
- **O2 Sayfa görevi.** Mevcut alanlar + `adPrimaryText` (125) + `adHeadline` (40), sayaçlar, görsel
  seçimi (MediaKey), "Sayfayı önizle" (önizleme token'ı öğretmen için de geçerli, iframe).
- **O3 İçeriğim.** Öğretmenin içerikleri; her biri için zaman çizelgesi (teslim, onay, yayın, test,
  veli/randevu/kayıt sayıları `content_owner_summary()`), arşivde `learned_note`. Para yok.
- **M1 Bu hafta.** Mevcut ekran + öneri kartlarında kim-ne-zaman-gerekçe; Onayla → `executeAdChange`
  gerçekten çağrılır (bugün çağrılıyorsa doğrulanır, çağrılmıyorsa bağlanır).
- **M2 Rapor.** Mevcut ekran + "Reklam kayıt defteri" bölümü (`ad_change_log` dönem filtreli: tarih,
  eylem, nesne, kim, gerekçe, durum) + Excel'de ek sayfa.

## 9. Veri modeli

Paket A (0024 `landing_pages`):
```
landing_pages (
  id uuid pk, slug text unique (^[a-z0-9-]{3,60}$, kodda sabit 5 slug yasak: trigger/uygulama),
  content_id uuid unique references content_items,
  status text check in ('taslak','yayinda','arsiv') default 'taslak',
  fields jsonb not null,            -- LandingView alanları + adPrimaryText, adHeadline, mediaKey
  preview_token text unique not null,
  published_at timestamptz, published_by uuid references profiles,
  archived_at timestamptz, created_at, updated_at
)
RLS: yonetici tam; ogretmen yalnız kendi content_id'sine ait satırı okur; anon yok (web service role).
```
Paket B (0025 `ig_yayin`): `content_items` K16 kolonları; `ad_change_log.action` check'ine `ig_yayin`.
Paket C (0026 `reklam_kurulum`): `ad_change_log.action` check'ine `kampanya_kur`, `reklam_kur`,
`buyutmeye_tasi`, `kitle_guncelle`; `ad_objects.content_code` yoksa eklenir; `app_settings` tohumları
`reklam_sablonu`, `reklam_kurulum` (boş); `content_owner_summary()` K24 (D1, Paket A'da da olabilir:
**A'ya ait**, 0024 içine).

Paket B ve C **aynı check constraint'e** dokunur (`ad_change_log.action`): her migration mevcut
constraint'i düşürüp kendi listesiyle yeniden kurar; sıra A→B→C olduğundan C'nin listesi B'nin
değerlerini de içerir.

## 10. "Hiçbir şey kaçmasın": 9 kontrol (`lib/ads/preflight.ts`)

| # | Madde | Kaynak | Kırmızıysa |
|---|---|---|---|
| 1 | İçerik onaylı (`status=onaylandi`) ve MEB kutusu (`approver_face_check=true`) | Z1 | "Onaya dön" |
| 2 | Reels: `ig_publish_status=yayinda` ve `ig_published_at ≤ şimdi−72 sa`; sayfa: `landing_pages.status=yayinda` | Z2/Z3 | "Bekle" / "Yayınla" |
| 3 | Reklam adı içerik koduyla başlıyor | panel yazar | olamaz |
| 4 | Bağlantıda utm etiketleri ve `utm_content=<kod>` | panel yazar | olamaz |
| 5 | Piksel kimliği var ve `META_CAPI_ENABLED=true` | env | "Mert açar" |
| 6 | Şablon dolu; test günlük bütçesi × kalan gün ≤ aylık Meta bütçesinin kalanı | K19 + ad-settings | "Ayarlar'a git" |
| 7 | Reklam metninde (caption / adPrimaryText / adHeadline) yasaklı ifade ve öğrenci adı yok | `banned` listesi | "Düzeltme iste" |
| 8 | Reels: `vertical`, `durationS ≤ 60`, `subtitled`; sayfa: görsel seçili | `media_meta` | "Düzeltme iste" |
| 9 | Reklam hesabı okunabiliyor, Test kampanyası kurulu ve `ACTIVE`/`PAUSED` | `reklam_kurulum` + son senkron | "Kampanyaları kur" |

## 11. İş paketleri, dallar, sıra

| Paket | Dal / worktree | Migration | Kapsam | Dış şart |
|---|---|---|---|---|
| A · Sayfa yayını + İçeriğim | `feat/reklam-konsolu-a` · `../seker-platform-rk-a` | 0024 | K12–K14, K24; O2 alanları; Z3; web dinamik `/lp/[slug]` + önizleme; `/api/revalidate`; O3 | yok |
| B · Instagram'a yayın | `feat/reklam-konsolu-b` · `../seker-platform-rk-b` | 0025 | K15–K17, K22 (`IG_PUBLISH_ENABLED`); Z1 oynatıcı + önizleme; Z2; O1 biçim kontrolü; Z6 bağlantı kartları; `/api/cron/content` | IG işletme hesabı + izinler (Mert) |
| C · Panelden reklam + takip | `feat/reklam-konsolu-c` · `../seker-platform-rk-c` | 0026 | K18–K21, K23, K25; Z4; Z5 Instagram satırları, Büyütmeye taşı, uygulandı satırı; Z6 şablon formu + "Kampanyaları kur"; M1 öneri→executeAdChange; M2 kayıt defteri | Meta anahtarları (Mert, bugün); canlı yazım ilk hafta kapalı |

Birleştirme sırası **A → B → C**; ikinci ve üçüncü dal rebase eder. Paylaşılan dosyalar ve kural:
- `actions/content.ts`'e dokunulmaz; yeni eylemler **yeni dosyalarda**: A `actions/pages.ts`,
  B `actions/instagram.ts`, C `actions/ad-setup.ts`.
- İçerik panosu kart detayı (`app/(app)/reklam/icerik/*`): her paket kendi bileşen dosyasını ekler
  (`PagePublishPanel`, `ReelPublishPanel`, `AdTestPanel`) ve karta **tek satır** ekler.
- Ayarlar sayfası: B bağlantı kartları bölümünü `components/ads/ConnectionsCard.tsx`, C şablon formunu
  `components/ads/AdTemplateForm.tsx` olarak ekler; sayfaya birer satır.
- `infra/docker-compose.yml` ve `infra/cron/crontab`: yalnız ekleme; koordinatör birleştirir.
- Env eklemeleri: A `WEB_REVALIDATE_SECRET` (web + panel), `WEB_PUBLIC_URL` (panel, mevcut
  `SITE_PUBLIC_URL` varsa o); B `IG_PUBLISH_ENABLED`, `META_FACEBOOK_PAGE_ID`; C yok (mevcut META_*).
- Test: her paket `pnpm turbo run lint typecheck test` + iki `next build` yeşil; RLS testleri
  (`tests/rls/*`) yeni tablo ve fonksiyon için; Meta/IG çağrıları `fetch` sahteleriyle.

## 12. Adım 0 (koordinatör + Mert, kod yazmadan)

1. Gizlilik/çerez sayfalarına Meta maddeleri (Mert/Mehtap; hukuk onayı var).
2. `NEXT_PUBLIC_CONSENT_VERSION=2` ile web yeniden yayın (koordinatör, Mert onayıyla).
3. Meta sunucu anahtarları `.env` (Mert, bugün) → panel restart → sabah eşitlemesi; birim karşılaştırması.
4. Olay Yöneticisi'nde Otomatik Gelişmiş Eşleştirme kapalı; `NEXT_PUBLIC_META_PIXEL_ID` → web yeniden yayın.
5. Test kodu haftası (`META_CAPI_TEST_CODE`), sonra `META_CAPI_ENABLED=true`.
6. Öğretmen hesapları (2) `scripts/seed/create-staff.ts` ile; Instagram profesyonel hesap + Facebook
   sayfası + sistem kullanıcısı izinleri (Mert).
7. Paket B/C canlıya alındıktan sonra: `IG_PUBLISH_ENABLED=true` (hesap yeşilse);
   `ADS_WRITE_ENABLED=true` yalnız bir hafta "sadece göster" + bütçe birimi teyidinden sonra.

## 13. Riskler

- Instagram yayın izni / hesap düzeni (yüksek): Z6 kırmızı gösterir; B kodu izin yokken "kurulmadı".
- Bütçe çarpanı (yüksek): sadece göster haftası, okunan bütçe karşılaştırması, aylık tavan.
- Öğrenme fazı (orta): tek Test kampanyası, CBO, yeni içerik yeni reklam.
- Hesap kısıtlaması (orta): haftada en çok 4 yeni reklam; red sebebi panelde (`effective_status`,
  `ad_review_feedback`).
- Üç dal aynı gece (orta): paylaşılan dosya kuralı (bölüm 11), A→B→C sırası, her dal kendi testini
  geçirir; koordinatör birleşik testi çalıştırır.
- Video boyutu (düşük): `CONTENT_VIDEO_MAX_MB=200` env.

## 15. Builder kontrolü kararları (23.10, bağımsız okuma sonrası; bağlayıcı)

- **B1. 72 saat bilinçli.** Reels reklamı, Instagram yayınından en az 72 saat sonra teste alınır (organik
  karşılaştırma için). Preflight #2 uygular; Z4 düğme kapalı ve "72 saatten önce teste alınamaz · kalan
  <n> saat" yazar. Yönetici "72 saati bekleme" seçeneğiyle **gerekçe yazarak** geçebilir; gerekçe
  `ad_change_log.reason`'a, `gate_red=true` gibi işaretlenmez ama `source='icerik'` ve `reason` zorunlu.
  Sayfa için bekleme yok. Tetikleyici değil preflight uygular.
- **B2. `ad_change_log` mevcut kolonlarla.** Tablo değişmez; `before/after` = mevcut `old_value/new_value`.
  `source` check genişler: `'kampanyalar','oneri','icerik','ayarlar','cron'`. `level` serbest metin:
  IG yayını `'icerik'`, `reklam_kur` `'ad'`, `kampanya_kur` `'campaign'`, `kitle_guncelle` `'audience'`.
  `object_id`: IG yayını için `content_items.id`, reklam için Meta reklam kimliği (kurulmadan önce
  `content_items.id`, kurulunca satır `new_value.adId` taşır), kampanya için kampanya kimliği ya da
  `'kurulum'`. `actor_id`: cron'un bitirdiği yayında `ig_publish_requested_by`; haftalık kitle
  güncellemesinde şablonu son kaydeden (`reklam_sablonu.updatedBy`). 0025 `action` ve `source`
  check'lerini düşürüp B değerleriyle kurar; 0026 ikisini de B değerleri dahil yeniden kurar.
- **B3. Aşama akışı değişmez.** `approveContent` bugünkü gibi `status=onaylandi` yapar ve aşamayı Reels
  için `organik`, sayfa için `test`'e taşır. Yayın panelleri (Z2/Z3) bu aşamadaki **henüz yayınlanmamış**
  kartlarda görünür; 72 saat sayacı yalnız `ig_published_at` doluysa başlar. "Teste al" Reels'i
  `organik → test` taşır (`moveContentStage`), sayfada aşama zaten `test`. "Büyütmeye taşı" → `kazanan`.
  Yeni eylemler servis rolüyle yazar; `content_items_guard` yalnız öğretmen oturumunu kısıtladığı için
  migration değişikliği gerekmez.
- **B4. Meta nesneleri.** Reklam seti: `destination_type=WEBSITE`, `promoted_object={pixel_id,
  custom_event_type:'LEAD'}`, `optimization_goal=LEAD`, `billing_event=IMPRESSIONS`. Web formu pikselde
  `Lead` atar, CAPI aynı `event_id` ile tekilleşir (K9). Reels reklamı: yayınlanmış Instagram medyasını
  kullanan kreatif (`instagram_user_id` + `source_instagram_media_id` + `call_to_action{LEARN_MORE,
  link}` ve `url_tags`; builder API'den doğrular). Bu yol bağlantı ve `url_tags` taşıyamıyorsa yedek:
  aynı videoyu reklam hesabına `video_data` kreatifi olarak yükle (beğeniler ayrılır, kabul edilir;
  sabah sorusuna yazılır). Masaüstü betiği `Desktop\seker-reklam-araclar\meta-apply.mjs` okunur.
- **B5. Bayrak kapalıyken.** `IG_PUBLISH_ENABLED` kapalı: `ig_publish_status` `yok` kalır, kuyruğa
  girmez, yalnız `ad_change_log` (`uygulanmadi_kapali`); bayrak açılınca **hiçbir şey kendiliğinden
  yayınlanmaz**, Zehra tekrar basar. "Sadece göster, kurma": aşama değişmez, `ad_objects` satırı
  açılmaz, haftalık 4 reklam sayısına girmez.
- **B6. Zamanlanmış yayın ve cron.** Cron yayından hemen önce yeniden kontrol eder: `status=onaylandi`,
  `approver_face_check=true`, `stage='organik'`, `ig_publish_status in ('kuyruk','isleniyor')`. Biri
  bozulduysa `hata` + Türkçe sebep ("Onay geri alındı"). 07–22 dışına planlanan saat, pencere açılınca
  (07:00 ilk koşu) yayınlanır; Z2 saat seçerken bunu uyarır. Aktör = isteyen yönetici.
- **B7. Tek yazım kapısı.** `AdChangeAction` birliği yeni eylemlerle genişler ya da aynı
  `AdChangeStore`'u kullanan kardeş fonksiyon yazılır (builder seçer); kural: önce log, sonra bayrak,
  kırmızı kapıda `reklam_kur` ve `buyutmeye_tasi` için gerekçe zorunlu (bütçe artışıyla aynı kural);
  `kampanya_kur` ve `kitle_guncelle` kapıya bakmaz. Haftalık kapı yeni reklamı **engellemez**, gerekçe ister.
- **B8. Aylık tavan formülü (#6).** `aya_kadar_harcama(meta) + (testGunlukTl + buyutmeGunlukTl) ×
  kalan_gun ≤ monthlyBudget.metaTl`. Reklam eklemek CBO bütçesini değiştirmediği için reklam başına
  toplanmaz; formül şablon kaydında, kampanya kurulumunda ve her "Teste al"da aynı şekilde çalışır.
  `metaTl = 0` ise kırmızı: "Aylık Meta bütçesi Ayarlar'da 0".
- **B9. Web okuma ve düzenleme.** Web `landing_pages`'i doğrudan servis rolüyle okur (web'de mevcut
  Supabase sunucu istemcisi; yoksa `SUPABASE_SECRET_KEY` env eklenir ve deftere yazılır). Yayınlanmış
  sayfanın site düzenleyiciye bağlanması bu turun **dışında**; düzenleme Z3'ten yeniden yayınla.
- **B10. Arşiv yönlendirmesi.** `/lp/<arşiv-slug>` → 302 `/lp/az-mevcutlu-anaokulu`.
- **B11. İçeriğim sayıları.** `leads.content_code` (0014, `utm_content`'ten) ile `content_items.code`
  birleştirilir; randevu `appointments` üzerinden, kayıt `leads.status='kazanildi'`. C'ye bağımlı değil.
  §9'daki "`ad_objects.content_code` yoksa eklenir" 0018'de zaten var; 0026 bu maddeyi atlar.

## 14. Builder'a bırakılanlar

- Web'de dinamik LP için `dynamicParams`, önbellek etiketi ve yeniden doğrulama ucunun şekli.
- Instagram konteyner yoklama aralığı, zaman aşımı, hata eşleme metinleri (Türkçe).
- Reels reklamı için kreatif alanlarının kesin adı (API dokümanı ile doğrulanır, URL yoruma yazılır).
- `landing_pages.fields` ile `LandingView` alanlarının eşlemesi ve varsayılanları (proofPoints vb.).
- Excel'e kayıt defteri sayfası biçimi.
