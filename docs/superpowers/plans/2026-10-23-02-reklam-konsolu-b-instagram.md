# Reklam Konsolu · Paket B · Instagram'a yayın — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Özet (5 satır)**
1. Onaylanan Reels, panelden tek tıkla (şimdi ya da saat seçerek) Instagram'a Reels olarak gönderilir: konteyner → durum yoklama → `media_publish`; kalan adımları 5 dakikada bir çalışan `/api/cron/content` bitirir.
2. Yayın durumu `content_items` üzerinde (`ig_publish_status` yok→kuyruk→isleniyor→yayinda|hata) tutulur; 72 saat sayacı gerçek `ig_published_at`'ten başlar; her istek `ad_change_log`'a `ig_yayin` olarak yazılır.
3. `IG_PUBLISH_ENABLED` kapalıyken "Yayınla" yalnız kayıt yazar (`uygulanmadi_kapali`), Instagram'a hiçbir istek gitmez, sonradan kendiliğinden yayın da olmaz.
4. Öğretmen yüklemede süre, en/boy, kapak karesi ve "Altyazı ekledim" bilgisini verir (K17); dikey olmayan ya da 90 sn'den uzun video yüklenmeden reddedilir.
5. Z1'e Instagram önizlemesi ve otomatik kontroller, Z2 yayın penceresi, Ayarlar'a bağlantı kartları (Z6) eklenir; elle bağlantı yapıştırma (`linkInstagramPost`) yedek yol olarak kalır.

