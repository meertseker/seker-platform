# Reklam Konsolu · Paket C · Panelden reklam + takip — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Özet (5 satır)**
1. Z6'da reklam şablonu (K19) ve tek seferlik "Kampanyaları kur" (Test + Büyütme, CBO, PAUSED) eklenir; kimlikler `app_settings.reklam_kurulum`'a yazılır.
2. İçerik kartında "Reklam testine al" (Z4): 9 kontrol (`lib/ads/preflight.ts`), şablon özeti, önizleme; Reels yayınlanmış Instagram medyasından, sayfa bağlantı reklamı olarak **yalnız reklam** eklenir.
3. Her Meta yazımı tek kapıdan geçer: önce `ad_change_log`, sonra bayrak; `ADS_WRITE_ENABLED!=="true"` ya da "Sadece göster" → `uygulanmadi_kapali` + "Panel şunu kuracaktı" özeti.
4. Kampanyalar'da (Z5) Instagram reklam satırları, "Büyütmeye taşı" (`/copies`), inceleme durumu ve "Uygulandı · kim · ne zaman · gerekçe"; Bu hafta (M1) önerileri gerçek uygulamaya bağlanır.
5. Rapor'a (M2) "Reklam kayıt defteri" bölümü ve Excel sayfası; son görev mevcut veli dışlama kitlesi (K23) ve Pazartesi cron'u.