**Dal / worktree / migration:** `feat/reklam-konsolu-b` · `../seker-platform-rk-b` (origin/main'den; upstream main değil) · migration **0025** `packages/db/supabase/migrations/0025_ig_yayin.sql`.

**Bağımlılıklar**
- Dış: Instagram profesyonel (işletme) hesabı bir Facebook sayfasına bağlı; sistem kullanıcısı anahtarında `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` (+ sayfada İşletme rolü varsa `ads_management` ya da `ads_read`); env `META_INSTAGRAM_USER_ID`, `META_FACEBOOK_PAGE_ID`. Bunlar Mert'in işi; yokken kod "kurulmadı" durumuna düşer, hata vermez.
- Kod: yok (A ve C'den bağımsız geliştirilir; birleştirme sırası A → B → C, B birleşmeden önce main'e rebase eder).
- B'den okuyan: Paket C preflight #2 ve #8 `content_items.ig_publish_status`, `ig_published_at`, `media_meta.{vertical,durationS,subtitled}` okur (`lib/ads/preflight-sources.ts`). Bu adlar bu planda sabittir.

**Goal:** Zehra onaylanmış bir Reels'i panelden Instagram'da yayınlar, kart yayın durumunu ve 72 saat sayacını gösterir, öğretmen yüklemede biçim kontrolünden geçer.

**Architecture:** Meta çağrıları saf, `fetch` enjekte edilen tek modülde (`lib/ads/meta/publish.ts`). Kuyruk kararları (hangi satırda ne yapılır, hata metni, zaman penceresi) saf `lib/content/publish-queue.ts`'te. Durum yazımı ve kayıt `PublishStore` arayüzünün arkasında (`lib/content/publish-store.ts`, Supabase uygulaması servis rolüyle); tek adım motoru `lib/content/publish-runner.ts` hem sunucu eylemi `publishReel` (ilk adım) hem cron (kalan adımlar) tarafından çağrılır. Bağlantı durumu tek fonksiyonda hesaplanır, `app_settings.baglanti_durumu`'na 15 dakikalık anlık görüntü olarak yazılır; Ayarlar sayfası, içerik panosu ve sabah cron'u aynı fonksiyonu kullanır.

**Tech Stack:** Next.js 16 panel (server actions, route handler), Supabase Postgres + RLS + Storage imzalı URL, Vitest (birim + `tests/rls`), Meta Graph API v26.0.

**Spec:** `docs/superpowers/specs/2026-10-23-reklam-konsolu-design.md` — §2 G2, §4, §5, K15, K16, K17, K21 (yalnız `ig_yayin`), K22 (`IG_PUBLISH_ENABLED`), §8 Z1, Z2, O1, Z6 (yalnız bağlantı kartları), §9 Paket B, §11, §12 adım 7, §13, §14, **§15 B2, B3, B5, B6, B7**. Önceki spec `2026-10-19-reklam-suiti-design.md` §6 K5, K11. Meta notları `docs/superpowers/plans/2026-10-19-02-meta-api-notlari.md`. Ekran tasarımları (bağlayıcı): `Z1-Kontrol.dc.html`, `Z2-Yayinla.dc.html`, `O1-Gorevim.dc.html`, `Z6-Baglantilar.dc.html` (https://claude.ai/artifact/G37pQjW7qanRXmTMxxe3FR).

## API doğrulaması (23.10, resmi sayfalar)

Her URL, ilgili fonksiyonun üstüne yorum olarak yazılır. "TEYİTSİZ" olanlar ilk gerçek hesapta kontrol edilir; kod onlara karşı savunmalı yazılır.

| Konu | Bulgu | Kaynak |
|---|---|---|
| Konteyner | `POST /{ig-user-id}/media` · `media_type=REELS`, `video_url` (herkese açık URL), `caption`, `thumb_offset` (**milisaniye**, varsayılan 0; `cover_url` varsa yok sayılır), `share_to_feed` (true → Akış + Reels; varsayılan yazmıyor, açıkça `true` gönderilir). Yanıt `{id}`. | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media |
| Durum | `GET /{container-id}?fields=status_code,status`; `status_code` ∈ `EXPIRED, ERROR, FINISHED, IN_PROGRESS, PUBLISHED`; `ERROR` iken `status` bir hata alt kodu taşır (metin biçimi TEYİTSİZ: kod rakamları ayıklar). Öneri: dakikada bir, en çok 5 dakika. Konteyner 24 saatte yayınlanmazsa `EXPIRED`. | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-container · https://developers.facebook.com/docs/instagram-platform/content-publishing/ |
| Yayın | `POST /{ig-user-id}/media_publish` · `creation_id=<container>` → `{id: <ig-media-id>}`. | content-publishing (yukarıda) |
| Medya | `GET /{ig-media-id}?fields=id,permalink,timestamp` (ISO 8601 UTC); Reels `media_product_type=REELS`. | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media |
| Günlük sınır | `GET /{ig-user-id}/content_publishing_limit?fields=quota_usage,config` → `{data:[{quota_usage, config:{quota_total, quota_duration}}]}`. Referans sayfası `quota_total` = **50** / 86400 sn; rehber sayfası "100 / 24 saat" diyor; spec "25" diyor. **Kod sayıyı sabitlemez, API'den okur.** Sınır hatası alt kod 2207042. | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit |
| İzinler | Facebook girişi: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` (+ sayfada İşletme rolü varsa `ads_management`/`ads_read`). Ana makine `graph.facebook.com`. `content_publishing_limit` aynı izinleri ister: bu çağrının başarısı "yayın izni var" sayılır. | content_publishing_limit ve content-publishing (yukarıda) |
| Video | MOV/MP4, H.264 ya da HEVC, AAC; 23–60 FPS; yatay en çok **1920 px**; oran 0.01:1–10:1 (öneri 9:16); **3 sn – 15 dk**; en çok **300 MB**. | ig-user/media (yukarıda) |
| URL | "medya, deneme anında herkese açık bir sunucuda olmalı". Supabase imzalı URL (`/storage/v1/object/sign/...?token=`) kimlik doğrulamasız erişilebildiği için uygun **varsayılır** (TEYİTSİZ: Meta'nın sorgu dizgeli URL'yi indirdiği resmi sayfada yazmıyor; hata 2207052 gelirse bu varsayım yanlıştır). | content-publishing (yukarıda) |
| Hata kodları | 352/2207026 biçim desteklenmiyor · 9/2207042 günlük sınır · 9004/2207052 URL'den alınamadı · 1/2207057 kapak karesi süre dışında · 25/2207050 hesap kısıtlı · 4/2207051 spam sanıldı · -2/2207020 süresi doldu · -1/2207001, -1/2207032, -1/2207053, -2/2207003 geçici · 9007/2207027 hazır değil. | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/error-codes |
| Bağlantı kartları | IG kullanıcısı `GET /{ig-user-id}?fields=username`; sayfa `GET /{page-id}?fields=name,instagram_business_account`; reklam hesabı `GET /act_<id>?fields=name,currency,account_status` (`1 = ACTIVE`, 2 DISABLED, 3 UNSETTLED, 7 PENDING_RISK_REVIEW, 9 IN_GRACE_PERIOD, 101 CLOSED). Piksel `GET /{pixel-id}?fields=name` TEYİTSİZ. | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user · https://developers.facebook.com/docs/graph-api/reference/page/ · https://developers.facebook.com/docs/marketing-api/reference/ad-account/ |

## Global Constraints

- Meta Graph API **v26.0**, `META_GRAPH_BASE`/`META_GRAPH_API_VERSION` (`lib/ads/meta/config.ts`). Anahtar yalnız `authorization: Bearer` başlığında, `appsecret_proof` sorguda ya da form gövdesinde; hata metinleri `sanitize` ile anahtarsız.
- **MEB:** `approver_face_check` `true` değilse Reels hiçbir yolla yayınlanmaz (eylem, koşucu ve cron her biri ayrı denetler).
- **K22 / B5:** `IG_PUBLISH_ENABLED !== "true"` iken Instagram'a hiçbir istek gitmez (bağlantı kartlarının okuma çağrıları hariç). "Yayınla" yalnız `ad_change_log` satırı yazar (`status='uygulanmadi_kapali'`), `ig_publish_status` değişmez; bayrak sonradan açılınca hiçbir şey kendiliğinden yayınlanmaz. Bu bayrak `ADS_WRITE_ENABLED`'a bağlı değildir.
- **B2 kayıt:** `ad_change_log` kolonları değişmez. IG yayını satırı: `platform='meta'`, `level='icerik'`, `object_id=content_items.id`, `object_name='<kod> · <konu>'`, `action='ig_yayin'`, `source='icerik'`, `actor_id` = isteyen yönetici (cron bitirse de `ig_publish_requested_by`), `old_value`/`new_value` = gönderilen yük (anahtarsız), `gate_red=false`. Durumlar `uygulandi|uygulanmadi_kapali|hata`; yayın sürerken satır `status='hata'`, `error='Yayın sürüyor'` (mevcut `executeAdChange` deseni: "Platform yanıtı bekleniyor") ve sonuçta güncellenir.
- **B3:** Aşama akışı değişmez. Yayın paneli `kind='reels'`, `status='onaylandi'`, `stage='organik'`, `ig_publish_status <> 'yayinda'` kartlarda görünür. Yayın aşamayı ya da `stage_changed_at`'i değiştirmez; 72 saat yalnız `ig_published_at` doluyken sayılır.
- **B6:** Cron, konteyner açmadan ve `media_publish`'ten hemen önce `status='onaylandi'`, `approver_face_check=true`, `stage='organik'`, `ig_publish_status in ('kuyruk','isleniyor')` koşullarını yeniden okur; bozulmuşsa `hata` + `"Onay geri alındı"`. Yayın penceresi İstanbul saatiyle **07:00–22:59** (crontab `*/5 7-22 * * *`); dışına planlanan saat bir sonraki pencerede yayınlanır ve Z2 saat seçerken bunu yazar.
- **K15:** `video_url` = 1 saatlik (`3600` sn) imzalı Storage URL (`CONTENT_BUCKET`, servis rolü), `thumb_offset` = `media_meta.coverOffsetMs`, `share_to_feed=true`.
- **K17 `media_meta`** anahtarları tam olarak `{ durationS, width, height, vertical, coverOffsetMs, subtitled }` (mevcut `name`, `size`, `durationSec` korunur). Reels teslimi: `vertical=true`, `3 ≤ durationS ≤ 90`; reklam için ayrıca `≤ 60` (yalnız gösterilir, C uygular). Kare seçilmezse `coverOffsetMs=1000`.
- **§11:** `actions/content.ts`'e dokunulmaz. Yeni eylemler `apps/panel/actions/instagram.ts`. İçerik kartına yeni bileşen `ReelPublishPanel`; Ayarlar'a `components/ads/ConnectionsCard.tsx`. Paylaşılan dosyalara yalnız ekleme. `infra/docker-compose.yml` yalnız ekleme; `infra/cron/crontab` satırını **koordinatör** ekler (teslimde yazılır).
- Sunucu bileşeninde `new Date()` yok: `requestNow()` (`lib/time.ts`). Arayüz Türkçe, renkler `globals.css` token'ları, dokunma hedefi ≥ 44 px, ana düğme 56 px (`min-h-14`).
- Okul kullanıcılarıyla prod'a giriş yok; canlı Meta uç noktası bu dalda **hiç çağrılmaz** (testler `fetch` sahtesiyle).

## Kararlar (Ruling)

- Ruling: Sunucu tarafında K17 zorlaması `publishReel` ve koşucuda (`media_meta` geçersizse yayın yok); teslim anında DB tetikleyicisi eklenmez (B3: guard değişmez). Öğretmen istemciyi atlayıp `media_meta`'yı elle yazabilir; Z1 kontrol listesi ve yöneticinin videoyu izlemesi son kapıdır. — cost if wrong: dikey olmayan bir video "Kontrol"e kadar gelir, yönetici düzeltme ister.
- Ruling: `media_meta` yazımı yeni eylem `saveReelVideoMeta` ile (`actions/instagram.ts`, öğretmen oturumu, mevcut kolon yetkisi), çünkü `saveContentDraft` `media_meta`'yı `{name,size,durationSec}`'e indirger ve o dosyaya dokunulmaz. Yükleyici önce `saveContentDraft`, sonra `saveReelVideoMeta` çağırır (birleştirerek yazar). — cost if wrong: ikinci çağrı düşerse video K17'siz kalır; Z1 "Biçim bilgisi yok" gösterir, öğretmen videoyu yeniden seçer.
- Ruling: `vertical` ⇔ `height / width ≥ 1.7` (9:16 = 1.78, %5 pay); `width > 1920` reddedilir (Meta sınırı, 4K dikey çekim). Tarayıcının `videoWidth/videoHeight` değerleri döndürme üst verisini uygular (Chrome/Safari; TEYİTSİZ eski Android). — cost if wrong: 3:4 video ya da 4K çekim reddedilir; öğretmen 1080p dik çeker.
- Ruling: Kısa süre sınırı 3 sn (Meta alt sınırı) K17'ye eklenir. — cost if wrong: yok; Meta zaten reddeder.
- Ruling: Konteyner zaman aşımı 60 dakika, konteynerin açıldığı güncellemeden (`updated_at`) sayılır: `IN_PROGRESS` yoklaması satıra yazmaz, bu yüzden `updated_at` konteynerin açılış anında kalır. İstek ya da plan zamanından sayılmaz (hak dolduğu için bekleyen planlı satır konteyner açılır açılmaz zaman aşımına düşmesin). — cost if wrong: arada karta not kaydedilirse süre biraz uzar; çok uzun işlenen video 1 saatte "hata" olur, Zehra tekrar dener.
- Ruling: Aynı satırı iki kez işlememek için koşullu güncelleme (`.eq('ig_publish_status', beklenen)`) ve cron, son 60 saniyede güncellenmiş `isleniyor` satırını atlar (eylemin satır içi yoklamasıyla yarışmasın). — cost if wrong: aynı dakikada iki yoklama; ikinci `media_publish` "zaten yayınlandı" hatası verir, kurtarma yolu (`PUBLISHED` → medya listesi) kartı düzeltir.
- Ruling: `PUBLISHED` durumunda (yayın oldu ama kayıt düştü) medya kimliği, `listMedia` içinde `timestamp ≥ başlangıç` ve açıklaması eşleşen ilk Reels'ten bulunur; bulunamazsa `hata`: "Instagram'da yayınlandı ama bağlantı bulunamadı; bağlantıyı elle yapıştırın". — cost if wrong: Zehra bağlantıyı yapıştırır.
- Ruling: Günlük hak dolmuşsa (`remaining ≤ 0`) "Şimdi" isteği `hata` "Günlük Instagram yayın hakkı doldu; yarın tekrar deneyin"; kuyruktaki zamanlanmış satır `kuyruk`'ta kalır, `ig_publish_error` aynı metni gösterir ve sonraki koşuda yeniden denenir. Hak okunamazsa engellenmez (Meta 2207042 ile reddeder). — cost if wrong: hak bilgisi yanlışsa bir istek fazla gider, Meta reddeder.
- Ruling: Cron bayrağı kapalı görürse `kuyruk`/`isleniyor` satırları `hata` "İçerik yayını kapatıldı; açılınca yeniden yayınlayın" olur (B5 ile tutarlı: açılınca kendiliğinden yayın yok). — cost if wrong: Zehra yeniden basar.
- Ruling: Z2'de düzenlenen açıklama sunucuda `checkText` (yasaklı ifade, `icerik_limitleri.reels_aciklama`, en az) ile yeniden denetlenir ve kuyruğa alınırken `content_items.caption`'a yazılır (preflight #7 yayındaki metni okusun). — cost if wrong: öğretmenin ilk metni kaybolur; `ad_change_log.old_value.caption` saklar.
- Ruling: Satır içi ("Şimdi") yol: konteyneri açar, bir kez yoklar; `FINISHED` gelirse aynı istekte yayınlar. — cost if wrong: istek ~5 sn uzar.
- Ruling: Zamanlanmış satırda konteyner, saat geldiğinde cron açar (1 saatlik imzalı URL o an üretilir). Planlanan saat en erken şimdi + 10 dk, en geç şimdi + 14 gün. Planı iptal etmek bu turda yok (Zehra Instagram uygulamasından silemez, çünkü henüz yayın yok; iptal gerekirse "Düzeltme iste" kartı onaydan düşürür ve cron "Onay geri alındı" yazar). — cost if wrong: küçük bir `cancelScheduledReel` eylemi sonradan eklenir.
- Ruling: Bağlantı durumu `app_settings.baglanti_durumu` (anahtarsız JSON) içinde; Ayarlar ve içerik panosu 15 dakikadan eskiyse yeniden hesaplar ve yazar, istek içinde React `cache()` ile bir kez; sabah `/api/cron/ads` her gün yeniler. — cost if wrong: durum en çok 15 dakika bayat.
- Ruling: Z6'daki "Onay metni" ve "Test ve Büyütme kampanyaları" kartları B'de yok (ilki panel env'inde değil, ikincisi C'nin). `ConnectionsCard` `extraRows?: ConnectionRow[]` alır; C kendi satırını oradan ekler. — cost if wrong: C küçük bir prop ekler.
- Ruling: İçerik kartında "tek satır" kuralı en küçük hâliyle aşılır: `ContentBoard` → `ContentCardDetail`'e bir prop (`reel: ReelPanelContext`), detayda üç tek satırlık ekleme (kontroller, panel, onay sonrası Z2 açma) ve reels onay düğmesinin metni. — cost if wrong: A/C rebase'inde küçük çakışma.
- Ruling: Yeni bildirim türleri `ig_yayinlandi` (öğretmene, `/gorevim`) ve `ig_yayin_hata` (etkin yöneticilere, `/reklam/icerik?kod=<kod>`). DB'de tür kontrolü yok; yalnız `lib/notifications/types.ts` listesi. — cost if wrong: yok.

## Review Focus

1. **Çift yayın:** Eylemin satır içi yoklaması ile cron aynı `FINISHED` konteyneri yayınlamaya kalkar ya da iki cron koşusu üst üste biner. Beklenen: tek `media_publish`. Test: Task 5 (`koşullu güncelleme kaybedilirse Meta'ya gidilmez`, `60 sn içinde güncellenen isleniyor atlanır`).
2. **Onay geri alındı:** Zamanlanmış yayın beklerken "Düzeltme iste" ile içerik `duzeltme`'ye ve `approver_face_check=null`'a döner. Beklenen: cron konteyner açmaz, `hata` "Onay geri alındı". Test: Task 5.
3. **Bayrak kapalı/açık geçişi:** Kapalıyken basılan "Yayınla" sonradan bayrak açılınca yayınlanmamalı; açıkken kuyruğa girip sonra kapatılan satır yayınlanmamalı. Test: Task 6 (eylem) ve Task 5 (koşucu, bayrak kapalı).
4. **Eski yükleme:** Bu paketten önce yüklenmiş videoda K17 yok. Beklenen: Z1 "Biçim bilgisi yok (eski yükleme)" uyarısı, `publishReel` Türkçe hata ve elle bağlantı yolu görünür kalır. Test: Task 3 (`parseReelMediaMeta` eski biçim → null) ve Task 6.
5. **İzin/anahtar yok:** Anahtarda `instagram_content_publish` yok ya da `META_INSTAGRAM_USER_ID` boş. Beklenen: Ayarlar ve pano açılır, kart kırmızı "kurulmadı"; `publishReel` "Instagram yayın izni yok" der, istisna sayfaya taşmaz. Test: Task 2 (hata eşleme girdisi), Task 4 (`igErrorText` 10/200/190) ve Task 9 (`checkConnections` hiç fırlatmaz).

---

### Task 1: Migration 0025 — yayın durumu kolonları ve kayıt kısıtları

**Files:**
- Create: `packages/db/supabase/migrations/0025_ig_yayin.sql`
- Modify: `packages/db/src/database.types.ts` (üretilir)
- Test: `apps/panel/tests/rls/ig-yayin.test.ts`

**Interfaces:**
- Produces (DB):
  - `content_items` yeni kolonlar: `ig_publish_status text not null default 'yok' constraint content_items_ig_publish_status_check check (ig_publish_status in ('yok','kuyruk','isleniyor','yayinda','hata'))`, `ig_container_id text`, `ig_publish_error text`, `ig_publish_scheduled_at timestamptz`, `ig_publish_requested_by uuid references public.profiles(id)`, `ig_publish_requested_at timestamptz`.
  - Kısmi indeks `idx_content_items_ig_queue on content_items (ig_publish_status, ig_publish_scheduled_at) where ig_publish_status in ('kuyruk','isleniyor')`.
  - Geri doldurma: `update content_items set ig_publish_status='yayinda' where ig_media_id is not null and ig_published_at is not null` (elle bağlanıp sayıları gelmiş eski Reels'ler "yayında" görünür).
  - `ad_change_log`: `drop constraint ad_change_log_action_check` → `add constraint ad_change_log_action_check check (action in ('pause','resume','budget','ig_yayin'))`; `drop constraint ad_change_log_source_check` → `add constraint ad_change_log_source_check check (source in ('kampanyalar','oneri','icerik','ayarlar','cron'))`. Dosyada yorum: "0026 (Paket C) iki kısıtı bu değerleri de içererek yeniden kurar."
  - Kolon yetkisine dokunulmaz: 0017'deki `grant update (caption, page_fields, media_path, media_meta, face_answer, updated_at)` yeni kolonları kapsamadığı için `authenticated` onlara yazamaz.
- Consumes: 0017 `content_items`, 0018 `ad_change_log` (kısıt adları Postgres'in satır içi varsayılanları; uygulamadan önce `select conname from pg_constraint where conrelid='public.ad_change_log'::regclass` ile yerelde doğrulanır).

- [ ] **Step 1: Write the failing test** `tests/rls/ig-yayin.test.ts` (`clientFor`, `admin` — `tests/rls/helpers.ts`):
  - `yeni içerik ig_publish_status yok ile başlar`: admin Reels ekler → `ig_publish_status === "yok"`, diğer beş kolon null.
  - `geçersiz yayın durumu reddedilir`: admin `update({ig_publish_status:"bitti"})` → hata kodu `23514`.
  - `öğretmen ig_* kolonlarına yazamaz`: `clientFor("ogretmen@test.local")` kendi taslağında sırayla `ig_publish_status`, `ig_container_id`, `ig_publish_error`, `ig_publish_scheduled_at`, `ig_publish_requested_by`, `ig_publish_requested_at`, `ig_media_id`, `ig_published_at`, `ig_permalink` güncellemesi → her biri hata (kolon yetkisi, `42501`); aynı istemciyle `update({caption:"…"})` başarılı (kırılmadığını gösterir).
  - `yönetici oturumu da ig_* yazamaz (yalnız servis rolü)`: `clientFor("yonetici@test.local")` → `update({ig_publish_status:"kuyruk"})` hata.
  - `öğretmen kendi içeriğinin yayın durumunu okur`: `select("ig_publish_status, ig_publish_error")` 1 satır.
  - `ad_change_log ig_yayin ve yeni kaynakları kabul eder`: admin `insert({platform:"meta", level:"icerik", object_id:<uuid>, action:"ig_yayin", source:"icerik", status:"uygulanmadi_kapali", actor_id:<yönetici>})` başarılı; `source` `"ayarlar"` ve `"cron"` başarılı; `action:"kampanya_kur"` → `23514` (C'nin değeri henüz yok); `source:"baska"` → `23514`; eski `action:"pause", source:"kampanyalar"` başarılı.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/rls/ig-yayin.test.ts` → FAIL (kolon yok).
- [ ] **Step 3:** Migration'ı yaz.
- [ ] **Step 4:** `pnpm --filter @seker/db exec supabase db reset`, `pnpm --filter @seker/db gen:types`, test → PASS; `npx vitest run tests/rls/icerik.test.ts tests/rls/yonetici.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(db): Instagram yayın durumu kolonları ve ig_yayin kaydı (0025)`

### Task 2: Meta yayın istemcisi (`lib/ads/meta/publish.ts`)

**Files:**
- Create: `apps/panel/lib/ads/meta/publish.ts`, `apps/panel/tests/fixtures/ig-publish.json`
- Modify: `apps/panel/lib/ads/meta/insights.ts` (`MetaApiError`'a alt kod), `apps/panel/lib/ads/meta/config.ts` (`facebookPageId`, `igPublishEnabled`)
- Test: `apps/panel/tests/unit/ig-publish.test.ts`

**Interfaces:**
- Consumes: `MetaConfig`, `appSecretProof`, `META_GRAPH_BASE`, `META_GRAPH_API_VERSION` (config.ts); `headers`, `toApiError`, `MetaApiError` (insights.ts); `FetchFn` (`lib/ads/types.ts`).
- Produces:
  - `MetaApiError` yapıcısına dördüncü isteğe bağlı parametre `readonly subcode: number | null = null`; `toApiError` gövdeden `error.error_subcode`'u (sayıysa) okur. Mevcut çağrılar değişmez.
  - `MetaConfig.facebookPageId?: string | null` (`META_FACEBOOK_PAGE_ID`, boşsa null); `igPublishEnabled(env = process.env): boolean` ⇔ `env.IG_PUBLISH_ENABLED === "true"`.
  - `type ContainerStatusCode = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED" | "UNKNOWN"`
  - `createReelContainer(cfg: MetaConfig, input: { videoUrl: string; caption: string; thumbOffsetMs: number }, fetchFn?: FetchFn): Promise<string>` — `POST {base}/{v}/{igUserId}/media`, form gövdesi `media_type=REELS`, `video_url`, `caption`, `thumb_offset` (tam sayı ms), `share_to_feed=true`, `appsecret_proof`; dönüş `id`.
  - `getContainerStatus(cfg, containerId: string, fetchFn?): Promise<{ statusCode: ContainerStatusCode; status: string | null; errorSubcode: number | null }>` — `GET /{container}?fields=status_code,status`; bilinmeyen değer `UNKNOWN`; `errorSubcode` = `status` içindeki ilk 4–9 haneli sayı.
  - `publishContainer(cfg, containerId: string, fetchFn?): Promise<string>` — `POST /{igUserId}/media_publish` `creation_id`; dönüş medya `id`.
  - `fetchPublishedMedia(cfg, mediaId: string, fetchFn?): Promise<{ id: string; permalink: string | null; timestamp: string | null }>` — `fields=id,permalink,timestamp`.
  - `getPublishingLimit(cfg, fetchFn?): Promise<{ used: number; total: number; remaining: number }>` — `GET /{igUserId}/content_publishing_limit?fields=quota_usage,config`; `remaining = max(0, total - used)`.
  - Ortak kurallar: `cfg.instagramUserId` yoksa `MetaApiError("Instagram hesabı tanımlı değil", 400)` ve istek yok; kimlikler `^\d{1,30}$` değilse `MetaApiError(…, 400)`; zaman aşımı 30 sn; yanıt beklenen biçimde değilse `MetaApiError("Meta yanıtı beklenmeyen biçimde", 502)`. Her fonksiyonun üstünde "API doğrulaması" tablosundaki URL yorum olarak.
- [ ] **Step 1: Write the failing tests** (`ig-organic.test.ts` deseni, `json()`/`asFetch()` yardımcıları; fixture'da `container`, `statusFinished`, `statusError` (`{"status_code":"ERROR","status":"Error: 2207026"}`), `publish`, `media`, `limit` (`{"data":[{"quota_usage":3,"config":{"quota_total":50,"quota_duration":86400}}]}`), `errorLimit` (`{"error":{"message":"…","code":9,"error_subcode":2207042}}`)):
  - `konteyner REELS, ms kapak ve share_to_feed=true ile açılır; anahtar yalnız başlıkta`: istek `POST …/v26.0/17841400000000000/media`, gövdede `media_type=REELS`, `thumb_offset=1000`, `share_to_feed=true`, `video_url=` (kodlanmış), `appsecret_proof=`; URL ve gövdede `tok-secret` yok; `authorization` `Bearer tok-secret`; dönüş `"1799000000000001"`.
  - `durum FINISHED okunur`, `ERROR durumunda alt kod 2207026 ayıklanır`, `bilinmeyen durum UNKNOWN olur`.
  - `media_publish creation_id ile çağrılır ve medya kimliğini döner`.
  - `yayınlanan medyanın permalink ve timestamp alanları okunur`.
  - `günlük sınır 50 içinden 3 kullanılmış → kalan 47`.
  - `Meta hatası kod ve alt kodla MetaApiError olur`: `errorLimit` 400 → `rejects` `{ code: 9, subcode: 2207042 }`; mesajda anahtar yok.
  - `instagramUserId yoksa istek gitmez`: `fetchFn` hiç çağrılmaz, `MetaApiError` 400.
  - `IG_PUBLISH_ENABLED yalnız "true" iken açık`: `igPublishEnabled({IG_PUBLISH_ENABLED:"1"}) === false`, `"true"` → `true`; `readMetaConfig({...base, META_FACEBOOK_PAGE_ID:" 123 "})?.facebookPageId === "123"`.
- [ ] **Step 2:** `cd apps/panel && npx vitest run tests/unit/ig-publish.test.ts` → FAIL.
- [ ] **Step 3:** Uygula. Form POST'u `writes.ts`'teki `postObject` deseniyle (o fonksiyon dışa açılmaz; `{success:true}` beklediği için yayın uçlarına uymaz, kendi küçük `postForm` yardımcın olur).
- [ ] **Step 4:** Test → PASS; `npx vitest run tests/unit/ig-organic.test.ts tests/unit/ads-cron-meta.test.ts` → PASS (alt kod eklemesi kırmadı).
- [ ] **Step 5: Commit** `feat(panel): Instagram Reels yayın istemcisi (konteyner, durum, yayın, günlük hak)`

### Task 3: Video biçim bilgisi (`lib/content/media-meta.ts`)

**Files:**
- Create: `apps/panel/lib/content/media-meta.ts`
- Test: `apps/panel/tests/unit/media-meta.test.ts`

**Interfaces:**
- Produces:
  - `type ReelMediaMeta = { durationS: number; width: number; height: number; vertical: boolean; coverOffsetMs: number; subtitled: boolean }`
  - Sabitler: `DEFAULT_COVER_OFFSET_MS = 1000`, `REELS_MIN_S = 3`, `REELS_MAX_S = 90`, `REELS_AD_MAX_S = 60`, `REELS_MAX_WIDTH_PX = 1920`, `VERTICAL_MIN_RATIO = 1.7`.
  - `isVertical(width: number, height: number): boolean`
  - `reelUploadBlockers(m: { durationS: number; width: number; height: number }): string[]` — sırayla ve tam metinle:
    - dikey değilse `"Video dikey değil. Telefonu dik tutup 9:16 çek."`
    - `durationS > 90` → `"Video <n> sn. Reels en fazla 90 sn olabilir; kısaltıp yeniden seç."` (`n` tam sayıya yuvarlanır)
    - `durationS < 3` → `"Video çok kısa. En az 3 sn olmalı."`
    - `width > 1920` → `"Video çözünürlüğü çok yüksek (4K). Kamerada 1080p seçip yeniden çek."`
    - süre/boyut okunamadıysa (`NaN`, 0) → `["Video okunamadı. Telefonun kamerasıyla MP4 ya da MOV çekip yeniden seç."]`
  - `buildReelMediaMeta(input: { durationS: number; width: number; height: number; coverOffsetMs?: number | null; subtitled: boolean }): ReelMediaMeta` — `durationS` bir ondalığa yuvarlanır; `coverOffsetMs` yoksa 1000, `[0, durationS*1000 - 1]` aralığına sıkıştırılır ve tam sayı.
  - `parseReelMediaMeta(raw: unknown): ReelMediaMeta | null` — altı anahtarın hepsi doğru türdeyse; aksi null (eski `{name,size,durationSec}` → null).
  - `type FormatLine = { ok: boolean; tone: "ok" | "warn" | "bad"; text: string }`
  - `reelFormatLines(m: ReelMediaMeta | null): FormatLine[]` — Z1/Z2/O1 satırları: `null` → `[{tone:"warn", text:"Biçim bilgisi yok (eski yükleme). Öğretmen videoyu yeniden seçerse kontrol edilir."}]`; aksi: `"Dikey 9:16 · <n> sn"` (dikeyse ok), reklam satırı `"Reklam için uygun (60 sn altı)"` ok ya da `"Reklam için uzun (60 sn üstü); organik paylaşılır"` warn, altyazı `"Altyazı var (öğretmen işaretledi)"` ok ya da `"Altyazı işaretlenmedi"` warn, kapak `"Kapak: <s>. saniye"` (`s = Math.round(coverOffsetMs/1000)`; 1000 → "Kapak: 1. saniye", 0 → "Kapak: ilk kare").
- [ ] **Step 1: Write the failing tests:**
  - `1080×1920 dikey, 1920×1080 değil, 1080×1350 (4:5) değil`.
  - `34 sn dikey video engelsiz`; `95 sn → "Video 95 sn. Reels en fazla 90 sn olabilir; kısaltıp yeniden seç."`; `2 sn kısa`; `2160×3840 → 4K metni`; `NaN süre → okunamadı metni`; `yatay ve uzun video iki sebebi birlikte döner`.
  - `kapak seçilmezse 1000 ms`; `kapak süreyi aşarsa son kareye çekilir` (`durationS 5`, `coverOffsetMs 9000` → `4999`); `0.4 sn kapak 400 ms kalır`.
  - `eski media_meta null döner` (Review Focus 4); `tam K17 nesnesi aynen döner`; `subtitled string ise null`.
  - `reelFormatLines`: 34 sn → reklam satırı `ok`; 75 sn → `warn`; null → tek `warn` satırı.
- [ ] **Step 2:** `npx vitest run tests/unit/media-meta.test.ts` → FAIL.
- [ ] **Step 3:** Uygula (saf; tarayıcı ve sunucu birlikte kullanır).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): Reels video biçim bilgisi ve yükleme kontrolleri (K17)`

### Task 4: Yayın kuyruğu kuralları (`lib/content/publish-queue.ts`)

**Files:**
- Create: `apps/panel/lib/content/publish-queue.ts`
- Test: `apps/panel/tests/unit/publish-queue.test.ts`

**Interfaces:**
- Consumes: `ReelMediaMeta`, `parseReelMediaMeta` (Task 3); `ContainerStatusCode`, `MetaApiError` (Task 2); `sanitize` gerekmez (metin zaten temiz gelir).
- Produces:
  - `IG_PUBLISH_STATUSES = ["yok","kuyruk","isleniyor","yayinda","hata"] as const`; `type IgPublishStatus`.
  - `type QueueRow = { id: string; code: string; topic: string; ownerId: string; kind: "reels" | "sayfa"; status: string; stage: string; approverFaceCheck: boolean | null; mediaPath: string | null; mediaMeta: ReelMediaMeta | null; caption: string | null; igPublishStatus: IgPublishStatus; igContainerId: string | null; igPublishScheduledAt: string | null; igPublishRequestedBy: string | null; igPublishRequestedAt: string | null; igMediaId: string | null; igPermalink: string | null; updatedAt: string }`
  - `publishBlocker(row: QueueRow): string | null` — istek anı kapısı, sırayla: `kind!=="reels"` → `"Yalnız Reels Instagram'da yayınlanır"`; `status!=="onaylandi"` → `"Önce içeriği onaylayın"`; `approverFaceCheck!==true` → `"MEB kutusu işaretlenmeden yayınlanamaz"`; `stage!=="organik"` → `"Bu aşamada yayınlanamaz"`; `igMediaId || igPermalink` → `"Bu içerik zaten Instagram'a bağlı"`; `igPublishStatus` `kuyruk|isleniyor` → `"Yayın zaten sırada"`; `yayinda` → `"Zaten yayında"`; `!mediaPath` → `"Video yok"`; `mediaMeta===null` → `"Video biçim bilgisi yok. Öğretmenden videoyu yeniden seçmesini isteyin ya da Instagram'da elle paylaşıp bağlantıyı yapıştırın."`; `reelUploadBlockers(mediaMeta)[0]` varsa o.
  - `stillPublishable(row: QueueRow): boolean` — B6: `status==="onaylandi" && approverFaceCheck===true && stage==="organik" && (igPublishStatus==="kuyruk" || igPublishStatus==="isleniyor")`. Metin sabiti `APPROVAL_REVOKED = "Onay geri alındı"`.
  - `type QueueStep = { kind: "wait" } | { kind: "create" } | { kind: "poll" } | { kind: "fail"; error: string }`
  - `nextStep(row: QueueRow, now: Date): QueueStep` — `kuyruk` + `scheduledAt > now` → wait; `kuyruk` → create; `isleniyor` + `igContainerId` yok → fail `"Konteyner kaydı yok; tekrar deneyin"`; `isleniyor` + `now - start > 60 dk` (başlangıç = `updatedAt`, konteynerin açıldığı güncelleme) → fail `"Instagram videoyu 1 saatte işleyemedi; tekrar deneyin"`; `isleniyor` + `now - updatedAt < 60 sn` → wait; aksi poll. Diğer durumlar wait.
  - `type ContainerOutcome = { kind: "publish" } | { kind: "wait" } | { kind: "recover" } | { kind: "fail"; error: string }`
  - `containerOutcome(s: { statusCode: ContainerStatusCode; errorSubcode: number | null }): ContainerOutcome` — FINISHED → publish; IN_PROGRESS, UNKNOWN → wait; PUBLISHED → recover; EXPIRED → fail `"Instagram konteynerinin süresi doldu; tekrar deneyin"`; ERROR → fail `igSubcodeText(errorSubcode)`.
  - `igSubcodeText(subcode: number | null): string` ve `igErrorText(err: unknown): string` — tablo (alt kod önce, sonra kod):
    - 2207042 / kod 9 → `"Günlük Instagram yayın hakkı doldu; yarın tekrar deneyin"`
    - 2207052 / 9004 → `"Instagram videoyu indiremedi; tekrar deneyin"`
    - 2207026 / 352 → `"Video biçimi Instagram'a uymuyor (MP4/MOV, H.264). Öğretmenden yeniden çekim isteyin"`
    - 2207057 → `"Kapak karesi videonun dışında; öğretmen kapağı yeniden seçmeli"`
    - 2207050 / 25 → `"Instagram hesabı kısıtlı; Instagram uygulamasından bakın"`
    - 2207051 → `"Instagram bu işlemi engelledi (spam sandı); bir süre sonra tekrar deneyin"`
    - 2207020 → `"Yükleme süresi doldu; tekrar deneyin"`
    - 2207001, 2207003, 2207032, 2207053, 2207027 → `"Instagram geçici hata verdi; tekrar deneyin"`
    - kod 190 → `"Meta anahtarı geçersiz ya da süresi dolmuş (Mert)"`
    - kod 10 ya da 200 → `"Instagram yayın izni yok (instagram_content_publish) · Mert"`
    - başka `MetaApiError` → `"Instagram hatası: " + message` (200 karaktere kısaltılır); `MetaApiError` değilse `"Instagram'a ulaşılamadı; tekrar deneyin"`.
  - Zaman: `PUBLISH_WINDOW = { startHour: 7, endHour: 22 }` (İstanbul, 22:59'a kadar); `inPublishWindow(at: Date): boolean`; `scheduleWarning(at: Date): string | null` → pencere dışıysa `"Bu saat 07:00–23:00 dışında. Yayın ertesi sabah 07:00'den sonraki ilk koşuda yapılır."`; `validateSchedule(iso: string, now: Date): { at: Date } | { error: string }` — geçersiz → `"Saat geçersiz"`; `< now + 10 dk` → `"En erken 10 dakika sonrası seçilebilir"`; `> now + 14 gün` → `"En geç 14 gün sonrası seçilebilir"`.
  - `nextPublishWindowStart(at: Date): Date` — Z2'de "yayın saati" satırı için (pencere içindeyse aynı an).
- [ ] **Step 1: Write the failing tests:**
  - `publishBlocker`: onaylı + MEB + organik + K17 tam → null; MEB yok → MEB metni; `teslim` → "Önce içeriği onaylayın"; elle bağlanmış (`igPermalink`) → "zaten Instagram'a bağlı"; `hata` durumundan tekrar → null; K17 null → eski yükleme metni (Review Focus 4).
  - `stillPublishable`: `status="duzeltme"` → false; `approverFaceCheck=null` → false; `stage="test"` → false (Review Focus 2).
  - `nextStep`: planlı saat gelecekte → wait; geldi → create; `updatedAt` 61 dk önce olan `isleniyor` → fail zaman aşımı; 30 sn önce güncellenmiş `isleniyor` → wait (Review Focus 1); 3 dk önce → poll.
  - `containerOutcome`: FINISHED → publish; ERROR + 2207026 → biçim metni; EXPIRED → süre doldu; PUBLISHED → recover.
  - `igErrorText`: `new MetaApiError("x", 400, 9, 2207042)` → günlük hak metni; `(…, 403, 10)` → izin metni; `(…, 400, 190)` → anahtar metni (Review Focus 5); `new TypeError()` → "ulaşılamadı".
  - `scheduleWarning`: `2026-10-24T23:30:00+03:00` → uyarı; `2026-10-24T22:40:00+03:00` → null; `06:59` → uyarı; `validateSchedule` 5 dk sonrası → "En erken…"; 15 gün sonrası → "En geç…".
  - `nextPublishWindowStart(2026-10-24T23:30+03:00)` → `2026-10-25T07:00+03:00`.
- [ ] **Step 2:** `npx vitest run tests/unit/publish-queue.test.ts` → FAIL.
- [ ] **Step 3:** Uygula. İstanbul saati için mevcut `lib/lead-flow/business-hours.ts` yardımcıları (`istanbulDateString`, `parseIstanbulDateTime`) kullanılır.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): Instagram yayın kuyruğu kuralları ve Türkçe hata metinleri`

### Task 5: Yayın deposu ve tek adım motoru

**Files:**
- Create: `apps/panel/lib/content/publish-store.ts`, `apps/panel/lib/content/publish-runner.ts`
- Modify: `apps/panel/lib/ads/writes.ts` (yalnız tür genişlemesi: `AdChangeLogRow.action` += `"ig_yayin"`, `level` += `"icerik"`, `source` += `"icerik" | "ayarlar" | "cron"`), `apps/panel/lib/notifications/types.ts` (`"ig_yayinlandi"`, `"ig_yayin_hata"`), `apps/panel/lib/notification-text.ts` (metin + ipucu), `apps/panel/lib/notifications/link.ts`, `apps/panel/components/notification-icon.tsx`
- Test: `apps/panel/tests/unit/publish-runner.test.ts`, `apps/panel/tests/unit/notification-text.test.ts` (ekleme), `apps/panel/tests/unit/notification-link.test.ts` (ekleme)

**Interfaces:**
- Consumes: Task 2 fonksiyonları, Task 3 `parseReelMediaMeta`, Task 4 tümü; `supabaseAdChangeStore(db).insertLog/updateLog` ve `AdChangeLogRow` (`lib/ads/writes.ts`); `notify` (`actions/notifications.ts`), `activeManagerIds` ve `CONTENT_BUCKET` (`lib/content/store.ts`); `listMedia` (`lib/ads/meta/instagram.ts`).
- Produces:
  - `LOG_PENDING = "Yayın sürüyor"`; `VIDEO_URL_SECONDS_FOR_META = 3600`.
  - `interface PublishStore { load(id: string): Promise<QueueRow | null>; listActive(limit: number): Promise<QueueRow[]>; transition(id: string, from: IgPublishStatus, patch: Partial<{ ig_publish_status: IgPublishStatus; ig_container_id: string | null; ig_publish_error: string | null; ig_publish_scheduled_at: string | null; ig_publish_requested_by: string; ig_publish_requested_at: string; ig_media_id: string; ig_permalink: string; ig_published_at: string; caption: string }>): Promise<boolean>; signedVideoUrl(path: string, seconds: number): Promise<string>; insertLog(row: AdChangeLogRow): Promise<string>; finishLog(contentId: string, status: "uygulandi" | "hata", error: string | null, extra?: Record<string, unknown>): Promise<void>; notifyOwner(row: QueueRow, type: "ig_yayinlandi", payload: Record<string, unknown>): Promise<void>; notifyManagers(type: "ig_yayin_hata", payload: Record<string, unknown>): Promise<void> }`
    - `transition` koşulludur (`.eq("id").eq("ig_publish_status", from)`), etkilenen satır yoksa `false`.
    - `listActive`: `ig_publish_status in ('kuyruk','isleniyor')`, `ig_publish_scheduled_at` null ya da `≤ now` (kuyruk için), `updated_at` artan, `limit`.
    - `finishLog`: `action='ig_yayin'`, `object_id=contentId`, `status='hata'`, `error=LOG_PENDING` olan en yeni satırı günceller (`new_value` üstüne `extra` birleştirilir); satır yoksa hiçbir şey yapmaz.
  - `supabasePublishStore(db: SupabaseClient): PublishStore` (servis rolü istemcisi).
  - `type PublishDeps = { store: PublishStore; cfg: MetaConfig | null; env: Record<string, string | undefined>; fetchFn?: FetchFn; now?: () => Date }`
  - `processItem(deps: PublishDeps, id: string): Promise<{ status: IgPublishStatus; error: string | null }>` — satırı yeniden okur, sonra:
    1. Bayrak kapalı ya da `cfg?.instagramUserId` yok → `transition(→hata, "İçerik yayını kapatıldı; açılınca yeniden yayınlayın")` (ya da `"Instagram bağlantısı kurulmadı"`), `finishLog(hata)`, yöneticilere `ig_yayin_hata`.
    2. `!stillPublishable(row)` → `hata` + `APPROVAL_REVOKED` (Review Focus 2).
    3. `nextStep`: `wait` → değişiklik yok. `fail` → `hata` + metin.
    4. `create`: `getPublishingLimit` (okunamazsa geç); `remaining ≤ 0` ise planlı satır `kuyruk`'ta kalır ve `ig_publish_error` günlük hak metni, planlı değilse `hata`; aksi `transition(kuyruk→isleniyor, {ig_publish_error:null})` **önce** (kazanamazsa Meta'ya gidilmez — Review Focus 1), sonra imzalı URL + `createReelContainer`, `ig_container_id` yazılır, ardından hemen bir `poll` adımı.
    5. `poll`: `getContainerStatus` → `containerOutcome`; `publish` → B6 koşullarını yeniden oku (`load`) ve `stillPublishable` değilse `hata`; geçerse `publishContainer` → `fetchPublishedMedia` → `transition(isleniyor→yayinda, {ig_media_id, ig_permalink, ig_published_at: timestamp ?? now, ig_publish_error:null})`, `finishLog(uygulandi, null, {mediaId, permalink})`, sahibine `ig_yayinlandi`. `recover` → `listMedia` içinde `timestamp ≥ ig_publish_requested_at` ve `caption` eşleşen ilk kayıt; bulunursa yayında, yoksa `hata` "Instagram'da yayınlandı ama bağlantı bulunamadı; bağlantıyı elle yapıştırın". `fail` → `hata`.
    6. Meta istisnası → `igErrorText(err)` ile `hata`; günlük hak alt kodu planlı satırda `kuyruk`'ta bırakır. Her `hata`da `finishLog(hata, metin)` ve yöneticilere `ig_yayin_hata` (`{ contentId, code, error }`).
  - `runPublishQueue(deps: PublishDeps, limit = 5): Promise<{ processed: number; published: number; failed: number }>` — `listActive(limit)` ve her biri için `processItem`; bir satırın istisnası diğerlerini durdurmaz.
  - Bildirim metinleri: `ig_yayinlandi` → `"<kod> Instagram'da yayınlandı"`, ipucu null, bağlantı `/gorevim`; `ig_yayin_hata` → `"<kod> Instagram'da yayınlanamadı: <error>"`, ipucu `"İçerik panosunda tekrar deneyin ya da bağlantıyı elle yapıştırın."`, bağlantı `/reklam/icerik?kod=<kod>`. Simge `Clapperboard` (accent / destructive).
- [ ] **Step 1: Write the failing tests** `publish-runner.test.ts` — bellek içi sahte `PublishStore` (satır haritası, `transition` gerçek koşullu davranır, çağrı kaydı) ve URL'ye göre yanıt veren sahte `fetch`:
  - `planlı saat gelmeden hiçbir şey yapılmaz`.
  - `kuyruk → konteyner açılır → FINISHED → yayında; ig_* alanları ve kayıt güncellenir; öğretmene bildirim`: `ig_published_at` fixture `timestamp`'i; `finishLog("uygulandi")`; `notifyOwner` bir kez.
  - `IN_PROGRESS iken isleniyor kalır ve container kimliği yazılır`.
  - `koşullu güncelleme kaybedilirse Meta'ya gidilmez` (sahte depo `transition` → false; `fetch` konteyner için hiç çağrılmaz) (Review Focus 1).
  - `60 sn içinde güncellenen isleniyor atlanır` (Review Focus 1).
  - `onay geri alınmışsa konteyner açılmaz, hata "Onay geri alındı"` (satır `status:"duzeltme"`) (Review Focus 2).
  - `yayından hemen önce MEB kutusu kalkmışsa media_publish çağrılmaz` (ilk `load` geçer, ikinci `load` `approverFaceCheck:null`).
  - `bayrak kapalıyken kuyruk satırı hata olur, Meta'ya istek gitmez` (Review Focus 3).
  - `ERROR 2207026 → Türkçe biçim metni, yöneticilere ig_yayin_hata`.
  - `günlük hak dolu: planlı satır kuyrukta kalır ve sebebi yazar; şimdi isteği hata olur`.
  - `PUBLISHED kurtarma: medya listesinden eşleşen Reels bulunur`; `bulunamazsa elle yapıştırma metni`.
  - `bir satırın istisnası diğerini durdurmaz` (`runPublishQueue` iki satır; ilki `load` atar).
  - `notification-text`: iki yeni tür metni; `notification-link`: `ig_yayin_hata` → `/reklam/icerik?kod=R-2644-A`, `ig_yayinlandi` → `/gorevim`.
- [ ] **Step 2:** `npx vitest run tests/unit/publish-runner.test.ts tests/unit/notification-text.test.ts tests/unit/notification-link.test.ts` → FAIL.
- [ ] **Step 3:** Uygula. `publish-store.ts` `content_items` sütunlarını tek sabitte seçer (`id, code, topic, owner_id, kind, status, stage, approver_face_check, media_path, media_meta, caption, ig_publish_status, ig_container_id, ig_publish_scheduled_at, ig_publish_requested_by, ig_publish_requested_at, ig_media_id, ig_permalink, updated_at`) ve `media_meta`'yı `parseReelMediaMeta` ile çevirir.
- [ ] **Step 4:** Test → PASS; `npx vitest run tests/unit` → hepsi PASS (writes türü genişlemesi `ad-changes` testlerini kırmadı).
- [ ] **Step 5: Commit** `feat(panel): Instagram yayın motoru, deposu ve yayın bildirimleri`

### Task 6: Sunucu eylemleri (`actions/instagram.ts`)

**Files:**
- Create: `apps/panel/actions/instagram.ts`
- Test: `apps/panel/tests/unit/instagram-actions.test.ts`, `apps/panel/tests/rls/instagram-actions.test.ts`

**Interfaces:**
- Consumes: `requireRole` (`lib/auth`), `createAdminSupabase`, `createServerSupabase`, `getContentRules`, `checkText` (`lib/content/checks.ts`), Task 2 `readMetaConfig`/`igPublishEnabled`, Task 3, Task 4 (`publishBlocker`, `validateSchedule`, `scheduleWarning`), Task 5 (`supabasePublishStore`, `processItem`, `LOG_PENDING`).
- Produces:
  - `type PublishReelResult = { ok: true; state: IgPublishStatus | "kapali"; message: string; warning?: string } | { error: string }`
  - `publishReel(contentId: string, input: { caption: string; scheduledAt?: string | null }): Promise<PublishReelResult>` — sırası:
    1. `requireRole("yonetici")` (gizli anahtarlı istemciden önce); `contentId` UUID değilse `"İçerik bulunamadı"`.
    2. Açıklama: `checkText(caption, { max: limits.reelsCaption, min: limits.min, banned })` geçmezse onun mesajı; 2200 karakter üstü reddedilir.
    3. `scheduledAt` verildiyse `validateSchedule`.
    4. Satırı servis rolüyle oku → `publishBlocker` null değilse o metin.
    5. `insertLog({ platform:"meta", level:"icerik", objectId:id, objectName:"<kod> · <konu>", action:"ig_yayin", oldValue:{ ig_publish_status, caption: eski }, newValue:{ caption, scheduledAt: iso|null, thumbOffsetMs, shareToFeed:true }, reason:null, gateRed:false, source:"icerik", recommendationId:null, status: açık ? "hata" : "uygulanmadi_kapali", error: açık ? LOG_PENDING : null, actorId })`. Kayıt yazılamazsa `{ error: "Kayıt yazılamadı; yayınlanmadı." }`.
    6. Bayrak kapalı → `{ ok:true, state:"kapali", message:"Kaydedildi · yayınlanmadı: içerik yayını kapalı" }`; satıra dokunulmaz (B5).
    7. `transition(from: yok|hata → "kuyruk", { ig_publish_requested_by, ig_publish_requested_at: now, ig_publish_scheduled_at, ig_publish_error:null, ig_container_id:null, caption })`; kaybedilirse `"İçerik değişti, sayfayı yenileyin"`.
    8. Planlıysa `{ ok:true, state:"kuyruk", message:"Planlandı · <gün saat>", warning: scheduleWarning(at) ?? undefined }`. Değilse `processItem` çağrılır ve sonucu döner: `yayinda` → `"Yayında · 72 saat başladı"`, `isleniyor` → `"Instagram videoyu işliyor; birkaç dakika içinde yayınlanır"`, `hata` → `{ error: "Yayınlanamadı: <sebep>" }`. Pencere dışındaysa `warning`. `revalidatePath("/reklam/icerik")`.
  - `saveReelVideoMeta(contentId: string, meta: { durationS: number; width: number; height: number; coverOffsetMs?: number | null; subtitled: boolean }): Promise<{ ok: true } | { error: string }>` — `requireRole("ogretmen")`; oturum istemcisiyle kendi satırı (`owner_id = me`, `status in ('taslak','duzeltme')`, `kind='reels'`); `reelUploadBlockers` boş değilse ilk metin; `media_meta = { ...mevcut, ...buildReelMediaMeta(meta) }` yazılır (RLS + kolon yetkisi). Satır eşleşmezse `"Bu içerik şu an değiştirilemez"`.
- [ ] **Step 1: Write the failing unit tests** (`content-actions.test.ts` mock deseni: `@/lib/auth`, `@seker/auth/admin`, `@/lib/content/publish-store`, `@/lib/content/publish-runner` sahte):
  - `öğretmen ve danışman publishReel çağıramaz; gizli anahtarlı istemci oluşturulmaz`.
  - `yasaklı ifadeli açıklama reddedilir, kayıt yazılmaz` (`"En iyi okul"` → `"\"en iyi\" kanıt ister, kullanılamaz"`).
  - `MEB kutusu işaretsizse reddedilir` ve `elle bağlanmış içerik reddedilir`.
  - `eski yüklemede biçim bilgisi yok metni döner` (Review Focus 4).
  - `bayrak kapalı: uygulanmadi_kapali kaydı yazılır, durum değişmez, processItem çağrılmaz, mesaj "Kaydedildi · yayınlanmadı: içerik yayını kapalı"` (Review Focus 3).
  - `bayrak açık + şimdi: kayıt "hata/Yayın sürüyor" ile yazılır, kuyruğa alınır, processItem bir kez çağrılır, yayında mesajı döner`.
  - `bayrak açık + 23:30 planı: kuyruk, processItem çağrılmaz, warning dolu`.
  - `processItem hata dönerse "Yayınlanamadı: <sebep>"`.
  - `kayıt yazılamazsa yayın yapılmaz`.
  - `saveReelVideoMeta yatay videoyu reddeder`; `yönetici çağıramaz`.
- [ ] **Step 2: Write the failing RLS test** `tests/rls/instagram-actions.test.ts`: öğretmen oturum istemcisiyle, eylemin kullandığı aynı güncelleme (`update({media_meta})` + `.eq("owner_id")` + `.in("status",["taslak","duzeltme"])`) kendi taslağında 1 satır, teslim edilmiş içerikte 0 satır, başkasının içeriğinde 0 satır etkiler.
- [ ] **Step 3:** Testler → FAIL.
- [ ] **Step 4:** Uygula.
- [ ] **Step 5:** Testler → PASS.
- [ ] **Step 6: Commit** `feat(panel): publishReel ve saveReelVideoMeta eylemleri`

### Task 7: Cron `/api/cron/content`

**Files:**
- Create: `apps/panel/app/api/cron/content/route.ts`
- Modify: `infra/docker-compose.yml` (panel env'ine yalnız ekleme: `IG_PUBLISH_ENABLED: ${IG_PUBLISH_ENABLED:-}`, `META_FACEBOOK_PAGE_ID: ${META_FACEBOOK_PAGE_ID:-}`)
- Test: `apps/panel/tests/unit/content-cron-route.test.ts`

**Interfaces:**
- Consumes: Task 5 `runPublishQueue`, `supabasePublishStore`; `readMetaConfig`; `createAdminSupabase`.
- Produces: `GET` — `CRON_SECRET` yoksa ya da `authorization` `Bearer <secret>` değilse 401 `{error:"unauthorized"}` (`/api/cron/ads` deseni). Sonra her zaman `runPublishQueue({ store, cfg: readMetaConfig(), env: process.env }, 5)` (bayrak kapalıysa koşucu kuyruktaki satırları kapatır; kuyruk boşsa hiçbir Meta isteği yok). Yanıt `{ ok: true, processed, published, failed }`; koşucu bütünüyle patlarsa 500 `{ ok:false, error }` ve `console.error("[cron/content]", …)`. `export const dynamic = "force-dynamic"`.
- Crontab satırı (dala **eklenmez**, teslimde koordinatöre yazılır):
  `*/5 7-22 * * * . /app/env.sh; curl -fsS -m 240 -H "Authorization: Bearer $CRON_SECRET" http://panel:3000/api/cron/content > /dev/null 2>> /proc/1/fd/1`
- [ ] **Step 1: Write the failing test** (`ads-cron-organic.test.ts` deseni; `@/lib/content/publish-runner` ve `@/lib/content/publish-store` `vi.mock`):
  - `gizli anahtar yoksa ya da yanlışsa 401 ve koşucu çağrılmaz`.
  - `koşucu sonucu yanıtta döner` (`{processed:2, published:1, failed:1}` → `ok:true`).
  - `koşucu 5 sınırıyla çağrılır ve env geçirilir` (bayrak kapalıyken de çağrılır: kuyruğu kapatması için).
  - `koşucu patlarsa 500 ve anahtar sızmaz` (hata mesajında `CRON_SECRET` değeri yok).
- [ ] **Step 2:** `npx vitest run tests/unit/content-cron-route.test.ts` → FAIL.
- [ ] **Step 3:** Uygula; compose ekini yap.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): /api/cron/content Instagram yayın kuyruğunu bitirir`

### Task 8: O1 · Öğretmen yüklemesinde biçim kontrolü, kapak karesi, altyazı

**Files:**
- Modify: `apps/panel/components/video-upload.tsx`, `apps/panel/components/content-task-form.tsx` (kapak ve altyazı alanlarının yeri; `VideoMeta` türü), `apps/panel/lib/queries/content.ts` (`media_meta` çevirisi K17 alanlarını korur)
- Create: `apps/panel/components/cover-frame-picker.tsx` (istemci), `apps/panel/lib/content/video-probe.ts` (tarayıcı yardımcıları)
- Test: `apps/panel/tests/unit/content-task-view.test.ts` (ekleme), `apps/panel/tests/unit/video-probe.test.ts`

**Interfaces:**
- Consumes: Task 3 (`reelUploadBlockers`, `buildReelMediaMeta`, `parseReelMediaMeta`, `reelFormatLines`, `DEFAULT_COVER_OFFSET_MS`), Task 6 `saveReelVideoMeta`; mevcut `requestVideoUpload`, `saveContentDraft`.
- Produces:
  - `MyTask.mediaMeta` türü `{ name: string; size: number; durationSec?: number; reel: ReelMediaMeta | null } | null` (`reel` = `parseReelMediaMeta(media_meta)`); `VideoMeta` (video-upload.tsx) aynı.
  - `probeVideo(file: File, timeoutMs = 4000): Promise<{ durationS: number; width: number; height: number } | null>` — gizli `<video preload="metadata">`, `loadedmetadata`'da `duration`, `videoWidth`, `videoHeight`; bugünkü `readDuration`'ın yerini alır. Saf yardımcı `probeResult(video: { duration: number; videoWidth: number; videoHeight: number }): {...} | null` test edilir.
  - Yükleme sırası (`VideoUpload.onFile`): boyut kontrolü → `probeVideo` → `reelUploadBlockers` boş değilse kırmızı kutuda **tüm** sebepler alt alta ve yükleme başlamaz (O1: "Uygun olmayan video yüklenmez, sebep yazar") → `requestVideoUpload` → PUT → `saveContentDraft({mediaPath, mediaMeta:{name,size,durationSec}})` → `saveReelVideoMeta(id, {durationS,width,height,coverOffsetMs:1000,subtitled:<mevcut kutu>})`. Okunamayan video (`null`) de engellenir (okunamadı metni).
  - Yükleme sonrası etiket tasarımdaki gibi: `"✓ Dikey 9:16 · 34 sn · 48 MB"` ve `"✓ Reklam için uygun (60 sn altı)"` ya da uyarı satırı (`reelFormatLines`).
  - `CoverFramePicker({ file: File | null, durationS: number, valueMs: number, onChange(ms: number) })` — dosya bu oturumda seçildiyse: `<input type="range" min=0 max=durationS*1000-1 step=100>` + `<video>` önizleme (`currentTime = ms/1000`) ve "Kapak karesi" başlığı; seçim bırakılınca (`onPointerUp`/`onKeyUp`, 600 ms gecikme) `saveReelVideoMeta` ile kaydedilir. Sayfa yeniden açıldıysa (dosya yok): `"Kapak: <n>. saniye · değiştirmek için videoyu yeniden seç"`.
  - "Altyazı ekledim" kutusu (≥ 44 px dokunma alanı) yüz sorusunun altında; değişince `saveReelVideoMeta` (video yoksa yalnız yerel durum, yüklemede gönderilir). Teslimi engellemez (K17: yalnız reklamda gerekir); yanında küçük not `"Reklama girmesi için altyazı gerekir."`
  - Görevin altındaki not tasarımdaki metinle: `"Teslimden sonra Zehra Hanım onaylar ve Instagram'da yayınlar; sen bir şey yapmazsın."` (ad sabit değil: `"Teslimden sonra yönetici onaylar ve Instagram'da yayınlar; sen bir şey yapmazsın."`).
- [ ] **Step 1: Write the failing tests:**
  - `probeResult`: `{duration: 34.2, videoWidth:1080, videoHeight:1920}` → `{durationS:34.2, width:1080, height:1920}`; `duration: NaN` → null; `videoWidth:0` → null.
  - `loadMyTasks satırı K17'yi korur`: `media_meta` tam K17 + `name,size` → `mediaMeta.reel.vertical === true`; eski biçim → `reel === null`, `name` korunur.
- [ ] **Step 2:** `npx vitest run tests/unit/video-probe.test.ts tests/unit/content-task-view.test.ts` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS. Kontrolcü: `pnpm --filter @seker/panel dev` yerelde, `ogretmen@test.local`, 390 px; yatay bir video seçince yükleme başlamadan sebep görünür; dikey 30 sn video yüklenir, kapak kaydı ve altyazı kutusu sayfa yenilenince korunur; tasarım `O1-Gorevim.dc.html` ile karşılaştırılır.
- [ ] **Step 5: Commit** `feat(panel): Görevim'de Reels biçim kontrolü, kapak karesi ve altyazı işareti`

### Task 9: Bağlantı durumu ve Z6 kartları

**Files:**
- Create: `apps/panel/lib/ads/meta/account.ts`, `apps/panel/lib/ads/connections.ts`, `apps/panel/lib/ads/connections-cache.ts` (yalnız sunucu), `apps/panel/components/ads/ConnectionsCard.tsx`
- Modify: `apps/panel/app/(app)/reklam/ayarlar/page.tsx` (import + tek satır `<ConnectionsCard snapshot={await loadConnections()} />`, `AdSettingsForm`'un üstünde), `apps/panel/app/api/cron/ads/route.ts` (Meta bölümünün sonunda kendi `try`'ında `refreshConnections(db)`; hatası diğer adımları bozmaz, yanıta `connections: "yenilendi" | "hata"`)
- Test: `apps/panel/tests/unit/connections.test.ts`, `apps/panel/tests/unit/ads-cron-connections.test.ts`

**Interfaces:**
- Consumes: Task 2 (`getPublishingLimit`, `igPublishEnabled`, `facebookPageId`), `readMetaConfig`, `readAdsConfig` (`lib/ads/config.ts`), `adsWriteEnabled` (`lib/ads/writes.ts`), `requestNow`.
- Produces:
  - `account.ts`: `fetchIgUsername(cfg, fetchFn?): Promise<string>` (`GET /{ig}?fields=username`); `fetchFacebookPage(cfg, pageId: string, fetchFn?): Promise<{ name: string; instagramId: string | null }>` (`fields=name,instagram_business_account`); `fetchAdAccount(cfg, fetchFn?): Promise<{ name: string; currency: string; accountStatus: number }>` (`fields=name,currency,account_status`); `fetchPixelName(cfg, fetchFn?): Promise<string>` (`fields=name`, TEYİTSİZ). URL yorumları tablodan.
  - `connections.ts`:
    - `type ConnectionState = "ok" | "warn" | "bad" | "off"`
    - `type ConnectionKey = "instagram" | "facebook" | "reklam_hesabi" | "piksel" | "capi" | "canli_yazim" | "icerik_yayini" | "google"`
    - `type ConnectionRow = { key: ConnectionKey | string; title: string; detail: string; state: ConnectionState; label: string }`
    - `type ConnectionSnapshot = { checkedAt: string; rows: ConnectionRow[]; igUsername: string | null; publishLimit: { used: number; total: number; remaining: number } | null; igReady: boolean }` (`igReady` = Instagram ve Facebook satırları `ok`).
    - `CONNECTIONS_KEY = "baglanti_durumu"`, `SNAPSHOT_TTL_MS = 15 * 60_000`.
    - `checkConnections(deps: { env: Record<string, string | undefined>; fetchFn?: FetchFn; now: Date }): Promise<ConnectionSnapshot>` — **asla fırlatmaz**; her Meta çağrısı kendi `try`'ında. Satırlar ve metinler (tasarım tonu):
      - Instagram hesabı: `META_INSTAGRAM_USER_ID` yok → `off`, `"Kurulmadı · META_INSTAGRAM_USER_ID"`, etiket `"Kurulmadı"`; kullanıcı adı okunur + `getPublishingLimit` başarılı → `ok`, `"@<ad> · içerik yayınlama izni · bugün kalan hak <kalan>/<toplam>"`, `"Bağlı"`; ad okunur ama sınır okunamaz → `bad`, `"@<ad> · içerik yayınlama izni yok (instagram_content_publish)"`, `"İzin yok"`; ad okunamaz → `bad`, `igErrorText(err)`.
      - Facebook sayfası: `META_FACEBOOK_PAGE_ID` yok → `off` `"Kurulmadı · META_FACEBOOK_PAGE_ID"`; `instagramId === instagramUserId` → `ok` `"<ad> · Instagram'a bağlı"`; farklı/boş → `bad` `"<ad> · bu Instagram hesabına bağlı değil"`.
      - Meta reklam hesabı: `accountStatus === 1` → `ok` `"<act_id> · <currency>"`, `"Sağlıklı"`; diğerleri `bad` `"Durum: <ad>"` (1 ACTIVE, 2 Kapalı, 3 Ödeme bekliyor, 7 Risk incelemesi, 9 Ek süre, 101 Kapatıldı; bilinmeyen sayı aynen).
      - Piksel: env yok → `off`; ad okunur → `ok`; okunamazsa `warn` `"Kimlik var, okunamadı"`.
      - Conversions API: `capiEnabled` → `ok` `"Açık"`; değilse `off` `"Kapalı (META_CAPI_ENABLED)"`.
      - Canlı yazım: `ADS_WRITE_ENABLED==="true"` → `ok` `"Panel platformda kurar ve değiştirir"`, `"Açık"`; değilse `warn`, `"Sadece göster"`.
      - İçerik yayını: `igPublishEnabled` → `ok` `"Panel Reels'i Instagram'a gönderir"`, `"Açık"`; değilse `warn` `"Yayınla kayda geçer, Instagram'a gitmez"`, `"Kapalı"`.
      - Google Ads: `readAdsConfig(env)` → `ok` `"Bağlı"`; yoksa `off`.
    - Meta yapılandırması (`readMetaConfig`) hiç yoksa Meta satırları istek atmadan `off`.
  - `connections-cache.ts`: `loadConnections = cache(async (): Promise<ConnectionSnapshot> => …)` — `app_settings[CONNECTIONS_KEY]` (servis rolü) `checkedAt` 15 dk'dan yeniyse onu, değilse `checkConnections({ env: process.env, now: await requestNow() })` ve yazar (`upsert`, hata yutulur, `console.error`). `refreshConnections(db, now = new Date()): Promise<ConnectionSnapshot>` cron için (her zaman yeniden hesaplar ve yazar).
  - `ConnectionsCard({ snapshot, extraRows = [] }: { snapshot: ConnectionSnapshot; extraRows?: ConnectionRow[] })` — başlık `"Bağlantılar · Mert kurar, siz yalnız görürsünüz"`; satır: başlık, `detail` küçük, sağda rozet (`ok` accent, `warn` warning, `bad` destructive, `off` muted); altta `"Son kontrol: <saat>"` ve tasarımdaki not `"Biri kırmızıya dönerse Bu hafta ekranı uyarır, "Reklam testine al" kapanır. Hesap kısıtlaması gibi Meta tarafı sorunlar burada sebebiyle yazar."`
- [ ] **Step 1: Write the failing tests** `connections.test.ts` (sahte `fetch` URL'ye göre):
  - `Meta yapılandırması yokken istek gitmez, Meta satırları "Kurulmadı"` (Review Focus 5).
  - `kullanıcı adı ve hak okunursa Instagram yeşil, detayda @ad ve kalan hak`.
  - `hak okunamazsa (kod 10) "İzin yok" kırmızı`.
  - `sayfa başka Instagram hesabına bağlıysa kırmızı`.
  - `reklam hesabı account_status 3 → "Ödeme bekliyor" kırmızı`.
  - `her Meta çağrısı 500 dönerse checkConnections fırlatmaz` (Review Focus 5).
  - `IG_PUBLISH_ENABLED ve ADS_WRITE_ENABLED kapalıysa iki satır sarı`.
  - `igReady yalnız Instagram ve Facebook yeşilken true`.
  - `ads-cron-connections.test.ts`: `refreshConnections` patlasa da `/api/cron/ads` harcama ve CAPI sonuçlarını döner, yanıtta `connections:"hata"`; Meta yapılandırması yokken `refreshConnections` çağrılmaz ve yanıt bugünkü gibi kalır (mevcut `ads-cron-*.test.ts` değişmeden PASS).
- [ ] **Step 2:** `npx vitest run tests/unit/connections.test.ts tests/unit/ads-cron-connections.test.ts` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS; `npx vitest run tests/unit/ads-cron-route.test.ts tests/unit/ads-cron-meta.test.ts tests/unit/ads-cron-organic.test.ts tests/unit/ads-cron-objects.test.ts` → PASS. Kontrolcü yerelde Ayarlar'ı açar (Meta env yok: tüm Meta satırları gri "Kurulmadı", sayfa hata vermez) ve `Z6-Baglantilar.dc.html` bağlantı bölümüyle karşılaştırır.
- [ ] **Step 5: Commit** `feat(panel): Ayarlar'da bağlantı durumu kartları ve sabah yenilemesi`

### Task 10: Z1 kontroller + Instagram önizlemesi, Z2 yayın penceresi, kart durumu

**Files:**
- Create: `apps/panel/components/reel-publish-panel.tsx` (istemci; `ReelPublishPanel`, `openReelPublish`), `apps/panel/components/reel-review-extras.tsx` (istemci; `ReelAutoChecks`, `InstagramPreview`), `apps/panel/lib/content/reel-review.ts` (saf)
- Modify: `apps/panel/lib/content/board.ts` (`BoardItem` + seçilen kolonlar), `apps/panel/app/(app)/reklam/icerik/page.tsx` (organik yayınlanmamış Reels için de video adresi; `reelChecks` ve `ReelPanelContext` üretimi; `new Date()` yerine `requestNow()`), `apps/panel/components/content-board.tsx` (`reel` prop'unu detaya geçirir), `apps/panel/components/content-card-detail.tsx` (tek satırlık eklemeler)
- Test: `apps/panel/tests/unit/reel-review.test.ts`, `apps/panel/tests/unit/content-board.test.ts` (ekleme)

**Interfaces:**
- Consumes: Task 3 `reelFormatLines`, `parseReelMediaMeta`; Task 4 `scheduleWarning`, `validateSchedule`, `nextPublishWindowStart`, `IgPublishStatus`; Task 6 `publishReel`; Task 9 `loadConnections`, `ConnectionSnapshot`; mevcut `checkText`, `getContentRules`, `linkInstagramPost`, `Sheet` (`components/sheet.tsx`, `ad-change-dialog.tsx` deseni), `useToast`.
- Produces:
  - `BoardItem` ek alanları: `approvedAt: string | null`, `approverFaceCheck: boolean | null`, `reelMeta: ReelMediaMeta | null`, `igPublishStatus: IgPublishStatus`, `igPublishError: string | null`, `igPublishScheduledAt: string | null`, `reelChecks: CheckLine[] | null` (sayfada doldurulur, `loadBoardItems` null bırakır).
  - `reel-review.ts`: `type CheckLine = { ok: boolean; tone: "ok" | "warn" | "bad"; text: string }`; `reelReviewChecks(item: Pick<BoardItem, "caption" | "faceAnswer" | "reelMeta">, rules: { banned: string[]; limits: ContentLimits }): CheckLine[]` — Z1 "Otomatik kontroller" sırası: biçim ve süre (`reelFormatLines` ilk iki satırı birleşik: `"Dikey 9:16, 34 saniye (reklam için 60 sn altı)"`), açıklama (`"Açıklama 118 / 150 karakter, yasaklı ifade yok"` ya da `checkText` mesajı, `bad`), öğretmen cevabı (`faceAnswer===false` → `"Öğretmenin cevabı: "Videoda ve yazıda öğrenci yüzü ya da adı yok""` ok; aksi `bad`), altyazı (`ok`/`warn`). `type PanelState = { kind: "hazir" } | { kind: "planli"; at: string } | { kind: "isleniyor" } | { kind: "yayinda"; publishedAt: string; permalink: string | null } | { kind: "hata"; error: string } | { kind: "elle"; permalink: string } | { kind: "gizli" }`; `reelPanelState(item: BoardItem): PanelState` — `kind!=="reels" || stage!=="organik" || status!=="onaylandi"` → gizli; `igPermalink && igPublishStatus!=="yayinda"` → elle; sonra durum eşlemesi. `permalinkLabel(url: string): string` → `"instagram.com/reel/C9xk…"` (kısa kod 4 karakter + `…`).
  - `type ReelPanelContext = { publishEnabled: boolean; igUsername: string | null; igReady: boolean; remaining: number | null; total: number | null; limits: ContentLimits; banned: string[] }` — sayfa `loadConnections()` ile **yalnız** organik/kontrol aşamasında Reels varsa üretir; yoksa null ve Meta'ya gidilmez.
  - Sayfa: `videoUrls` filtresi `(stage==="kontrol" && kind==="reels") || (stage==="organik" && kind==="reels" && igPublishStatus!=="yayinda" && !igPermalink)`; `reelChecks` her `kontrol`/`organik` Reels için `reelReviewChecks`.
  - `InstagramPreview({ username, caption, videoUrl, coverOffsetMs })` — Z1 "Instagram'da böyle görünecek" ve Z2 "Reels önizleme": 9:16 çerçeve, `<video src={videoUrl + "#t=" + sn} muted playsInline preload="metadata">` kapak karesi, üstte `username ?? "instagram"` ve "♫ Orijinal ses · <ad>", altta açıklamanın ilk 2 satırı; alt yazı `"Açıklama <n> / <max> · kapak: <s>. saniye"`.
  - `ReelAutoChecks({ lines }: { lines: CheckLine[] })` — başlık "Otomatik kontroller", ✓/! satırları.
  - `ReelPublishPanel({ item, videoUrl, ctx, now })` — `reelPanelState`'e göre:
    - `hazir`: ana düğme `"Instagram'da yayınla"` (56 px) → Z2 `Sheet`; bayrak kapalıysa altında `"İçerik yayını kapalı. Yayınla kayda geçer, Instagram'a gitmez."`; `"Ya da Instagram'da elle paylaşıp bağlantıyı yapıştırın"` açılır bağlantısı mevcut organik bağlantı alanına kaydırır.
    - `planli`: `"Planlandı · <gün saat>"` + `scheduleWarning` varsa altında.
    - `isleniyor`: `"Instagram videoyu işliyor · birkaç dakika"`.
    - `yayinda`: `"Yayında · 72 saat başladı"`, `"<gün saat> · <permalinkLabel>"` (bağlantı yeni sekmede), `"Organik sayılar her sabah güncellenir."`
    - `hata`: `"Yayınlanamadı: <error>"` + `"Tekrar dene"` (Z2'yi açar).
    - `elle`: `"Elle bağlandı · <permalinkLabel>"`.
  - Z2 `Sheet` (tasarım `Z2-Yayinla.dc.html`): başlık `"Instagram'da yayınla"`, alt metin `"Panel videoyu @<ad> hesabına Reels olarak gönderir. Uygulamayı açmanız gerekmez."`; sol `InstagramPreview`; "Açıklama (son düzeltme)" `textarea` (canlı `checkText` + sayaç, `"Öğretmenin yazdığı metin. Kontrol geçti."`); "Kapak karesi" `"Öğretmen <s>. saniyeyi seçti. Ayrı görsel yüklenmez."`; "Ne zaman" `Şimdi` / `Saat seç` (`datetime-local`, İstanbul; seçince `scheduleWarning`); hesap kontrolleri listesi: `"Instagram hesabı bağlı: @<ad> (işletme hesabı)"`, `"Facebook sayfası bağlı"` (`ctx.igReady`), `"Bugün kalan yayın hakkı: <kalan>/<toplam>"` (null → `"Kalan hak okunamadı"` warn), `"Biçim: dikey 9:16, <n> sn"`, `"Öğrenci yüzü/adı yok: öğretmen + onaylayan"`; düğmeler `"Instagram'da yayınla"` (açıklama kontrolü geçmezse ya da bayrak açıkken `igReady` false ise kapalı; bayrak kapalıyken açık çünkü yalnız kayıt yazar) ve `"Sonra"`. Alt not tasarımdaki metin. Sonuç toast (`message`, `warning` ikinci satır) + `router.refresh()`; `error` pencerede kırmızı.
  - `openReelPublish(contentId: string): void` — `sessionStorage` anahtarı `z2:<id>` (try/catch); `ReelPublishPanel` ilk çizimde anahtarı görürse Z2'yi açar ve siler.
  - `content-card-detail.tsx` değişiklikleri (yalnız bunlar): `Props`'a `reel: ReelPanelContext | null`; `ReelsReview` içinde açıklama bloğunun yerine `<InstagramPreview …/>` ve altına `<ReelAutoChecks lines={item.reelChecks ?? []} />` (tek satır); reels onay düğmesi metni `"Onayla ve yayına hazırla"`; `approveContent` çağrısının `after`'ına `() => item.kind === "reels" && openReelPublish(item.id)`; organik bağlantı alanının üstüne `{reel ? <ReelPublishPanel item={item} videoUrl={videoUrl} ctx={reel} now={now} /> : null}` (tek satır). Elle bağlantı alanı yerinde kalır.
- [ ] **Step 1: Write the failing tests** `reel-review.test.ts`:
  - `Z1 kontrolleri tasarım sırasıyla ve metniyle döner` (34 sn dikey, 118 karakter, yüz Hayır, altyazı var → 4 `ok`; ilk satır `"Dikey 9:16, 34 saniye (reklam için 60 sn altı)"`).
  - `yasaklı ifade açıklama satırını kırmızı yapar`; `biçim bilgisi yoksa ilk satır uyarı` (Review Focus 4).
  - `reelPanelState`: onaylı organik `yok` → hazir; `kuyruk` + planlı → planli; `yayinda` → yayinda; `hata` → hata ve metin; elle bağlanmış → elle; `test` aşaması → gizli; `kontrol` → gizli.
  - `permalinkLabel("https://www.instagram.com/reel/C9xkAbCd/") === "instagram.com/reel/C9xk…"`.
  - `content-board.test.ts`: `loadBoardItems` eşlemesi yeni alanları taşır (`igPublishStatus` varsayılan `"yok"`, `reelMeta` K17 → nesne).
- [ ] **Step 2:** `npx vitest run tests/unit/reel-review.test.ts tests/unit/content-board.test.ts` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS; `pnpm --filter @seker/panel typecheck` temiz. Kontrolcü yerelde yönetici ile: Kontrol kartında önizleme + kontroller + MEB kutusu (işaretsizken "Onayla ve yayına hazırla" kapalı); onaydan sonra Z2 kendiliğinden açılır; `IG_PUBLISH_ENABLED` boşken "Instagram'da yayınla" toast `"Kaydedildi · yayınlanmadı: içerik yayını kapalı"`, kart `hazir` kalır, `ad_change_log`'da `uygulanmadi_kapali` satırı; 1440 px'te `Z1-Kontrol.dc.html` ve `Z2-Yayinla.dc.html` ile karşılaştırılır.
- [ ] **Step 5: Commit** `feat(panel): Kontrol kartında Instagram önizlemesi, otomatik kontroller ve Instagram'da yayınla`

### Task 11: Kılavuzlar, son kontroller ve teslim

**Files:**
- Modify: `docs/pazarlama-kurulum.md` ("Instagram (Meta)" altına "### Instagram'a yayın (Paket B)"), `docs/yonetici-reklam-kilavuzu.md` (yeni "## Reels'i Instagram'da yayınlama")

- [ ] **Step 1:** `pazarlama-kurulum.md`: yeni env `IG_PUBLISH_ENABLED` (varsayılan boş = kapalı; açmak §12 adım 7: Ayarlar'da Instagram ve Facebook satırları yeşilken), `META_FACEBOOK_PAGE_ID` (sayfa kimliği nereden bulunur: Meta Business Suite → Sayfa ayarları); sistem kullanıcısı izinleri `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` (+ `ads_management`); Instagram hesabı profesyonel ve sayfaya bağlı olmalı; yeni cron satırı (`*/5 7-22`); günlük yayın hakkı API'den okunur (Meta sayfaları 50 ve 100 diyor, panel gerçeğini gösterir); ilk gerçek yayında doğrulanacaklar: imzalı Supabase URL'si Meta tarafından indiriliyor mu (2207052 gelirse not et), `status` alanındaki hata biçimi.
- [ ] **Step 2:** `yonetici-reklam-kilavuzu.md` (Zehra için, 5–7 madde): onay → pencere açılır; açıklama son düzeltme; Şimdi / Saat seç (07:00–23:00 dışı ertesi sabah); "Yayında · 72 saat başladı"; "Yayınlanamadı: sebep · Tekrar dene"; "içerik yayını kapalı" ne demek; yedek yol: Instagram'da elle paylaş, bağlantıyı yapıştır.
- [ ] **Step 3:** `pnpm turbo run lint typecheck test` → PASS; `pnpm --filter @seker/web build` → başarılı; `NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x pnpm --filter @seker/panel build` → başarılı (cache-components: sunucu bileşenlerinde `new Date()` yok).
- [ ] **Step 4:** `superpowers:requesting-code-review` ile dal farkı; bulgular düzeltilir, testler yeniden yeşil.
- [ ] **Step 5: Commit** `docs: Instagram'a yayın kurulumu ve yönetici kılavuzu`
- [ ] **Step 6:** `git fetch && git rebase origin/main` (A birleştiyse; `content-card-detail.tsx`, `board.ts`, `icerik/page.tsx` çakışmaları B'nin eklemeleri korunarak çözülür), testler yeniden. Teslim şablonu `../seker-platform-ledgers/teslim/feat-reklam-konsolu-b.md` + koordinatöre SendMessage:
  ```
  dal: feat/reklam-konsolu-b   sha: <sha>
  worktree: ../seker-platform-rk-b
  dokunulan: packages/db/supabase/migrations/0025_ig_yayin.sql, packages/db/src/database.types.ts,
    apps/panel/lib/ads/meta/{publish,account,config,insights}.ts, apps/panel/lib/ads/{connections,connections-cache,writes}.ts,
    apps/panel/lib/content/{media-meta,publish-queue,publish-store,publish-runner,reel-review,video-probe,board}.ts,
    apps/panel/lib/queries/content.ts, apps/panel/lib/notifications/{types,link}.ts, apps/panel/lib/notification-text.ts,
    apps/panel/actions/instagram.ts, apps/panel/app/api/cron/{content,ads}/route.ts,
    apps/panel/app/(app)/reklam/{icerik,ayarlar}/page.tsx, apps/panel/components/{reel-publish-panel,reel-review-extras,cover-frame-picker,video-upload,content-task-form,content-board,content-card-detail,notification-icon}.tsx,
    apps/panel/components/ads/ConnectionsCard.tsx, apps/panel/tests/**, infra/docker-compose.yml, docs/{pazarlama-kurulum,yonetici-reklam-kilavuzu}.md
  migration: 0025 (dosya: packages/db/supabase/migrations/0025_ig_yayin.sql) — kod yeni kolonlara dayanıyor, main push'tan önce prod'a
  kontroller: lint ✓ typecheck ✓ test ✓ web build ✓ panel build ✓
  env / crontab değişikliği: env IG_PUBLISH_ENABLED (boş bırak), META_FACEBOOK_PAGE_ID (Mert);
    crontab ekle: */5 7-22 * * * . /app/env.sh; curl -fsS -m 240 -H "Authorization: Bearer $CRON_SECRET" http://panel:3000/api/cron/content > /dev/null 2>> /proc/1/fd/1
  riskler: imzalı Supabase URL'sinin Meta'ca indirilmesi canlı denenmedi; günlük hak sayısı Meta sayfalarında çelişkili (API'den okunur);
    0026 ad_change_log action+source kısıtlarını B değerleriyle yeniden kurmalı; lib/ads/writes.ts tür birliği C'de yeniden genişler
  Mert'ten beklenen karar: IG_PUBLISH_ENABLED=true ne zaman (Ayarlar'da Instagram+Facebook yeşil olunca); META_FACEBOOK_PAGE_ID değeri
  ```
- [ ] **Step 7:** Mert'e Türkçe kısa özet (ne çıktı, açmak için ne gerekir).

## Açık sorular (koordinatöre / Mert'e)

1. Günlük yayın hakkı: spec K15 "25", Meta referansı 50, rehber 100. Plan sayıyı API'den okur; spec metni düzeltilmeli mi?
2. Z6 "Onay metni (sürüm 2)" kartı: `NEXT_PUBLIC_CONSENT_VERSION` panel env'inde yok. B'de atlandı; isteniyorsa panel env'ine eklenir (koordinatör) ya da kart C/A'ya.
3. Z6 CAPI kartındaki "son gönderim 06:02" ve piksel "Otomatik Gelişmiş Eşleştirme kapalı" API'den güvenle okunamıyor; B yalnız env ve piksel adını gösterir. Yeterli mi?
4. Öğretmen teslim anında K17 zorlaması DB'de değil (B3: guard değişmez). Eski yüklemeli taslaklar teslim edilebilir; yayın anında reddedilir. Kabul mü?
5. Zamanlanmış yayını iptal: bu turda düğme yok (Ruling). Zehra'nın ihtiyacı olursa küçük ek iş.
6. Görev dizini (`2026-10-23-00-…-index.md`) Paket B dış şartında yalnız `instagram_content_publish` diyor; `content_publishing_limit` ve sayfa kartı için `pages_read_engagement` ve (İşletme rolüyle) `ads_management`/`ads_read` de gerekir — spec §5 bunları zaten listeliyor, dizin güncellenebilir.