**Dal / worktree / migration:** `feat/reklam-konsolu-c` · `../seker-platform-rk-c` (işçi `origin/main`'den açar, upstream main yapılmaz) · migration **0026** `packages/db/supabase/migrations/0026_reklam_kurulum.sql` (numara koordinatörden, 23.10).

**Bağımlılıklar**
- Dış: mevcut env `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_AD_ACCOUNT_ID`, `META_PIXEL_ID`, `META_CAPI_ENABLED`, `META_INSTAGRAM_USER_ID`, `ADS_WRITE_ENABLED`, `SITE_PUBLIC_URL`; Paket B'nin eklediği `META_FACEBOOK_PAGE_ID` (C yeni env eklemez). Sistem kullanıcısında `ads_management`, `instagram_basic`, `pages_read_engagement` (Mert). Meta'da Özel Hedef Kitle şartlarının kabulü (K23, Mert).
- Kod: Paket A `apps/panel/lib/pages/store.ts` → `getLandingPageByContent(contentId)` (`status`, `slug`, `fields`); Paket B `content_items.ig_publish_status`, `ig_published_at`, `ig_media_id`, `media_meta.{vertical,durationS,subtitled}` ve `ad_change_log` check'ine `ig_yayin`. C bunları **yalnız** `apps/panel/lib/ads/preflight-sources.ts` adaptöründen okur; A/B birleşmeden önce adaptör tipli stub döner (Task 5). Rebase sonrası değişiklik tek dosyadır.
- Birleştirme sırası **A → B → C**. C rebase ederken: 0026'daki check listeleri B'nin 0025'teki değerleriyle karşılaştırılır; `lib/ads/writes.ts` tip birliğinde B'nin `ig_yayin` eklemesi korunur.

**Goal:** Zehra bir içeriği panelden tek tıkla Meta'da reklam testine alır ve büyütür; her adım kurallı, kayıtlı ve ilk hafta "sadece göster" modundadır; Mehtap Hanım kim-ne-zaman-gerekçe'yi Bu hafta, Kampanyalar ve Rapor'da görür.

**Architecture:** Meta yük şekilleri saf "adım" kurucularında (`lib/ads/meta/setup.ts`), planlar (`lib/ads/setup-plans.ts`) bu adımları şablon ve kurulum kimlikleriyle birleştirir; adımlar ancak yazım kapısı (`lib/ads/setup-gate.ts`, mevcut `AdChangeStore` ile) izin verirse `runSetupSteps` ile sırayla gönderilir. Kontroller saf fonksiyon (`runPreflight`), girdileri adaptör ve depo toplar. Sunucu eylemleri `actions/ad-setup.ts`'te; ekranlar yeni bileşen dosyalarında, mevcut sayfalara tek satırla girer.

**Tech Stack:** Next.js 16 panel, Supabase Postgres + RLS, Vitest (birim + `tests/rls`), Meta Graph/Marketing API **v26.0** (`lib/ads/meta/config.ts`), `xlsx` 0.18.5 (mevcut).

**Spec:** `docs/superpowers/specs/2026-10-23-reklam-konsolu-design.md` — §2 G3+G4 (D2), §4, §5, K18–K21, K22 (yalnız `ADS_WRITE_ENABLED`), K23, K25–K27, §8 Z4, Z5, Z6 (şablon formu), M1, M2, §9 "Paket C", §10, §11, §13, §14, **§15 B1–B8, B11 (bağlayıcı)**. Önceki spec `docs/superpowers/specs/2026-10-19-reklam-suiti-design.md` §6 (K6, K7, K10, K11, bütçe kapıları). Meta notları `docs/superpowers/plans/2026-10-19-02-meta-api-notlari.md`. Ekran tasarımları (bağlayıcı): `Z4-Test.dc.html`, `Z5-Kampanyalar.dc.html`, `Z6-Baglantilar.dc.html` (şablon bölümü), `M1-BuHafta.dc.html`, `M2-Rapor.dc.html` (tuval https://claude.ai/artifact/G37pQjW7qanRXmTMxxe3FR).

## Global Constraints

- **Canlı yazım:** `ADS_WRITE_ENABLED !== "true"` iken Meta'ya hiçbir POST yok (kampanya, reklam seti, kreatif, reklam, kopya, durum, kitle; `execution_options=validate_only` da POST'tur, yasak). GET okumaları (hesap sağlığı, inceleme durumu) serbesttir.
- **Önce kayıt:** her yazım önce `ad_change_log`'a yazılır; kayıt yazılamazsa platforma gidilmez ("Kayıt yazılamadı; değişiklik yapılmadı.").
- **Sadece göster (B5):** bayrak kapalıyken ya da "Sadece göster, kurma" seçilince durum `uygulanmadi_kapali`, `new_value` gönderilecek tüm adımları (anahtarsız) taşır, ekranda "Panel şunu kuracaktı" listesi; aşama değişmez, `ad_objects` satırı açılmaz, haftalık 4 reklam sayısına girmez. Düğme her zaman açıktır.
- **Kampanya yalnız Z6'dan (§4):** "Teste al" yalnız kreatif + reklam ekler; kampanya ve reklam seti tek seferlik kurulumdan gelir. Tümü PAUSED kurulur, son adımda ACTIVE.
- **Kırmızı kapı (B7):** `reklam_kur` ve `buyutmeye_tasi` kapı kırmızıyken en az 10 karakter gerekçe ister (`needsReason`), engellemez; `kampanya_kur` ve `kitle_guncelle` kapıya bakmaz. Kapı durumu sunucuda `loadGateStatus` ile hesaplanır.
- **72 saat (B1):** Reels yayınından (`ig_published_at`) 72 saat geçmeden kontrol #2 kırmızı: "72 saatten önce teste alınamaz · kalan <n> saat". Yönetici "72 saati bekleme" kutusu + en az 10 karakter gerekçe ile geçer; `source='icerik'`, `reason` zorunlu, `gate_red` bundan etkilenmez. Sayfada bekleme yok.
- **Aylık tavan (B8, #6):** `ay_basindan_meta_harcama_TL + (testGunlukTl + buyutmeGunlukTl) × kalan_gun (bugün dahil) ≤ monthlyBudget.metaTl`; şablon kaydında, kampanya kurulumunda, her "Teste al"da ve "Büyütmeye taşı"da aynı fonksiyon. `metaTl = 0` → kırmızı "Aylık Meta bütçesi Ayarlar'da 0". Tavan aşımı gerekçeyle geçilemez (§4).
- **Haftada en çok 4 yeni reklam (§13, B5):** Pazartesi 00:00'dan (İstanbul) beri `action='reklam_kur'` ve `status='uygulandi'` sayısı 4 ise beşinci kurulum reddedilir: "Bu hafta 4 reklam kuruldu; hesap güvenliği için yenisi gelecek Pazartesi."
- **K18 yapı:** kampanyalar "Test · Instagram" ve "Büyütme · Instagram", `objective=OUTCOME_LEADS`, `special_ad_categories=[]`, CBO `daily_budget` = TL × 100 (TRY alt birim, TEYİTSİZ), `bid_strategy=LOWEST_COST_WITHOUT_CAP`; her birinde tek reklam seti. Reklam adı `"<kod> · <konu>"` (en çok 100 karakter). İlk gerçek yazımdan önce `metaGetDailyBudget` ile okunan değer Reklam Yöneticisi ile karşılaştırılır (kılavuzda adım).
- **K19/K27 şablon varsayılanları:** `{ okulAdres: "", lat: null, lng: null, yaricapKm: 8, yasMin: 25, yasMax: 45, testGunlukTl: 200, buyutmeGunlukTl: 400, mevcutVelileriHaricTut: true }` + `updatedBy`, `updatedAt` (B2: kitle cron'unun aktörü).
- **B2 kayıt:** kolonlar değişmez (`old_value`/`new_value` = before/after). `source` ∈ `kampanyalar, oneri, icerik, ayarlar, cron`. `level`: `reklam_kur`/`buyutmeye_tasi` `'ad'`, `kampanya_kur` `'campaign'`, `kitle_guncelle` `'audience'`. `object_id`: `reklam_kur` → `content_items.id` (kurulunca `new_value.adId`), `buyutmeye_tasi` → Test reklam kimliği, `kampanya_kur` → `'kurulum'`, `kitle_guncelle` → kitle kimliği ya da `'kitle'`.
- **Gizlilik:** kitleye yalnız SHA-256 telefon gider; `ad_change_log`'a telefon ya da hash **yazılmaz** (yalnız sayı). Çocuk adı/yaşı/semti Meta'ya gitmez. Erişim anahtarı ve `appsecret_proof` hiçbir kayda, hata metnine, ekrana girmez (`sanitize`).
- **Roller:** tüm eylemler `requireRole("yonetici")`; gizli anahtarlı istemci yalnız rol doğrulandıktan sonra. Rapor kayıt defteri yalnız yönetici (danışmanda bölüm yok).
- **Kod kuralları:** sunucu bileşeninde `new Date()` yok (`requestClock`/`requestNow`, `lib/time`); `actions/content.ts`'e dokunulmaz; içerik kartına ve Ayarlar sayfasına **tek satır**; Türkçe metin; `globals.css` token'ları; dokunma ≥ 44 px, ana düğme 56 px. Meta URL'leri kod yorumunda (aşağıdaki "Doğrulanan API bilgileri").
- **Push, `db push`, deploy, prod SQL yok** (işçi). Migration'ı koordinatör `execute_sql` + `schema_migrations` satırı `0026` ile uygular; kod yeni kolonlara (`ad_objects.effective_status`, `review_feedback`) dayandığı için 0026 main push'tan önce prod'a girmelidir.

## Doğrulanan API bilgileri (23.10, resmi sayfalar; v26.0 en yeni, 29.07.2026)

| Konu | Karar | Durum | Kaynak |
|---|---|---|---|
| Reels'i reklamda kullanma | Kreatif: `object_id` = Facebook sayfa kimliği, `instagram_user_id`, `source_instagram_media_id`; isteğe bağlı `call_to_action` (`LEARN_MORE` + bağlantı) | TEYİTLİ (alanlar); CTA+medya birleşik JSON örneği görülmedi | https://developers.facebook.com/docs/instagram/ads-api/guides/use-posts-as-ads |
| `instagram_actor_id` | Kaldırıldı; `instagram_user_id` kullanılır | TEYİTLİ (v22.0 changelog) | https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog/version22.0.md |
| Öne çıkarılamayan medya | Telifli müzik, etkileşimli öğe/filtre; önce `boost_eligibility_info` okunur | TEYİTLİ | yukarıdaki "use posts as ads" |
| `url_tags` | Kreatifte üst düzey metin; IG medya kreatifinde etkisi belirsiz | KISMEN | https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/adcreatives |
| Kampanya | `OUTCOME_LEADS`, `special_ad_categories` zorunlu dizi, `status` yalnız ACTIVE/PAUSED, bütçe kampanyada ya da sette | TEYİTLİ; `[]` kabulü masaüstü betiğinde kullanılıyor | https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/campaigns |
| Bütçe birimi | `daily_budget` alt birimde; TRY ofset 100 | Set için TEYİTLİ, kampanya için çıkarım | https://developers.facebook.com/docs/marketing-api/currencies |
| `custom_locations` | `{latitude, longitude, radius, distance_unit:'kilometer'}`, 1–80 km | TEYİTLİ | https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/basic-targeting.md |
| Advantage+ kitle | `targeting_automation.advantage_audience` 0/1; v23'ten beri varsayılan 1; 1 iken `age_max` 65'e sabitlenir | TEYİTLİ | https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/targeting-expansion/advantage-audience |
| Dışlama | `excluded_custom_audiences` (`exclusions` içinde özel kitle artık yok) | TEYİTLİ; `[{id}]` şekli varsayım | v22.0 changelog |
| Optimizasyon hedefi | Web formu + piksel için `OFFSITE_CONVERSIONS` + `promoted_object{pixel_id, custom_event_type:'LEAD'}`; düz `LEAD` değeri dokümanda görülmedi | VARSAYIM (masaüstü betiği de `OFFSITE_CONVERSIONS`) | https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/adsets |
| Reklam | `POST /act_<id>/ads` `name, adset_id, creative={creative_id}, status` → `{id}` | TEYİTLİ | https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/boost-existing-post.md |
| Kopya | `POST /<ad_id>/copies` `adset_id`, `status_option` (PAUSED varsayılan), `rename_options.rename_strategy` (`NO_RENAME`) → `{copied_ad_id}` | TEYİTLİ | https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/adgroup |
| Kitle | `POST /act_<id>/customaudiences` `subtype=CUSTOM`, `customer_file_source=USER_PROVIDED_ONLY`; `POST /<id>/usersreplace` `payload{schema:["PHONE"],data:[[hash]]}` + `session{session_id,batch_seq,last_batch_flag,estimated_num_total}`, 10.000/istek; telefon: rakam, ülke kodu, baştaki 0 yok, SHA-256 küçük hex; şart kabul edilmemişse hata 200 / 1870090 | TEYİTLİ (şart linki teyitsiz) | https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/guides/custom-audiences.md |
| İnceleme | `effective_status` (PENDING_REVIEW, DISAPPROVED, WITH_ISSUES, …), `ad_review_feedback{global:{anahtar:açıklama}}` | TEYİTLİ | https://developers.facebook.com/docs/marketing-api/reference/adgroup-review-feedback/ |
| Hesap | `account_status` (1 aktif, 2 kapalı, 3 ödenmemiş, 7, 8, 9, 100, 101), `disable_reason`, `currency` | TEYİTLİ | https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account |

## Kararlar (builder)

- Ruling: reklam seti `optimization_goal = "OFFSITE_CONVERSIONS"` (tek sabit `ADSET_OPTIMIZATION_GOAL`, `lib/ads/meta/setup.ts`), `destination_type=WEBSITE`, `promoted_object={pixel_id, custom_event_type:"LEAD"}`. Spec B4 `LEAD` yazıyor; dokümanda web hedefi için `LEAD` değeri görülmedi, masaüstü betiği `OFFSITE_CONVERSIONS` kullanıyor. — cost if wrong: ilk canlı kurulumda Meta reddeder (log `hata`, PAUSED nesne yok); sabit tek satırda değişir. Koordinatöre soru olarak gider.
- Ruling: izleme etiketleri bölünür: bağlantının kendisi `?utm_source=instagram&utm_medium=paid_social&utm_content=<kod>` taşır, kreatifin `url_tags`'i yalnız `utm_campaign={{campaign.id}}`. K18'deki `{{campaign.name}}` yerine **kimlik**: Kampanyalar ekranı Meta velisini `utm_campaign = kampanya kimliği` ile eşliyor (`lib/ads/campaigns.ts`) ve masaüstü betiği de kimlik kullanıyor. — cost if wrong: Meta IG medya kreatifinde `url_tags`'i yok sayarsa kampanya satırının veli sayısı eksik kalır, reklam satırı (`utm_content`) doğru kalır.
- Ruling: `targeting_automation.advantage_audience = 0`, `publisher_platforms = ["instagram"]`, ilgi alanı yok ("geniş hedefleme"). 1 iken 25–45 yaş Meta'da 65'e açılır. — cost if wrong: daha dar envanter; şablona alan eklemek küçük iş.
- Ruling: Reels reklamının bağlantısı = aynı haftanın Instagram sayfası (`S-<yyww>-I`) `yayinda` ise onun adresi, değilse `/lp/az-mevcutlu-anaokulu` (B10'un genel sayfası). Şablonda alan yok. — cost if wrong: Zehra farklı sayfa ister; şablona `reelsSayfaSlug` eklenir.
- Ruling: Z6 şablon değişikliği `ad_change_log`'a yazılmaz (K21 eylem listesinde değer yok); "Son değişiklik: <ad> · <tarih>" `reklam_sablonu.updatedBy/updatedAt`'ten. — cost if wrong: M2 tasarımındaki "Reklam şablonu: …" satırı defterde görünmez; 0026'ya `sablon` eylemi eklemek tek satır (soru listesinde).
- Ruling: M2 kayıt defteri yalnız `ad_change_log`'dan (K25). Tasarımdaki "onayladı · MEB", "sayfayı yayınladı", "Haftanın konusu", "CAPI açıldı" satırları bu turda yok. — cost if wrong: defter tasarımdan kısa görünür; okuma anında birleştirme ayrı küçük iş.
- Ruling: kurulum yarıda kalırsa (ör. kreatif kuruldu, reklam kurulamadı) kayıt `hata`, `new_value.ids` kurulan kimlikleri taşır, `reklam_kurulum`/`ad_objects`/aşama değişmez, ekranda "Yarım kalan nesneler (hepsi DURAKLATILMIŞ): <kimlikler>". Geri alma (silme) denenmez. — cost if wrong: Reklam Yöneticisi'nde harcamasız öksüz nesne kalır; Mert siler.
- Ruling: "Sadece göster" kontroller kırmızıyken de çalışır (tasarım: "her zaman"); kayıtta `new_value.checklist` saklanır. — cost if wrong: yok; hiçbir şey uygulanmaz.
- Ruling: Z4 açılışında hesap sağlığı canlı GET ile okunur (5 sn zaman aşımı); okunamazsa #9 kırmızı. — cost if wrong: pencere en çok 5 sn geç açılır.
- Ruling: `content_items.stage` değişimi mevcut `moveContentStage` ile (B3); "Teste al" başarıyla uygulanınca Reels `organik→test`, sayfa zaten `test`; "Büyütmeye taşı" `test→kazanan`. İçerik kartındaki mevcut "Teste al" aşama düğmesi (Aşama 3) dokunulmadan kalır. — cost if wrong: kart iki yol gösterir; kart dosyası A/B/C'nin ortak dosyası olduğu için temizlik koordinatörün birleştirmesinden sonra.
- Ruling: M1'de `teste_al` önerisinin "Onayla"sı Z4'ü açar (öneri kimliğiyle); sunucuda `approveRecommendation` Meta `teste_al` için "Reklam testine al penceresinden onaylayın." döner. `buyut` (Meta) "Onayla" → `moveToScale`. `sonucsuz` yalnız aşama (bugünkü gibi). — cost if wrong: arşive alınan içeriğin reklamı Kampanyalar'dan ayrıca durdurulur.
- Ruling: sayfa reklamında görsel `picture` = site adresi + medya yolu (`.webp`). Meta'nın webp kabulü TEYİTSİZ. — cost if wrong: ilk sayfa reklamı `hata`; yedek `POST /act/adimages` (bytes) ayrı küçük iş.
- Ruling: B'nin `ConnectionsCard`'ı da "Test ve Büyütme kampanyaları" satırı gösterirse ikisi çakışır; C kendi kartını (`AdSetupCard`) şablon bölümünün üstüne koyar. — cost if wrong: Z6'da çift satır; birleştirmede biri silinir.

## Review Focus

1. **Çift tıklama / iki yönetici aynı anda "Reklamı kur":** ikinci istek reklam açmamalı ("Bu içerik için reklam zaten kuruldu ya da kuruluyor."). Test: Task 10 `aynı içerik ikinci kez kurulamaz`.
2. **Yarıda kalan Meta kurulumu:** kreatif kuruldu, reklam patladı → kayıt `hata` + kurulan kimlikler, aşama ve `ad_objects` değişmez, anahtar sızmaz. Test: Task 7 ve Task 10.
3. **Bayrak açıkken "Sadece göster":** hiç `fetch` POST'u yok, aşama değişmez, `ad_objects`'e satır yok, haftalık sayıya girmez. Test: Task 7 ve Task 10.
4. **72 saat ve kırmızı kapı istemci atlatılarak:** eylem doğrudan `skip72h:true` ile ama gerekçesiz çağrılırsa, ya da kapı kırmızıyken gerekçesiz → `needsReason`, kayıt yazılmaz. Test: Task 10.
5. **Hesap para birimi TRY değil ya da hesap kısıtlı:** kuruş çarpanı yanlış olur; #9 kırmızı ("Hesap para birimi TRY değil (USD)" / "Reklam hesabı kısıtlı: …"). Test: Task 6.

---

### Task 1: Migration 0026 — kayıt check'leri, inceleme kolonları, tohumlar

**Files:**
- Create: `packages/db/supabase/migrations/0026_reklam_kurulum.sql`
- Modify: `packages/db/src/database.types.ts` (üretilir)
- Test: `apps/panel/tests/rls/reklam-kurulum.test.ts`

**Interfaces:**
- Produces (DB):
  - `alter table public.ad_change_log drop constraint if exists ad_change_log_action_check`; yeniden: `action in ('pause','resume','budget','ig_yayin','kampanya_kur','reklam_kur','buyutmeye_tasi','kitle_guncelle')`.
  - `drop constraint if exists ad_change_log_source_check`; yeniden: `source in ('kampanyalar','oneri','icerik','ayarlar','cron')`. (B 0025 başka `source` değeri eklediyse rebase'de listeye katılır.)
  - `ad_objects` yeni kolonlar: `effective_status text`, `review_feedback text` (`ad_objects.content_code` 0018'de var, B11: eklenmez).
  - İndeks: `create index if not exists idx_ad_change_log_action_created on public.ad_change_log (action, created_at desc)`.
  - Tohumlar (`on conflict (key) do nothing`): `reklam_sablonu = {"okulAdres":"","lat":null,"lng":null,"yaricapKm":8,"yasMin":25,"yasMax":45,"testGunlukTl":200,"buyutmeGunlukTl":400,"mevcutVelileriHaricTut":true,"updatedBy":null,"updatedAt":null}`, `reklam_kurulum = {}`.
  - RLS değişmez (0018: okuma `is_yonetici()`, yazma service_role; `app_settings` mevcut politikalar).

- [ ] **Step 1: Write the failing test** `tests/rls/reklam-kurulum.test.ts` (`tests/rls/yonetici.test.ts` deseni, `helpers.ts`):
  - `ad_change_log yeni eylem ve kaynakları kabul eder`: admin ile `action:'reklam_kur', source:'icerik', level:'ad'`, `'kampanya_kur'/'ayarlar'/'campaign'`, `'kitle_guncelle'/'cron'/'audience'`, `'ig_yayin'/'icerik'` insert başarılı.
  - `bilinmeyen eylem ve kaynak reddedilir`: `action:'sil'` → 23514; `source:'web'` → 23514.
  - `eski eylemler hâlâ geçer`: `pause/kampanyalar`, `budget/oneri`.
  - `ad_objects inceleme kolonları yazılır`: `effective_status:'DISAPPROVED', review_feedback:'…'`.
  - `şablon ve kurulum tohumları var`: `reklam_sablonu.yaricapKm === 8`, `testGunlukTl === 200`, `reklam_kurulum` boş nesne.
  - `danışman ve öğretmen ad_change_log okuyamaz` (0018 kuralı korunur).
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/rls/reklam-kurulum.test.ts` → FAIL.
- [ ] **Step 3:** Migration'ı yaz (başta yorum: "0025 (B) `ig_yayin` ekler; bu dosya B değerleri dahil yeniden kurar").
- [ ] **Step 4:** `pnpm --filter @seker/db exec supabase db reset`, `pnpm --filter @seker/db gen:types`, test → PASS; `cd apps/panel && npx vitest run tests/rls` → PASS.
- [ ] **Step 5: Commit** `feat(db): reklam kurulum kaydı, inceleme durumu ve şablon tohumları (0026)`

### Task 2: Şablon (K19) ve kurulum (K18) ayarları + aylık tavan (B8)

**Files:**
- Create: `apps/panel/lib/ads/ad-template.ts`, `apps/panel/lib/ads/ad-setup.ts`
- Test: `apps/panel/tests/unit/ad-template.test.ts`, `apps/panel/tests/unit/ad-setup-settings.test.ts`

**Interfaces:**
- Produces (`ad-template.ts`):
  - `type AdTemplate = { okulAdres: string; lat: number | null; lng: number | null; yaricapKm: number; yasMin: number; yasMax: number; testGunlukTl: number; buyutmeGunlukTl: number; mevcutVelileriHaricTut: boolean; updatedBy: string | null; updatedAt: string | null }`
  - `AD_TEMPLATE_KEY = "reklam_sablonu"`, `DEFAULT_AD_TEMPLATE` (Global Constraints değerleri).
  - `parseAdTemplate(value: unknown): AdTemplate` — bozuk alan varsayılana.
  - `type AdTemplateInput = Omit<AdTemplate, "updatedBy" | "updatedAt">`
  - `validateAdTemplate(input: unknown): { ok: true; value: AdTemplateInput } | { error: string }` — `okulAdres` 5–200 karakter; `lat` −90..90, `lng` −180..180 (ikisi de sayı); `yaricapKm` tam sayı 1–80; `yasMin` 18–65, `yasMax` `yasMin`..65; bütçeler tam sayı 50–100.000 TL; `mevcutVelileriHaricTut` boolean. Hata metinleri Türkçe ("Yarıçap 1–80 km olmalı.").
  - `templateGaps(t: AdTemplate): string[]` — `["Okul adresi", "Okul konumu"]` gibi eksikler; boşsa şablon dolu.
  - `remainingDaysInMonth(today: string): number` (bugün dahil; `2026-11-10` → 21).
  - `type CapCheck = { ok: boolean; needTl: number; leftTl: number; leftPct: number | null; message: string }`
  - `monthlyCapCheck(i: { monthSpendTl: number; testGunlukTl: number; buyutmeGunlukTl: number; metaTl: number; today: string }): CapCheck` — B8 formülü; `needTl = monthSpendTl + (test+büyütme) × kalan`; `leftTl = metaTl − monthSpendTl`; `leftPct = metaTl>0 ? round(leftTl/metaTl×100) : null`. Mesajlar: tamamsa `"Bütçe şablondan; aylık bütçenin %<leftPct>'ü kaldı"` (Türkçe ek: `%64'ü`, `%60'ı` — `percentSuffix` yardımcısı), `metaTl=0` → `"Aylık Meta bütçesi Ayarlar'da 0"`, aşımda `"Aylık Meta bütçesi yetmiyor: ay sonuna <needTl> TL gerekiyor, bütçe <metaTl> TL"`.
  - `getAdTemplate(supabase: SupabaseClient): Promise<AdTemplate>`
- Produces (`ad-setup.ts`):
  - `type AdSetup = { testCampaignId: string; testAdsetId: string; scaleCampaignId: string; scaleAdsetId: string; exclusionAudienceId: string | null; createdAt: string; createdBy: string }`
  - `AD_SETUP_KEY = "reklam_kurulum"`, `parseAdSetup(value: unknown): AdSetup | null` — dört kimlik `^\d{1,30}$` değilse null.
  - `getAdSetup(supabase): Promise<AdSetup | null>`

- [ ] **Step 1: Write the failing tests:**
  - `varsayılan şablon K27`: `parseAdTemplate({})` → `yaricapKm 8, yasMin 25, yasMax 45, testGunlukTl 200, buyutmeGunlukTl 400, mevcutVelileriHaricTut true, lat null`.
  - `validate`: yarıçap 0 → hata; `yasMax 70` → hata; `yasMin 30, yasMax 25` → hata; bütçe `"200"` (metin) → hata; geçerli girdi `ok`.
  - `templateGaps`: boş adres ve null konum → iki eksik.
  - `remainingDaysInMonth("2026-11-10") === 21`, `("2026-02-28") === 1` (2026 artık yıl değil).
  - `monthlyCapCheck`: harcama 6.000, bütçe 18.000, test 200 + büyütme 400, `2026-11-10` → `needTl = 6000 + 600×21 = 18.600` → `ok:false`, mesaj "ay sonuna 18.600 TL gerekiyor, bütçe 18.000 TL"; aynı girdide `metaTl 20000` → `ok:true`, `leftPct 70`, mesaj `"Bütçe şablondan; aylık bütçenin %70'i kaldı"`; `metaTl 0` → "Aylık Meta bütçesi Ayarlar'da 0".
  - `parseAdSetup({})` → null; dört kimlik varken nesne; `exclusionAudienceId` yoksa null.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/ad-template.test.ts tests/unit/ad-setup-settings.test.ts` → FAIL.
- [ ] **Step 3:** Uygula (`lib/ads/ad-settings.ts` desenine uy; `AD_SETTING_KEYS`'e dokunma).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): reklam şablonu, kurulum kimlikleri ve aylık tavan hesabı`

### Task 3: Meta kurulum adımları ve gönderici (`lib/ads/meta/setup.ts`)

**Files:**
- Create: `apps/panel/lib/ads/meta/setup.ts`, `apps/panel/tests/fixtures/meta-setup-responses.json`
- Test: `apps/panel/tests/unit/ads-meta-setup.test.ts`

**Interfaces:**
- Consumes: `MetaConfig`, `appSecretProof`, `META_GRAPH_BASE`, `META_GRAPH_API_VERSION` (`./config`); `headers`, `toApiError`, `MetaApiError`, `sanitize` (`./insights`); `AdTemplate` (Task 2).
- Produces:
  - `type Ref = { $ref: string }`; `ref(key: string): Ref`.
  - `type SetupStep = { key: string; label: string; path: string | { ref: string; suffix: string }; params: Record<string, unknown>; result: "id" | "copied_ad_id" | "success" }` — `path` düz metin (`"act_42/campaigns"`, `"120000111"`) ya da önceki adımın kimliğiyle kurulan yol (`{ ref:"ad", suffix:"" }` → `"/<ad kimliği>"`, `{ ref:"copy", suffix:"" }`).
  - `ADSET_OPTIMIZATION_GOAL = "OFFSITE_CONVERSIONS"`, `TRY_MINOR_PER_TL = 100` (yorum: TEYİTSİZ, currencies URL), `tlToMinor(tl: number): number`.
  - `createCampaign(adAccountId: string, o: { key: string; name: string; dailyBudgetTl: number }): SetupStep` — params `{ name, objective:"OUTCOME_LEADS", status:"PAUSED", special_ad_categories:[], daily_budget: tlToMinor, bid_strategy:"LOWEST_COST_WITHOUT_CAP" }`.
  - `createAdSet(adAccountId, o: { key; name; campaign: string | Ref; pixelId: string; template: AdTemplate; excludedAudience: string | Ref | null }): SetupStep` — params `{ name, campaign_id, status:"PAUSED", billing_event:"IMPRESSIONS", optimization_goal: ADSET_OPTIMIZATION_GOAL, destination_type:"WEBSITE", promoted_object:{ pixel_id, custom_event_type:"LEAD" }, attribution_spec:[{event_type:"CLICK_THROUGH",window_days:7},{event_type:"VIEW_THROUGH",window_days:1}], targeting:{ geo_locations:{ custom_locations:[{ latitude, longitude, radius: yaricapKm, distance_unit:"kilometer" }] }, age_min, age_max, publisher_platforms:["instagram"], targeting_automation:{ advantage_audience:0 }, excluded_custom_audiences?: [{ id }] } }`.
  - `createReelCreative(adAccountId, o: { key; name; pageId; igUserId; igMediaId; link; urlTags }): SetupStep` — params `{ name, object_id: pageId, instagram_user_id, source_instagram_media_id, call_to_action:{ type:"LEARN_MORE", value:{ link } }, url_tags }`.
  - `createLinkCreative(adAccountId, o: { key; name; pageId; igUserId: string | null; imageUrl; message; headline; link; urlTags }): SetupStep` — params `{ name, url_tags, object_story_spec:{ page_id, instagram_user_id?, link_data:{ link, message, name: headline, picture: imageUrl, call_to_action:{ type:"LEARN_MORE", value:{ link } } } } }`.
  - `createAd(adAccountId, o: { key; name; adsetId: string; creative: string | Ref }): SetupStep` — `{ name, adset_id, creative:{ creative_id }, status:"PAUSED" }`.
  - `setObjectStatus(o: { key; objectId: string | Ref; status: "ACTIVE" | "PAUSED"; label }): SetupStep` — `POST /<id>` `{status}`, `result:"success"`.
  - `copyAdToAdset(o: { key; adId: string; adsetId: string }): SetupStep` — `POST /<adId>/copies` `{ adset_id, status_option:"PAUSED", rename_options:{ rename_strategy:"NO_RENAME" } }`, `result:"copied_ad_id"`.
  - `runSetupSteps(cfg: MetaConfig, steps: SetupStep[], fetchFn?: FetchFn): Promise<{ ok: true; ids: Record<string, string> } | { ok: false; ids: Record<string, string>; failedKey: string; error: string }>` — sırayla; her `Ref` (iç içe dahil) önceki adımın kimliğiyle çözülür, çözülemezse hata; gövde form-urlencoded, nesne/dizi değerleri `JSON.stringify`, `appsecret_proof` gövdede, anahtar yalnız başlıkta (`meta/writes.ts` `postObject` deseni); 30 sn zaman aşımı; hata metni `sanitize`.
  - `type AccountHealth = { readable: boolean; active: boolean; status: number | null; currency: string | null; text: string }`
  - `readAccountHealth(cfg, fetchFn?, timeoutMs = 5000): Promise<AccountHealth>` — `GET /<act>?fields=account_status,disable_reason,currency,name`; metin: `1` → "Sağlıklı", diğerleri Türkçe ("Kapalı", "Ödenmemiş bakiye", "Risk incelemesinde", …), okunamazsa `{ readable:false, text:"Reklam hesabı okunamadı" }`. Hata atmaz.
  - `reviewLabel(effectiveStatus: string | null, feedback: string | null): string | null` — `PENDING_REVIEW`/`IN_PROCESS` → "İncelemede", `DISAPPROVED` → `"Reddedildi: <feedback>"` (feedback yoksa "Reddedildi"), `WITH_ISSUES` → "Sorunlu", diğerleri null.
  - `reviewFeedbackText(raw: unknown): string | null` — `{global:{k:v}}` değerlerini " · " ile birleştirir, 300 karaktere kısaltır.
  - Dosya başı yorumda "Doğrulanan API bilgileri" tablosundaki URL'ler.

- [ ] **Step 1: Write the failing tests** (`fetchFn` sahte, fixture yanıtları):
  - `kampanya yükü`: `createCampaign("act_42",{key:"test",name:"Test · Instagram",dailyBudgetTl:200}).params` → `daily_budget 20000`, `objective "OUTCOME_LEADS"`, `status "PAUSED"`, `special_ad_categories []`.
  - `reklam seti yükü`: `radius 8`, `distance_unit "kilometer"`, `age_min 25`, `age_max 45`, `advantage_audience 0`, `destination_type "WEBSITE"`, `promoted_object.custom_event_type "LEAD"`, `attribution_spec` iki öğe; `excludedAudience null` iken `excluded_custom_audiences` anahtarı yok.
  - `Reels kreatifi`: `source_instagram_media_id`, `instagram_user_id`, `object_id` = sayfa, `call_to_action.type "LEARN_MORE"`, `instagram_actor_id` anahtarı **yok**.
  - `runSetupSteps ref çözer`: kampanya `{id:"111"}` → reklam seti gövdesinde `campaign_id=111`; kreatif `{id:"222"}` → reklam gövdesinde `creative={"creative_id":"222"}`; kopya yanıtı `{copied_ad_id:"333"}` → `ids.copy === "333"`.
  - `ikinci adım patlarsa ilk kimlik döner`: `{ ok:false, ids:{campaign:"111"}, failedKey:"adset" }`, hata metninde erişim anahtarı ve `appsecret_proof` yok.
  - `anahtar URL'de değil`: tüm çağrılarda URL `access_token` içermez, `authorization: Bearer` başlıkta.
  - `readAccountHealth`: `{account_status:1,currency:"TRY"}` → `active true`; `{account_status:3}` → "Ödenmemiş bakiye"; ağ hatası → `readable false`, hata atmaz.
  - `reviewLabel("DISAPPROVED","Yanıltıcı iddia")` → `"Reddedildi: Yanıltıcı iddia"`.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/ads-meta-setup.test.ts` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS; `npx vitest run tests/unit/ads-writes.test.ts` değişmeden PASS.
- [ ] **Step 5: Commit** `feat(panel): Meta kurulum adımları (kampanya, set, kreatif, reklam, kopya) ve hesap sağlığı`

### Task 4: Kurulum planları ve "Panel şunu kuracaktı" özeti (`lib/ads/setup-plans.ts`)

**Files:**
- Create: `apps/panel/lib/ads/setup-plans.ts`
- Test: `apps/panel/tests/unit/ads-setup-plans.test.ts`

**Interfaces:**
- Consumes: Task 3 adım kurucuları, `AdTemplate`, `AdSetup` (Task 2).
- Produces:
  - `type PlannedChange = { steps: SetupStep[]; summary: string[] }`
  - `adName(code: string, topic: string): string` — `"<kod> · <konu>"`, 100 karakterde kesilir, her zaman kodla başlar.
  - `adLink(siteBase: string, slug: string, code: string): string` — `<base>/lp/<slug>?utm_source=instagram&utm_medium=paid_social&utm_content=<kod>`; `siteBase` sondaki `/` atılır.
  - `adUrlTags(): string` — `"utm_campaign={{campaign.id}}"`.
  - `REELS_FALLBACK_SLUG = "az-mevcutlu-anaokulu"`.
  - `planCampaignSetup(i: { adAccountId: string; pixelId: string; template: AdTemplate; excludedAudienceId: string | null }): PlannedChange` — adımlar `testCampaign`, `testAdset`, `scaleCampaign`, `scaleAdset` (adlar "Test · Instagram", "Test · Okul çevresi <n> km", "Büyütme · Instagram", "Büyütme · Okul çevresi <n> km"); özet: `"Kampanya: Test · Instagram · 200 TL/gün · DURAKLATILMIŞ"`, `"Reklam seti: okul çevresi 8 km · 25–45 yaş · Lead (web formu) · 7 gün tıklama, 1 gün görüntüleme"`, büyütme için aynısı, dışlama varsa `"Mevcut veliler hariç"`.
  - `type AdSource = { kind: "reels"; igMediaId: string } | { kind: "sayfa"; imageUrl: string; headline: string; primaryText: string }`
  - `planAdTest(i: { adAccountId; setup: AdSetup; code; name; link; urlTags; source: AdSource; pageId: string; igUserId: string | null; activateCampaign: boolean; activateAdset: boolean }): PlannedChange` — adımlar: `creative` (Reels/bağlantı), `ad` (PAUSED, `adset_id = setup.testAdsetId`), gerekirse `activateCampaign`/`activateAdset` (Test kampanyası/seti PAUSED ise), son `activateAd`. Özet satırları: `"Kreatif: Instagram gönderisi <igMediaId> · düğme Daha fazla bilgi → <link>"` / `"Kreatif: sayfa görseli + "<headline>" + "<primaryText>" → <link>"`, `"Reklam: <ad> → Test · Instagram (reklam seti <id>), önce DURAKLATILMIŞ"`, `"Test kampanyası açılır"` (gerekirse), `"Reklam açılır (ACTIVE)"`.
  - `planMoveToScale(i: { setup: AdSetup; testAdId: string; adName: string; activateCampaign: boolean; activateAdset: boolean }): PlannedChange` — `copy` (`copyAdToAdset` → `setup.scaleAdsetId`), gerekirse büyütme kampanya/set açılışı, `activateCopy` (`ref("copy")` ACTIVE), `pauseTest` (Test reklamı PAUSED). Özet: `"Kopya: <ad> → Büyütme · Instagram"`, `"Kopya açılır"`, `"Test'teki reklam durur"`.

- [ ] **Step 1: Write the failing tests:**
  - `adName` uzun konuda 100 karakter ve `R-2644-A · ` ile başlar.
  - `adLink("https://yeni.sekeranaokulu.com/","ilk-hafta-uyum","R-2644-A")` → `"https://yeni.sekeranaokulu.com/lp/ilk-hafta-uyum?utm_source=instagram&utm_medium=paid_social&utm_content=R-2644-A"`.
  - `planCampaignSetup` 4 adım, sırası `testCampaign, testAdset, scaleCampaign, scaleAdset`; test set `campaign_id` = `ref("testCampaign")`; büyütme bütçesi `40000`.
  - `planAdTest` Reels: adım anahtarları `["creative","ad","activateAd"]` (kampanya/set açıksa), PAUSED kampanyada `["creative","ad","activateCampaign","activateAdset","activateAd"]`; reklam adımında `adset_id` = Test set kimliği; hiçbir adım `/campaigns` ya da `/adsets` yoluna POST etmez (§4).
  - `planMoveToScale` kopya `adset_id` = büyütme seti, son adım Test reklamını PAUSED yapar.
  - Özet satırları Türkçe ve anahtar/hash içermez.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): reklam kurulum planları ve "panel şunu kuracaktı" özeti`

### Task 5: Kaynak adaptörü (A/B sözleşmeleri) ve 9 kontrol (`lib/ads/preflight.ts`)

**Files:**
- Create: `apps/panel/lib/ads/preflight-sources.ts`, `apps/panel/lib/ads/preflight.ts`
- Test: `apps/panel/tests/unit/ads-preflight.test.ts`, `apps/panel/tests/unit/ads-preflight-sources.test.ts`

**Interfaces:**
- Consumes: `checkText` (`lib/content/checks.ts`), `AdTemplate`, `CapCheck`, `templateGaps` (Task 2), `AdSetup` (Task 2), `AccountHealth` (Task 3).
- Produces (`preflight-sources.ts`, dosya başında not: "A (`lib/pages/store.ts`) ve B (0025 kolonları) birleşene kadar stub; rebase sonrası yalnız bu dosya değişir"):
  - `type IgPublishStatus = "yok" | "kuyruk" | "isleniyor" | "yayinda" | "hata"`
  - `type ContentForAd = { id; code; topic; kind: "reels" | "sayfa"; platform: "instagram" | "google"; stage: string; status: string; approverFaceCheck: boolean; caption: string | null; igMediaId: string | null; igPermalink: string | null; igPublishedAt: string | null; igPublishStatus: IgPublishStatus; mediaMeta: { vertical: boolean | null; durationS: number | null; subtitled: boolean | null } }`
  - `type LandingForAd = { status: "taslak" | "yayinda" | "arsiv"; slug: string; headline: string | null; primaryText: string | null; imageUrl: string | null }`
  - `loadContentForAd(db: SupabaseClient, contentId: string): Promise<ContentForAd | null>` — **stub (B öncesi):** `ig_publish_status` seçilmez, `ig_published_at` doluysa `"yayinda"`, değilse `"yok"`; `media_meta` eski biçimde (`durationSec`) de okunur. **B sonrası:** `ig_publish_status` kolonundan, `media_meta.{vertical,durationS,subtitled}`.
  - `loadLandingForAd(db, contentId: string, siteBase: string): Promise<LandingForAd | null>` — **stub (A öncesi):** `null` döner. **A sonrası:** `getLandingPageByContent(contentId)` → `status`, `slug`, `fields.adHeadline`, `fields.adPrimaryText`, görsel `fields.mediaKey` → A'nın panel tarafı medya eşlemesinden mutlak adres.
  - `loadWeekInstagramPageSlug(db, reelsCode: string): Promise<string | null>` — aynı haftanın `S-<yyww>-I` içeriği için `loadLandingForAd` `yayinda` ise slug; stub'da null.
- Produces (`preflight.ts`):
  - `type PreflightKey = "onay" | "yayin" | "ad" | "utm" | "piksel" | "butce" | "metin" | "bicim" | "hesap"`
  - `type PreflightItem = { key: PreflightKey; ok: boolean; label: string; fix: string | null }`; `type PreflightResult = { ok: boolean; items: PreflightItem[] }`
  - `type PreflightInput = { content: ContentForAd; landing: LandingForAd | null; adName: string; link: string; urlTags: string; pixelId: string | null; capiEnabled: boolean; template: AdTemplate; cap: CapCheck; banned: string[]; studentNames: string[]; account: AccountHealth | null; setup: AdSetup | null; testCampaignStatus: string | null; pageId: string | null; igUserId: string | null; now: Date; skip72hReason: string | null }`
  - `REELS_MIN_HOURS = 72`, `REELS_AD_MAX_S = 60`, `MIN_REASON = 10`.
  - `runPreflight(i: PreflightInput): PreflightResult` — 9 madde §10 sırasıyla; metinler (Z4 tonu):
    1. ok `"Onaylı, MEB kutusu işaretli"`; kırmızı `"Onaylı değil ya da MEB kutusu işaretsiz"` / fix `"Onaya dön"`.
    2. Reels ok `"Instagram'da yayında <n> saat"`; yayında değil `"Instagram'da yayında değil"` / `"Önce Instagram'da yayınla"`; 72 saatten önce `"72 saatten önce teste alınamaz · kalan <n> saat"` / `"Bekle"`; geçiş gerekçeyle (≥10) ok `"72 saat beklenmedi · gerekçe yazıldı"`. Sayfa ok `"Sayfa yayında · /lp/<slug>"`; değil `"Sayfa henüz yayında değil: önce Sayfayı yayınla."` / `"Yayınla"`.
    3. ok `"Ad içerik koduyla başlıyor"`; kırmızı `"Reklam adı içerik koduyla başlamıyor"` / `"Panel hatası · Mert'e haber verin"`.
    4. ok `"Bağlantıda utm ve kod"` — bağlantı sorgusunda `utm_source=instagram`, `utm_medium=paid_social`, `utm_content=<kod>` ve `urlTags` `utm_campaign=` içerir; kırmızı fix aynı (3).
    5. ok `"Piksel bağlı, CAPI açık"`; kırmızı `"Piksel ya da Conversions API kapalı"` / `"Mert açar"`.
    6. `templateGaps` boş ve `cap.ok` → ok `cap.message`; eksikte `"Reklam şablonu eksik: <eksikler>"`, tavanda `cap.message`; fix `"Ayarlar'a git"`.
    7. Reels `caption`, sayfa `headline` + `primaryText`; `checkText` yasaklı → `"\"<ifade>\" kanıt ister"`; öğrenci adı (aktif öğrencilerin ilk adı, ≥3 harf, Türkçe küçük harf, tam kelime) → `"Metinde öğrenci adı var: <ad>"`; ok `"Yasaklı ifade / öğrenci adı yok"`; fix `"Düzeltme iste"`.
    8. Reels ok `"Dikey, <n> sn, altyazılı"`; kırmızılar `"Video dikey değil"`, `"Video <n> sn; reklam için en çok 60 sn"`, `"Altyazı işaretli değil"`, bilgi yoksa `"Video biçim bilgisi yok"`; sayfa ok `"Sayfa görseli seçili"` / `"Sayfa görseli seçilmemiş"`; fix `"Düzeltme iste"`.
    9. ok `"Reklam hesabı sağlıklı, Test kampanyası var"`; sırayla kırmızılar: kurulum yok `"Test kampanyası kurulmamış"` / `"Kampanyaları kur"`; hesap okunamadı `"Reklam hesabı okunamadı"`; para birimi `"Hesap para birimi TRY değil (<cur>)"`; kısıtlı `"Reklam hesabı kısıtlı: <text>"`; Test kampanyası durumu `ACTIVE`/`PAUSED` değil `"Test kampanyası silinmiş ya da arşivde"`; sayfa kimliği yok `"Facebook sayfası bağlı değil · Mert ekler"`; Reels'te `igUserId`/`igMediaId` yok `"Instagram gönderi kimliği yok"`; fix (kurulum dışı) `"Mert'e haber verin"`.
  - `preflightBlockText(r: PreflightResult): string | null` — ilk kırmızı maddenin metni (Z4 düğme altı).

- [ ] **Step 1: Write the failing tests** (`ads-preflight.test.ts`, temiz bir `baseInput()` fixture'ı: Reels, 74 saat önce yayında, 34 sn dikey altyazılı, şablon dolu, tavan tamam, hesap `TRY` aktif, kurulum var):
  - `hepsi yeşil`: `ok true`, 9 madde, etiketler `"Instagram'da yayında 74 saat"`, `"Dikey, 34 sn, altyazılı"`.
  - `70 saatte kırmızı ve kalan 2 saat`; aynı girdi `skip72hReason:"Erken başlamak istiyoruz, kontenjan az"` → #2 ok `"72 saat beklenmedi · gerekçe yazıldı"`; 5 karakterlik gerekçe → hâlâ kırmızı.
  - `MEB kutusu işaretsiz → #1 kırmızı "Onaya dön"`.
  - `sayfa yayında değil → "Sayfa henüz yayında değil: önce Sayfayı yayınla."`; sayfada 72 saat kuralı yok.
  - `"En iyi okul" açıklama → #7 "\"en iyi\" kanıt ister"`; `"Elif ile ilk gün"` + `studentNames:["Elif Yılmaz"]` → `"Metinde öğrenci adı var: Elif"`; `"Elifba"` yakalanmaz (tam kelime).
  - `61 sn → "Video 61 sn; reklam için en çok 60 sn"`.
  - `currency "USD" → #9 "Hesap para birimi TRY değil (USD)"` (Review Focus 5); `setup null → "Kampanyaları kur"`; `testCampaignStatus "ARCHIVED"` → kırmızı.
  - `cap.ok false → #6 kırmızı, metin cap mesajı`.
  - `utm_content başka kod → #4 kırmızı`.
- [ ] **Step 2: Write the failing adapter tests** (`ads-preflight-sources.test.ts`, sahte `db`): stub'da `ig_published_at` dolu satır `igPublishStatus "yayinda"`, boş `"yok"`; eski `media_meta {durationSec: 34}` → `durationS 34`, `vertical null`; `loadLandingForAd` stub `null`.
- [ ] **Step 3:** Testler → FAIL.
- [ ] **Step 4:** Uygula.
- [ ] **Step 5:** Testler → PASS.
- [ ] **Step 6: Commit** `feat(panel): reklam öncesi 9 kontrol ve A/B kaynak adaptörü`

### Task 6: Hesap sağlığı ve inceleme durumunun sabah senkronu

**Files:**
- Modify: `apps/panel/lib/ads/meta/objects.ts` (reklam alanlarına `effective_status,ad_review_feedback`), `apps/panel/lib/ads/objects-store.ts` (`AdObjectSyncRow` + upsert yükü `effective_status`, `review_feedback`; yeni `insertCreatedAdObjects`), `apps/panel/lib/ads/campaigns.ts` (`CampaignObject`'e `effectiveStatus`, `reviewFeedback`; `CampaignRow`'a `adsetId: string | null`, `review: string | null`), `apps/panel/lib/queries/campaigns.ts` (yeni kolonları seçer)
- Test: `apps/panel/tests/unit/ads-objects.test.ts`, `apps/panel/tests/unit/campaigns.test.ts` (genişletilir)

**Interfaces:**
- Consumes: `reviewLabel`, `reviewFeedbackText` (Task 3).
- Produces:
  - `AdObjectSyncRow` ek alanlar `effectiveStatus?: string | null; reviewFeedback?: string | null` (yalnız reklam satırlarında dolu).
  - `insertCreatedAdObjects(db: SupabaseClient, rows: AdObjectSyncRow[]): Promise<void>` — panelin kurduğu nesneleri **temizlik yapmadan** upsert eder (sabah senkronu Meta'dan aynı satırları görür, silmez); reklam satırında `content_code` verilir ve `ad_content_links` aynı kodla upsert edilir (`linked_by` = aktör).
  - `CampaignRow.review` = `reviewLabel(effectiveStatus, reviewFeedback)`; `CampaignRow.adsetId` = Meta reklam satırında üst set kimliği.
- [ ] **Step 1: Write the failing tests:** Meta reklam yanıtında `effective_status:"DISAPPROVED", ad_review_feedback:{global:{a:"Yanıltıcı iddia"}}` → satır `effectiveStatus "DISAPPROVED"`, `reviewFeedback "Yanıltıcı iddia"`; `buildCampaignRows` reklam satırı `review "Reddedildi: Yanıltıcı iddia"`, `adsetId` dolu; `insertCreatedAdObjects` `delete` çağırmaz ve `ad_content_links` upsert eder; mevcut `ads-cron-objects.test.ts` ve `campaigns.test.ts` beklentileri yalnız yeni alanlar eklenerek PASS.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/ads-objects.test.ts tests/unit/campaigns.test.ts tests/unit/ads-cron-objects.test.ts` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): Meta reklam inceleme durumu senkronu ve panelin kurduğu nesnelerin kaydı`

### Task 7: Tek yazım kapısının kurulum kolu (`lib/ads/setup-gate.ts`, B7)

**Files:**
- Modify: `apps/panel/lib/ads/writes.ts` (yalnız tipler + `updateLog` yaması), 
- Create: `apps/panel/lib/ads/setup-gate.ts`
- Test: `apps/panel/tests/unit/ads-setup-gate.test.ts`; `apps/panel/tests/unit/ads-writes.test.ts` değişmeden PASS

**Interfaces:**
- Consumes: `AdChangeStore`, `GateStatus`, `adsWriteEnabled` (`lib/ads/writes.ts`), `runSetupSteps`, `SetupStep` (Task 3), `PlannedChange` (Task 4).
- Produces (`writes.ts` değişikliği):
  - `export type AdLogAction = "pause" | "resume" | "budget" | "ig_yayin" | "kampanya_kur" | "reklam_kur" | "buyutmeye_tasi" | "kitle_guncelle"`; `export type AdLogSource = "kampanyalar" | "oneri" | "icerik" | "ayarlar" | "cron"`.
  - `AdChangeLogRow.action: AdLogAction`, `source: AdLogSource`, `level: "campaign" | "adset" | "ad" | "audience"`, `platform: "google" | "meta"`.
  - `AdChangeStore.updateLog(id: string, patch: { status: AdChangeStatus; error: string | null; newValue?: Record<string, unknown> })`; `supabaseAdChangeStore` `newValue` verilirse `new_value` yazar. `executeAdChange` davranışı değişmez.
- Produces (`setup-gate.ts`):
  - `type SetupAction = "kampanya_kur" | "reklam_kur" | "buyutmeye_tasi" | "kitle_guncelle"`
  - `type SetupChangeInput = { action: SetupAction; level: "campaign" | "ad" | "audience"; objectId: string; objectName: string; source: AdLogSource; mode: "kur" | "goster"; reason?: string; extraReasonRequired?: string | null; recommendationId?: string; oldValue: Record<string, unknown> | null; planned: PlannedChange; logExtra?: Record<string, unknown>; logSteps?: boolean }` — `extraReasonRequired` (ör. 72 saat) doluysa ve gerekçe < 10 → `needsReason`; `logSteps:false` adım parametrelerini kayda yazmaz (kitle: hash'ler).
  - `type SetupDeps = { store: AdChangeStore; actorId: string; env: Record<string, string | undefined>; gateStatus: () => Promise<GateStatus>; run: (steps: SetupStep[]) => ReturnType<typeof runSetupSteps> }`
  - `type SetupResult = { ok: true; status: "uygulandi"; ids: Record<string, string>; message: string } | { ok: true; status: "uygulanmadi_kapali"; summary: string[]; message: string } | { error: string; needsReason?: boolean; ids?: Record<string, string> }`
  - `executeSetupChange(deps: SetupDeps, input: SetupChangeInput): Promise<SetupResult>` — sıra: doğrula → `mode==="kur"` ve eylem `reklam_kur|buyutmeye_tasi` ise kapı (hesaplanamazsa "Bu haftanın kapıları hesaplanamadı; şimdilik kurulamaz.") kırmızıysa ve gerekçe < 10 → `{ error: "Bir kapı kırmızı (<etiketler>). Yine de yapacaksanız nedenini yazın (en az 10 karakter).", needsReason: true }`; `extraReasonRequired` kuralı → kayıt (`old_value`, `new_value = { mode, summary, steps?: [{key,label,path,params}], ...logExtra }`, `gate_red`, `reason`, `status`: uygulanacaksa `"hata"` + `"Platform yanıtı bekleniyor"`, değilse `"uygulanmadi_kapali"`) → uygulanmayacaksa (`mode==="goster"` ya da bayrak kapalı) `{ status:"uygulanmadi_kapali", summary, message:"Kaydedildi · uygulanmadı: sadece göster" | "Kaydedildi · uygulanmadı: canlı yazım kapalı" }` → `run(steps)` → başarıda `updateLog(... "uygulandi", newValue: {...önceki, ids})`; hatada `updateLog("hata", error, newValue: {..., ids})` ve `{ error: "Uygulanamadı: <metin> · kayda geçti" + (kurulan varsa " · Yarım kalan nesneler (hepsi DURAKLATILMIŞ): <ids>"), ids }`.

- [ ] **Step 1: Write the failing tests** (sahte store ve `run`):
  - `bayrak kapalı: run çağrılmaz, kayıt uygulanmadi_kapali, new_value.steps var, summary döner`.
  - `bayrak açık + goster: run çağrılmaz, mesaj "sadece göster"` (Review Focus 3).
  - `kırmızı kapı reklam_kur gerekçesiz → needsReason, insertLog çağrılmaz`; gerekçeyle → `gate_red true`.
  - `kırmızı kapı kampanya_kur ve kitle_guncelle gerekçe istemez` (gateStatus çağrılmaz).
  - `goster modunda kırmızı kapı gerekçe istemez`.
  - `extraReasonRequired + 5 karakter → needsReason`.
  - `kayıt yazılamazsa run çağrılmaz`.
  - `run yarıda patlarsa: updateLog hata + ids, hata mesajı kimlikleri yazar` (Review Focus 2).
  - `logSteps false iken new_value.steps yok`.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/ads-setup-gate.test.ts` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS; `npx vitest run tests/unit/ads-writes.test.ts tests/unit/ad-changes-action.test.ts` PASS; `pnpm --filter @seker/panel typecheck` temiz.
- [ ] **Step 5: Commit** `feat(panel): kurulum eylemleri için tek yazım kapısı (önce kayıt, sonra bayrak)`

### Task 8: Kurulum deposu ve şablon/kampanya eylemleri (`saveAdTemplate`, `setupMetaCampaigns`)

**Files:**
- Create: `apps/panel/lib/ads/setup-store.ts`, `apps/panel/actions/ad-setup.ts`
- Test: `apps/panel/tests/unit/ad-setup-actions.test.ts`

**Interfaces:**
- Consumes: Task 2–4, 6, 7; `loadGateStatus`, `supabaseAdChangeStore` (`lib/ads/writes.ts`); `getAdSettings`; `readMetaConfig`.
- Produces (`setup-store.ts`, yalnız gizli anahtarlı istemciyle):
  - `type SetupStore = { template(): Promise<AdTemplate>; saveTemplate(v: AdTemplateInput, actorId: string, at: string): Promise<void>; setup(): Promise<AdSetup | null>; saveSetup(s: AdSetup): Promise<void>; monthMetaSpendTl(today: string): Promise<number>; objectStatus(level: "campaign" | "adset", id: string): Promise<string | null>; activeStudentNames(): Promise<string[]>; weekLaunches(sinceIso: string): Promise<number>; launchInFlight(contentId: string, sinceIso: string): Promise<boolean>; testAdForCode(code: string, testAdsetId: string): Promise<{ adId: string; name: string; status: string | null }[]> }`
  - `supabaseSetupStore(db: SupabaseClient): SetupStore` — `monthMetaSpendTl` ay başından bugüne `ad_spend_daily` `platform='meta'` (`lib/queries/campaigns.ts` `loadMonthSpend` hesabı, TL); `launchInFlight`: aynı `object_id` için `reklam_kur` ve (`status='uygulandi'` ya da `status='hata'` ve `error='Platform yanıtı bekleniyor'` ve son 10 dk) ya da `ad_objects` Test setinde aynı `content_code`.
- Produces (`actions/ad-setup.ts`, `"use server"`):
  - `saveAdTemplate(input: AdTemplateInput): Promise<{ ok: true; message: string } | { error: string }>` — yönetici; `validateAdTemplate`; B8 `monthlyCapCheck` (ok değilse mesajıyla reddeder); `reklam_sablonu` upsert (`updatedBy`, `updatedAt`); `revalidatePath("/reklam/ayarlar")`; mesaj "Kaydedildi".
  - `setupMetaCampaigns(opts: { mode: "kur" | "goster" }): Promise<SetupResult>` — yönetici; Meta yapılandırması yoksa "Meta bağlı değil"; kurulum varsa "Test ve Büyütme kampanyaları zaten kurulu."; piksel yoksa "Piksel kimliği yok · Mert ekler"; `templateGaps` boş değilse "Reklam şablonu eksik: …"; B8; `planCampaignSetup` (`excludedAudienceId: null`; K23 Task 15'te bağlanır); `executeSetupChange` (`kampanya_kur`, `level:"campaign"`, `objectId:"kurulum"`, `source:"ayarlar"`); uygulandıysa `saveSetup` + `insertCreatedAdObjects` (2 kampanya `PAUSED`, bütçe mikro = TL×1.000.000, `budget_resource` = kampanya kimliği; 2 set aynı bütçeyi devralır) → mesaj "✓ Test ve Büyütme kampanyaları kuruldu (DURAKLATILMIŞ)".
- [ ] **Step 1: Write the failing tests** (`ad-changes-action.test.ts` mock deseni):
  - `danışman şablon kaydedemez ve kurulum yapamaz` (gizli istemci oluşturulmaz).
  - `şablon tavanı aşıyorsa kaydedilmez` (B8), `metaTl 0` mesajı.
  - `şablon updatedBy ve updatedAt ile yazılır`.
  - `kurulum zaten varsa reddedilir`, `şablon eksikse reddedilir`.
  - `bayrak kapalı: Meta'ya istek yok, reklam_kurulum yazılmaz, sonuç summary taşır`.
  - `bayrak açık + kur: 4 POST (/campaigns, /adsets, /campaigns, /adsets), reklam_kurulum dört kimlikle yazılır, ad_objects'e 4 satır`.
  - `yarıda patlarsa reklam_kurulum yazılmaz`.
- [ ] **Step 2:** Test → FAIL. **Step 3:** Uygula. **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): reklam şablonu kaydı ve tek seferlik Test/Büyütme kurulumu`

### Task 9: Z4 bağlamı — önizleme verisi ve plan (`previewAdTest`)

**Files:**
- Create: `apps/panel/lib/ads/ad-test-context.ts`
- Modify: `apps/panel/actions/ad-setup.ts`
- Test: `apps/panel/tests/unit/ad-test-context.test.ts`

**Interfaces:**
- Consumes: Task 2–5, 8; `readMetaConfig`; `getAdSettings` (`banned`, `monthlyBudget.metaTl`); `loadGateStatus`; `env.META_FACEBOOK_PAGE_ID` (B), `SITE_PUBLIC_URL` (yoksa `https://yeni.sekeranaokulu.com`).
- Produces:
  - `type AdTestView = { contentId; code; kind; topic; preview: { kind: "reels"; caption: string | null; permalink: string | null } | { kind: "sayfa"; imageUrl: string | null; headline: string | null; primaryText: string | null }; rows: { label: string; value: string; sub: string | null }[]; checklist: PreflightResult; blockText: string | null; needs72hOverride: boolean; hoursLeft: number | null; gateRed: string[]; writeEnabled: boolean; existing: { adId: string; review: string | null } | null }`
  - `rows` sırası ve metni (Z4): `Kampanya` "Test · Instagram" / "<test> TL/gün, kampanya bütçesi · <n> reklam çalışıyor"; `Reklam adı`; `Kitle` "Şeker Anaokulu çevresi <km> km" / "<min>–<max> yaş · geniş hedefleme" + (`mevcutVelileriHaricTut` ve kitle varsa) " · mevcut veliler hariç"; `Hedef` "Lead (web formu)" / "piksel + Conversions API · 7 gün tıklama, 1 gün görüntüleme"; `Bağlantı` adres / "?<sorgu>"; `Kayıt` "Kuran: <ad> · eski/yeni değer kayda geçer".
  - `buildAdTestContext(deps: { db: SupabaseClient; store: SetupStore; env; fetchFn; now: Date; actorName: string }, contentId: string, opts: { skip72hReason: string | null }): Promise<{ view: AdTestView; planned: PlannedChange | null; content: ContentForAd; setup: AdSetup | null } | { error: string }>` — Reels bağlantı slug'ı: `loadWeekInstagramPageSlug` ya da `REELS_FALLBACK_SLUG`; hesap sağlığı yalnız Meta yapılandırılmışsa canlı okunur.
  - `previewAdTest(contentId: string): Promise<AdTestView | { error: string }>` (eylem, yönetici).
- [ ] **Step 1: Write the failing tests:** Reels bağlam satırları Z4 metinleriyle; aynı haftanın sayfası yayında değilse bağlantı `/lp/az-mevcutlu-anaokulu?utm_source=instagram&utm_medium=paid_social&utm_content=R-2644-A`; 70 saatte `needs72hOverride true`, `hoursLeft 2`; Meta yapılandırılmamışken `fetch` hiç çağrılmaz ve #9 kırmızı; mevcut Test reklamı varsa `existing.adId` dolu; sayfa içeriğinde (A stub) `preview.imageUrl null` ve #2/#8 kırmızı.
- [ ] **Step 2:** Test → FAIL. **Step 3:** Uygula. **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): reklam testi önizleme bağlamı (şablon, kontroller, plan)`

### Task 10: "Reklam testine al" eylemi (`launchAdTest`)

**Files:**
- Modify: `apps/panel/actions/ad-setup.ts`
- Test: `apps/panel/tests/unit/ad-launch-action.test.ts`

**Interfaces:**
- Consumes: Task 6–9; `moveContentStage` (`actions/content.ts`, değiştirilmez); `supabaseRecommendationStore` (`lib/ads/recommendations.ts`).
- Produces:
  - `launchAdTest(contentId: string, opts: { mode: "kur" | "goster"; reason?: string; skip72h?: boolean; recommendationId?: string }): Promise<SetupResult & { checklist?: PreflightResult }>` — sıra: yönetici → `buildAdTestContext` (`skip72hReason = skip72h ? reason : null`) → `mode==="kur"` ise: kontrol kırmızıysa `{ error: blockText, checklist }`; `launchInFlight` → "Bu içerik için reklam zaten kuruldu ya da kuruluyor." (Review Focus 1); `weekLaunches ≥ 4` → Global Constraints metni → `executeSetupChange` (`reklam_kur`, `level:"ad"`, `objectId: content.id`, `objectName: adName`, `source: recommendationId ? "oneri" : "icerik"`, `extraReasonRequired: skip72h ? "72 saat" : null`, `logExtra: { contentCode, checklist }`) → uygulandıysa: `insertCreatedAdObjects` (reklam satırı: `parent_id` Test set, `campaign_id` Test kampanya, `status "ACTIVE"`, `content_code`; açılan kampanya/set satırı `ACTIVE`) → Reels `organik` ise `moveContentStage(id,"test")` (hata kayda engel değil, mesaja eklenir) → `recommendationId` varsa öneri `claim` + `finish(result)` → mesaj `"Testte · reklam <adId>"`. `goster` modunda kontrol, haftalık sayı ve "zaten kuruldu" denetimleri **uygulanmaz**, aşama ve `ad_objects` değişmez.
  - `revalidatePath` `/reklam/icerik`, `/reklam/kampanyalar`, `/reklam/hafta`.
- [ ] **Step 1: Write the failing tests:**
  - `bayrak kapalı + kur: POST yok, kayıt uygulanmadi_kapali, moveContentStage çağrılmaz, insertCreatedAdObjects çağrılmaz`.
  - `bayrak açık + goster: POST yok, aşama değişmez, haftalık sayıya girmez` (Review Focus 3).
  - `bayrak açık + kur, hepsi yeşil: POST sırası /adcreatives, /ads, /<ad> status=ACTIVE; /campaigns ve /adsets'e POST yok; aşama organik→test; ad_objects + ad_content_links`.
  - `aynı içerik ikinci kez kurulamaz` (Review Focus 1).
  - `beşinci reklam reddedilir`.
  - `skip72h + gerekçesiz → needsReason, kayıt yok`; `kırmızı kapı + gerekçesiz → needsReason` (Review Focus 4).
  - `kontrol kırmızıyken kur reddedilir ve checklist döner`.
  - `reklam adımı patlarsa: kayıt hata + creative kimliği, aşama ve ad_objects değişmez` (Review Focus 2).
  - `danışman çağıramaz`.
  - `öneriden gelince öneri onaylandı ve sonuç yazıldı; source "oneri"`.
- [ ] **Step 2:** Test → FAIL. **Step 3:** Uygula. **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): reklam testine al (yalnız reklam ekler, kayıtlı, sadece göster modu)`

### Task 11: "Büyütmeye taşı" eylemi ve Bu hafta önerilerinin gerçek uygulanması (M1)

**Files:**
- Modify: `apps/panel/actions/ad-setup.ts`, `apps/panel/actions/recommendations.ts`, `apps/panel/lib/ads/recommendations.ts` (`RecommendationRow.decidedBy`, `REC_COLUMNS` + `decided_by`)
- Test: `apps/panel/tests/unit/ad-scale-action.test.ts`, `apps/panel/tests/unit/ads-recommendations.test.ts` (genişletilir)

**Interfaces:**
- Consumes: Task 4 `planMoveToScale`, Task 7, Task 8 `testAdForCode`, `moveContentStage`.
- Produces:
  - `moveToScale(contentId: string, opts: { mode: "kur" | "goster"; reason?: string; source?: "kampanyalar" | "oneri"; recommendationId?: string }): Promise<SetupResult>` — yönetici; kurulum yoksa "Önce Ayarlar'da Test ve Büyütme kampanyalarını kurun."; `testAdForCode` 0 → "Bu içeriğin Test'te reklamı yok."; >1 → "Bu koda bağlı birden fazla Test reklamı var; Kampanyalar'dan seçin."; B8 tavanı (`kur`); `executeSetupChange` (`buyutmeye_tasi`, `level:"ad"`, `objectId: testAdId`, `source` varsayılan `"kampanyalar"`); uygulandıysa kopya satırı (`parent_id` büyütme seti, `content_code`, `ACTIVE`) + Test reklamı `PAUSED` (`insertCreatedAdObjects`), `moveContentStage(id,"kazanan")`; mesaj `"✓ <kod> Büyütme'ye taşındı · Test'teki reklam durdu"`.
  - `approveRecommendation`: `action.kind==="stage"` ve `rec.platform==="meta"` iken `to==="kazanan"` → `moveToScale(action.contentId, { mode:"kur", reason, source:"oneri", recommendationId:id })` (`needsReason` aynen döner, öneri `release`); `rec.ruleKey==="teste_al"` ve Meta → claim etmeden `{ error: "Reklam testine al penceresinden onaylayın." }`. Google ve diğer aşama eylemleri bugünkü gibi.
  - `RecommendationRow.decidedBy: string | null`.
- [ ] **Step 1: Write the failing tests:** kopya POST'u `/<testAdId>/copies` gövdesi `adset_id=<scaleAdsetId>`, sonra kopya ACTIVE, sonra Test PAUSED; kapalıyken POST yok ve aşama değişmez; kırmızı kapıda gerekçesiz `needsReason`; iki Test reklamında hata; `approveRecommendation` `buyut` (meta) `moveToScale`'i çağırır, `durdur` hâlâ `applyAdChange`'i çağırır (mevcut test korunur), `teste_al` claim etmez ve yönlendirme hatası döner; `readWeekRecommendations` `decidedBy` taşır.
- [ ] **Step 2:** Test → FAIL. **Step 3:** Uygula. **Step 4:** Test → PASS; `npx vitest run tests/unit/weekly-actions.test.ts tests/rls/recommendations.test.ts` PASS.
- [ ] **Step 5: Commit** `feat(panel): büyütmeye taşı ve Bu hafta önerilerinin platformda uygulanması`

### Task 12: Kayıt satırı metinleri (K25) — ortak biçimleyici

**Files:**
- Create: `apps/panel/lib/ads/change-log.ts`, `apps/panel/lib/queries/change-log.ts`
- Test: `apps/panel/tests/unit/ads-change-log.test.ts`

**Interfaces:**
- Produces:
  - `type ChangeLogEntry = { id; createdAt: string; platform: string; level: string; objectId: string; objectName: string | null; action: AdLogAction; oldValue: Record<string, unknown> | null; newValue: Record<string, unknown> | null; reason: string | null; status: AdChangeStatus; source: AdLogSource; recommendationId: string | null; actorId: string }`
  - `actionText(e: ChangeLogEntry): string` — pause `"<ad> durduruldu"`, resume `"<ad> yeniden başlatıldı"`, budget `"<ad> bütçesi <eski> → <yeni> TL"`, reklam_kur `"<kod> reklamı kuruldu · Test · Instagram"`, buyutmeye_tasi `"<kod> Büyütme'ye taşındı · Test'teki reklam durdu"`, kampanya_kur `"Test ve Büyütme kampanyaları kuruldu"`, kitle_guncelle `"Mevcut veli kitlesi güncellendi (<n> telefon)"`, ig_yayin `"<kod> Instagram'da yayınlandı"`.
  - `statusText(s: AdChangeStatus): string` — `"✓ Uygulandı"`, `"Kaydedildi · uygulanmadı"`, `"Hata"`.
  - `whenText(iso: string, now: Date): string` — İstanbul; bugünse `"bugün 08:14"`, değilse `"10 Kasım 08:14"`.
  - `changeLine(e: ChangeLogEntry, actorName: string, now: Date): string` — `"✓ Uygulandı · S-2644-I durduruldu · Zehra Gürsel · 10 Kasım 08:14 · gerekçe: \"3 kat harcadı, nitelikli yok\""` (gerekçe yoksa son parça yok; öneriden gelen "· panel önerisi").
  - `latestByKey(entries: ChangeLogEntry[]): Map<string, ChangeLogEntry>` — anahtarlar: `object_id`, `new_value.adId`, `new_value.contentCode`, `recommendation_id`.
  - `loadChangeLog(supabase, fromIso: string, toIso: string, limit = 500): Promise<ChangeLogEntry[]>` ve `loadProfileNames(supabase, ids: string[]): Promise<Map<string, string>>`.
- [ ] **Step 1: Write the failing tests:** tasarımdaki dört örnek satırın birebir metni; bugün/dün ayrımı İstanbul gece yarısında; `uygulanmadi_kapali` öneki; `latestByKey` reklam kimliği ve içerik koduyla bulur.
- [ ] **Step 2:** Test → FAIL. **Step 3:** Uygula. **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): reklam kayıt satırı metinleri (kim, ne zaman, gerekçe)`

### Task 13: Ekranlar — Z6 şablon formu + kurulum kartı, Z4 penceresi

**Files:**
- Create: `apps/panel/components/ads/AdTemplateSection.tsx` (sunucu), `apps/panel/components/ads/AdTemplateForm.tsx` (istemci), `apps/panel/components/ads/AdSetupCard.tsx` (istemci), `apps/panel/components/ads/AdTestPanel.tsx` (istemci), `apps/panel/components/ads/SetupResultNote.tsx` (özet listesi, ortak)
- Modify (tek satır): `apps/panel/app/(app)/reklam/ayarlar/page.tsx` (`<AdTemplateSection />`), `apps/panel/components/content-card-detail.tsx` (`<AdTestPanel item={item} />`, organik/test aşamasında ve onaylı içerikte)
- Test: `apps/panel/tests/unit/ad-template-form.test.ts` (saf yardımcılar: `formToTemplateInput`, `setupCardState`)

**Interfaces:**
- Consumes: Task 8–10 eylemleri, `AdTestView`, `SetupResult`.
- Produces:
  - `formToTemplateInput(form: Record<string, string | boolean>): AdTemplateInput` (virgüllü sayı `41,0123` → `41.0123`); `setupCardState(setup: AdSetup | null, writeEnabled: boolean): { label: "Hazır" | "Kurulmadı"; sub: string; canSetup: boolean }`.
  - **Z6** (tasarım `Z6-Baglantilar.dc.html` alt yarısı): kart "Test ve Büyütme kampanyaları" (Hazır: "Meta'da tek seferlik kuruldu · 2 kampanya"; Kurulmadı: "Kampanyaları kur" + "Sadece göster"; canlı yazım kapalıyken "Kampanyaları kur" pasif ve not "Canlı yazım kapalı: yalnız 'Sadece göster' çalışır."); "Reklam şablonu · bir kez doldurulur" başlığı, "Son değişiklik: <ad> · <tarih>"; alanlar: Kitle merkezi (okul adresi) + enlem/boylam ("Reklam bu adresin çevresinde gösterilir."), Yarıçap ("Servis semtlerinin hepsi içinde kalır."), Yaş aralığı ("Kadın + erkek; ilgi alanı seçilmez (geniş hedefleme)."), Test günlük ("Yeni içerikler bu bütçeyi paylaşır."), Büyütme günlük ("Haftada en çok %20 artar (kurallar sekmesi)."), sabit "Kampanya hedefi: Lead · web formu (piksel)", "Mevcut velileri dışla" anahtarı ("Şifreli telefonlarla 'mevcut müşteri' kitlesi; bütçe boşa gitmez."), sabit "Reklam düğmesi: Daha fazla bilgi"; alt not tasarım metni ("Zehra her reklamda bunları görür, değiştirmez. … panel her zaman kendi yazar."); "Kaydet" → "Kaydedildi" ya da hata.
  - `AdTestPanel(props: { item: { id: string; code: string; kind: "reels" | "sayfa"; stage: string; status: string }; recommendationId?: string; trigger?: "button" | "inline" })` — içerik kartı `<AdTestPanel item={item} />` ile, Bu hafta öneri kartı `recommendationId` ile kullanır; yalnız `status==="onaylandi"` ve aşama `organik|test` iken düğme görünür.
  - **Z4** (`Z4-Test.dc.html`): `AdTestPanel` kart içinde "Reklam testine al" düğmesi (56 px) → açılınca `previewAdTest`; pencere üç sütun (390 px'te alt alta): sol önizleme ("Reklam Instagram'da böyle görünür", Reels: açıklama + "Daha fazla bilgi" çubuğu + "Yayınlanmış gönderinin kendisi kullanılır: beğeni ve yorumlar tek yerde birikir."; sayfa: görsel + başlık + cümle), orta "Şablondan gelenler" + "Ayarlar'da değiştir" bağlantısı + `rows`, sağ "Kontrol listesi · <n> / 9" (✓/✕ + kırmızıda `fix` düğmesi/bağlantısı: "Ayarlar'a git" → `/reklam/ayarlar`, "Kampanyaları kur" → `/reklam/ayarlar`); `needs72hOverride` iken "72 saati bekleme" kutusu + gerekçe alanı; kapı kırmızıyken kırmızı uyarı + gerekçe alanı (sunucu `needsReason` dönerse de açılır); düğmeler "Reklamı kur ve başlat" (kontroller yeşil ve bayrak açıkken), "Sadece göster, kurma" (her zaman), "Vazgeç"; altta tasarımdaki ilk hafta notu. Sonuç: uygulandıysa kart "Testte · reklam <id>" (+ `existing.review` varsa "· İncelemede" / "· Reddedildi: …"); uygulanmadıysa `SetupResultNote` "Panel şunu kuracaktı:" + `summary` satırları.
- [ ] **Step 1: Write the failing tests:** `formToTemplateInput` virgül ve boş alan; `setupCardState` üç durum.
- [ ] **Step 2:** Test → FAIL. **Step 3:** Uygula. **Step 4:** Test → PASS; kontrolcü `yonetici@test.local` ile 1440 ve 390 px'te Z4 ve Z6'yı tasarımla karşılaştırır (yatay taşma yok, odak halkası, Esc kapatır).
- [ ] **Step 5: Commit** `feat(panel): Z6 reklam şablonu ve kurulum kartı, Z4 reklam testine al penceresi`

### Task 14: Ekranlar — Z5 Kampanyalar ve M1 Bu hafta satırları

**Files:**
- Create: `apps/panel/components/ads/MoveToScaleDialog.tsx` (istemci), `apps/panel/components/ads/ChangeLine.tsx`
- Modify: `apps/panel/lib/queries/campaigns.ts` (`CampaignPageData` + `setup: AdSetup | null`, `changes: Map<string, string>` (anahtar → hazır satır), `latestLine: string | null`), `apps/panel/app/(app)/reklam/kampanyalar/page.tsx`, `apps/panel/components/campaign-table.tsx` (satır altı gri `ChangeLine`, inceleme etiketi, eylem menüsüne "Büyütmeye taşı"), `apps/panel/app/(app)/reklam/hafta/page.tsx` (isimler + kayıtlar), `apps/panel/components/weekly-recommendations.tsx`
- Test: `apps/panel/tests/unit/campaign-scale-eligibility.test.ts`, `apps/panel/tests/unit/weekly-who-when.test.ts`

**Interfaces:**
- Consumes: Task 6 (`CampaignRow.adsetId`, `review`), Task 11 (`moveToScale`, `decidedBy`), Task 12 (`changeLine`, `latestByKey`, `loadChangeLog`), Task 13 (`AdTestPanel` öneri modu: `<AdTestPanel item={…} recommendationId={id} />`, prop `contentId`'den bağlam yükler).
- Produces:
  - `canMoveToScale(row: CampaignRow, setup: AdSetup | null): boolean` — Meta reklam satırı, `contentCode` dolu, `adsetId === setup.testAdsetId`, durum `yayinda`.
  - `recWhoWhen(rec: RecommendationRow, names: Map<string, string>, logs: Map<string, ChangeLogEntry>, now: Date): string | null` — karar verilmişse `"✓ Uygulandı · Zehra Gürsel · bugün 08:14 · \"<gerekçe>\""`; uygulanmadıysa `"Kaydedildi · uygulanmadı · …"`; bekletildiyse `"Bekletildi · <ad> · <zaman>"`.
  - **Z5:** Instagram reklam satırlarında içerik kodu (mevcut), inceleme etiketi (`review`, kırmızı tonda "Reddedildi: …"), satır altında son kayıt satırı; menüde "Büyütmeye taşı" → `MoveToScaleDialog` ("<kod> Büyütme'ye taşınsın mı?", maddeler: "Büyütme · Instagram kampanyasına kopyalanır", "Test'teki reklam durur", kapı kırmızıysa uyarı + gerekçe; "Taşı", "Sadece göster", "Vazgeç"; kapalıyken gri not); tablo altında `latestLine` + "Tüm değişiklik kaydı" → `/dashboard#reklam-kaydi`.
  - **M1:** öneri kartında karar sonrası `recWhoWhen` satırı; `teste_al` (Meta) "Onayla" yerine "Reklam testine al" (Z4 açılır); `buyut` sonucu `moveToScale` mesajı.
- [ ] **Step 1: Write the failing tests:** `canMoveToScale` dört durum (Google satırı, kodsuz, büyütme setindeki, durdurulmuş); `recWhoWhen` M1 tasarım metni birebir, gerekçesiz, bekletilmiş.
- [ ] **Step 2:** Test → FAIL. **Step 3:** Uygula. **Step 4:** Test → PASS; kontrolcü 1440/390 px'te Z5 ve M1'i tasarımla karşılaştırır.
- [ ] **Step 5: Commit** `feat(panel): Kampanyalar ve Bu hafta'da uygulandı satırı, büyütmeye taşı`

### Task 15: M2 Rapor — "Reklam kayıt defteri" bölümü ve Excel sayfası

**Files:**
- Modify: `apps/panel/lib/report/build.ts` (`SECTION_IDS` + `"reklam-kaydi"` "icerik"ten sonra, `SECTION_TITLES["reklam-kaydi"] = "Reklam kayıt defteri"`, `RawAdChange`, `ManagerInput.adChanges`, `Report.adLog: AdLogSection | null`, `buildAdLog`), `apps/panel/lib/report/load.ts` (`loadManager`'a dönemin `ad_change_log` satırları), `apps/panel/components/report/sections.tsx` (`AdLogView`), `apps/panel/app/(app)/dashboard/page.tsx` (tek satır `{report.adLog ? <AdLogView … /> : null}`)
- Test: `apps/panel/tests/unit/report-build.test.ts`, `apps/panel/tests/unit/report-export.test.ts` (genişletilir)

**Interfaces:**
- Consumes: Task 12 `actionText`, `statusText`; `ReportInput.profiles` (isimler).
- Produces:
  - `type RawAdChange = { created_at; action; level; object_id; object_name; old_value; new_value; reason; status; source; actor_id }`
  - `type AdLogSection = { total: number; tables: ReportTable[] }` — tek tablo `id:"reklam-kaydi"`, başlık `"Reklam kayıt defteri · <dönem> · <n> kayıt"`, kolonlar `Tarih` (metin "10 Kas 08:14", İstanbul), `Eylem`, `Nesne` (`object_name` ya da içerik kodu), `Kim`, `Gerekçe`, `Kaynak` ("Kampanyalar", "Panel önerisi", "İçerik panosu", "Ayarlar", "Otomatik"), `Durum`; yeniden eskiye; `emptyText: "Bu dönemde reklam değişikliği yok."`.
  - Danışmanda `manager` null → bölüm yok, Excel'de sayfa yok. Excel'de bölüm sayfası mevcut `reportFile` döngüsünden kendiliğinden çıkar; metin hücreleri `safeText` ile.
- [ ] **Step 1: Write the failing tests:** dönem dışı kayıt girmez; danışman raporunda `adLog null` ve `sectionTables` "reklam-kaydi" içermez; yönetici Excel'inde "Reklam kayıt defteri" sayfası ve başlık satırı; `=` ile başlayan gerekçe `'=` olur; mevcut `SECTION_IDS` beklentisi güncellenir.
- [ ] **Step 2:** Test → FAIL. **Step 3:** Uygula. **Step 4:** Test → PASS; kontrolcü M2 tasarımıyla karşılaştırır.
- [ ] **Step 5: Commit** `feat(panel): Rapor'da reklam kayıt defteri ve Excel sayfası`

### Task 16: Mevcut veli dışlama kitlesi (K23) — son kod görevi

**Files:**
- Create: `apps/panel/lib/ads/meta/audiences.ts`, `apps/panel/lib/ads/audience-refresh.ts`
- Modify: `apps/panel/lib/ads/setup-plans.ts` (`planCampaignSetup` `excludedAudienceId` → setlere `excluded_custom_audiences`), `apps/panel/actions/ad-setup.ts` (`setupMetaCampaigns`: şablon `mevcutVelileriHaricTut` ise önce kitle adımı), `apps/panel/app/api/cron/ads/route.ts` (Meta bölümünün sonunda, kendi `try`'ında, yalnız Pazartesi)
- Test: `apps/panel/tests/unit/ads-meta-audiences.test.ts`, `apps/panel/tests/unit/ads-cron-audience.test.ts`

**Interfaces:**
- Consumes: `normalizeTurkishPhone` (`@seker/shared/phone`), `hashPhone` (`lib/ads/meta/capi.ts`), Task 3 `runSetupSteps`/`ref`, Task 7 `executeSetupChange`, Task 2 `getAdTemplate`/`getAdSetup`.
- Produces:
  - `hashParentPhones(phones: string[]): { hashes: string[]; skipped: number }` — `normalizeTurkishPhone` → `hashPhone` (`90…` rakamları, SHA-256 küçük hex), tekilleştirilmiş; geçersiz numara `skipped`.
  - `createExclusionAudience(adAccountId: string, key: string): SetupStep` — `POST /<act>/customaudiences` `{ name:"Mevcut veliler (panel)", subtype:"CUSTOM", customer_file_source:"USER_PROVIDED_ONLY", description:"Yazılı onaylı mevcut velilerin SHA-256 telefonları; dışlama için." }`.
  - `replaceAudienceUsers(cfg, audienceId: string, hashes: string[], sessionId: number, fetchFn?): Promise<{ received: number; invalid: number }>` — `POST /<id>/usersreplace`, 10.000'lik partiler, `batch_seq` 1'den, son partide `last_batch_flag:true`, `payload:{schema:["PHONE"], data:[[h],…]}`; hata 200/1870090 → `MetaApiError("Meta'da Özel Hedef Kitle şartları kabul edilmemiş · Mert kabul eder")`.
  - `updateAdsetExclusion(adsetId: string, targeting: Record<string, unknown>, key: string): SetupStep` (mevcut kurulumda kitle sonradan eklenirse iki sete `targeting` yeniden gönderilir; hedefleme `createAdSet` ile aynı fonksiyondan üretilir).
  - `refreshExclusionAudience(deps: { db; cfg; env; fetchFn?; now: Date }): Promise<{ status: "atlandi" | "uygulandi" | "uygulanmadi_kapali" | "hata"; count: number; message: string }>` — `mevcutVelileriHaricTut=false` ya da kurulum yoksa `atlandi`; aktör `reklam_sablonu.updatedBy` (yoksa `atlandi` + "Şablonu kaydeden yok"); telefonlar `students` `status='aktif'` `phone`; `executeSetupChange` (`kitle_guncelle`, `level:"audience"`, `objectId` kitle kimliği ya da `"kitle"`, `source:"cron"`, `logSteps:false`, `logExtra:{ count, skipped }`); kitle yoksa oluşturur, `reklam_kurulum.exclusionAudienceId` yazar ve iki setin hedeflemesini günceller.
  - Cron yanıtına yalnız Pazartesi ve Meta yapılandırılmışken `meta.audience: { status, count } | null`; hata `"Meta kitle: …"` önekiyle bildirime eklenir; diğer günler yanıt birebir aynı.
- [ ] **Step 1: Write the failing tests:**
  - `0532 555 41 20` ve `+90 532 555 4120` aynı hash'e iner ve tek kalır; `"123"` `skipped`.
  - `usersreplace gövdesi şema PHONE ve hash'ler; 10.001 telefon iki parti, ikincisinde last_batch_flag true`.
  - `kayıtta telefon ve hash yok` (`insertLog` argümanında hiçbir 64 haneli hex yok).
  - `şart kabul edilmemiş hatası Türkçe mesaja döner`.
  - `mevcutVelileriHaricTut false → istek yok, atlandi`.
  - `bayrak kapalı → kayıt uygulanmadi_kapali, POST yok`.
  - `cron Salı günü kitleye dokunmaz ve yanıt değişmez`; `Pazartesi yanıtta meta.audience`; mevcut `ads-cron-route.test.ts`, `ads-cron-meta.test.ts` değişmeden PASS.
  - `kurulumda kitle açıksa adım sırası customaudiences, campaigns, adsets(excluded_custom_audiences=[{id:ref}]), …`.
- [ ] **Step 2:** Test → FAIL. **Step 3:** Uygula. **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): mevcut veli dışlama kitlesi ve Pazartesi güncellemesi (K23)`

### Task 17: Kılavuzlar

**Files:**
- Modify: `docs/yonetici-reklam-kilavuzu.md`, `docs/pazarlama-kurulum.md`

- [ ] **Step 1:** `docs/yonetici-reklam-kilavuzu.md`'ye bölümler (Türkçe, her biri 3–6 madde): "Reklam şablonu ve kampanyaların kurulumu" (Z6, bir kez, kim değiştirir), "Reklam testine al" (9 kontrol ne demek, kırmızıda ne yapılır, 72 saat ve gerekçe, kapı kırmızıyken gerekçe), "Sadece göster" ("Panel şunu kuracaktı" listesi nasıl okunur), "Büyütmeye taşı", "Uygulandı satırı ve Rapor'daki Reklam kayıt defteri", "Reddedilen reklam" (Kampanyalar'daki "Reddedildi: …" etiketi, ne yapılır).
- [ ] **Step 2:** `docs/pazarlama-kurulum.md`'ye "Meta · panelden reklam (Paket C)" bölümü: (a) env listesi (yeni yok; `META_FACEBOOK_PAGE_ID` B'den, `SITE_PUBLIC_URL`); (b) sistem kullanıcısı izinleri ve Instagram hesabının reklam hesabına bağlı olması; (c) Özel Hedef Kitle şartlarının kabulü (hata 200/1870090); (d) **ilk hafta "sadece göster" yöntemi:** bayrak kapalı kalır, Zehra her içerikte "Sadece göster, kurma" ile kayıt üretir, Mert `ad_change_log.new_value.summary`/`steps`'i Reklam Yöneticisi'nde elle aynı ayarlarla karşılaştırır (ad, kampanya, set, bağlantı, `utm_content`), istenirse masaüstü `meta-apply.mjs` doğrulama modu (`--apply` olmadan) ile aynı yükü dener; (e) **TRY bütçe birimi doğrulaması:** Z6'da "Sadece göster" yerine ilk gerçek "Kampanyaları kur" öncesi Reklam Yöneticisi'nde elle günlük 200 TL bütçeli bir kampanya açılıp `meta-read.mjs` ya da `metaGetDailyBudget` ile okunur; `20000` dönmeli (×100); farklıysa `TRY_MINOR_PER_TL` düzeltilmeden bayrak açılmaz; (f) bayrak açılışı (D3) koordinatör işi: önce kampanyalar kurulur (PAUSED), Reklam Yöneticisi'nde kontrol, sonra ilk "Reklamı kur ve başlat"; (g) Reels kreatifi bağlantıyı taşımıyorsa yedek yol (B4) sabah sorusu.
- [ ] **Step 3: Commit** `docs: panelden reklam kılavuzu ve Meta kurulum adımları`

### Task 18: Son kontroller ve teslim

- [ ] **Step 1:** `pnpm turbo run lint typecheck test` → hepsi PASS.
- [ ] **Step 2:** `pnpm --filter @seker/web build` ve `NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x pnpm --filter @seker/panel build` → başarılı.
- [ ] **Step 3:** `superpowers:requesting-code-review` ile dal farkı; bulgular düzeltilir, testler yeniden yeşil.
- [ ] **Step 4:** Teslim şablonu koordinatöre SendMessage ve `../seker-platform-ledgers/teslim/feat-reklam-konsolu-c.md`:
  ```
  dal: feat/reklam-konsolu-c   sha: …
  worktree: ../seker-platform-rk-c
  dokunulan: packages/db/supabase/migrations/0026_reklam_kurulum.sql, apps/panel/lib/ads/{ad-template,ad-setup,preflight,preflight-sources,setup-plans,setup-gate,setup-store,ad-test-context,change-log,audience-refresh}.ts, apps/panel/lib/ads/meta/{setup,audiences,objects}.ts, apps/panel/lib/ads/{writes,objects-store,campaigns,recommendations}.ts, apps/panel/actions/{ad-setup,recommendations}.ts, apps/panel/components/ads/*, campaign-table, weekly-recommendations, content-card-detail (1 satır), reklam/ayarlar (1 satır), dashboard + lib/report, api/cron/ads, docs
  migration: 0026 (dosya: packages/db/supabase/migrations/0026_reklam_kurulum.sql) — main push'tan önce prod'a; B'nin 0025'inden sonra
  kontroller: lint ✓ typecheck ✓ test ✓ web build ✓ panel build ✓
  env / crontab değişikliği: yok (META_FACEBOOK_PAGE_ID B'den; ADS_WRITE_ENABLED kapalı kalır)
  riskler: optimizasyon hedefi (OFFSITE_CONVERSIONS vs spec LEAD), Reels kreatifinde CTA/url_tags teyitsiz, TRY ×100 teyitsiz, webp görsel, A/B stub adaptörü rebase'de bağlanır
  Mert'ten beklenen karar: soru listesi (plan başı "Kararlar" ve teslim notu)
  ```
- [ ] **Step 5:** Mert'e Türkçe kısa özet (koordinatör üzerinden).

### Ek (bu gece uygulanmaz): B4 yedek yolu — `video_data` kreatifi

Yalnız ilk canlı haftada Reels kreatifinin bağlantıyı (`call_to_action.value.link`) taşımadığı görülürse, koordinatör ayrı küçük iş açar: `POST /act_<id>/advideos` (`file_url` = 1 saatlik imzalı Storage adresi) → işlenme yoklaması → `object_story_spec.video_data{ video_id, message, title, image_url (kapak), call_to_action }`; `planAdTest`'e `source.kind:"reels_video"`. Beğeniler ayrılır (B4 kabul eder).
