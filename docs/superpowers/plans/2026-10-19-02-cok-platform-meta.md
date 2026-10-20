# Aşama 2 · Çok Platformlu Veri + Meta — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reklam verisi platform bilgisi taşısın; Instagram (Meta) reklam harcaması reklam seviyesinde panele gelsin, Meta'ya `Lead`/`Schedule`/`Enrolled` olayları gidebilsin (kapalı gelir), web formu `fbclid`/`_fbc`/`_fbp` ve onay sürümünü kaydetsin; mevcut Google davranışı hiç değişmesin.

**Architecture:** DB'de `leads.ad_platform` (K10) ve platformlu `ad_spend_daily`/`conversion_uploads`. Google kodu yerinde kalır, yalnız sorgularına `platform='google'` süzgeci eklenir. Meta tarafı `apps/panel/lib/ads/meta/*` altında saf modüller (yapılandırma, insights eşleme, CAPI yükü, uygunluk kuralı K9) ve `fetch` enjekte edilen istemci. Cron `/api/cron/ads` iki platformu sırayla, birbirinden bağımsız çalıştırır. Gönderim kararı (K9, iptal, 7 gün) tek yerde: `metaEligibility`.

**Tech Stack:** Next.js 16 (panel, web), Supabase Postgres + RLS, Vitest (birim + `tests/rls` yerel Supabase), Node 22 `crypto` (SHA-256, HMAC). Yeni bağımlılık yok.

**Spec:** `docs/superpowers/specs/2026-10-19-reklam-suiti-design.md` — Bölüm 2 (G2, G3, G6), 4, 5 (KVKK, Meta hesabı yok, API sürümleri), 6 (Meta olayları, K7, K9, K10, K11), 7, 9. Meta planı: https://claude.ai/artifact/7JfCNTUwTei6rxWeL8u5VM (bölüm "Meta bağlantısı", "Harcama ve sonuç verisi", "Ölçüm").

## Global Constraints

- **Google bozulmaz:** `tests/unit/ads-*.test.ts` ve `tests/rls/ads*.test.ts` dosyalarındaki mevcut testler **değiştirilmeden** geçer. Google dönüşüm yükleme, harcama senkronu, CSV içe aktarma ve rapor aynı sonucu verir. Cron yanıtı Meta yapılandırılmamışken birebir aynıdır (`{ ok: true, skipped: "yapilandirilmamis" }` ve `{ ok: true, spendRows, sent, failed, skipped }`).
- **K10:** `leads.source` anlamı değişmez; `reklam` yalnız Google (gclid). Yeni `ad_platform` (`google` | `meta` | null). Instagram reklamından gelen veli `source='instagram'`, `ad_platform='meta'`. Organik Instagram (fbclid var ama ücretli UTM yok) `source='instagram'`, `ad_platform` null. Telefon velisi (`channel='telefon'`) `ad_platform` null.
- **Meta reklam işareti:** `utm_medium` = `paid_social` (büyük/küçük harf duyarsız) ve `utm_source` ∈ {`instagram`, `facebook`, `ig`, `fb`, `meta`}. Meta reklam bağlantı soneki: `utm_source=instagram&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.name}}` değil, `utm_content=<içerik kodu>` (K5). fbclid tek başına reklam sayılmaz (Meta organik bağlantılara da ekler).
- **K9:** `Lead` yalnız `consent_version >= 2` **ve** `ad_cookie_consent = true` ise gider. `Schedule`/`Enrolled` yalnız `consent_version >= 2` ise gider. Eski onaylılar (v1, içe aktarılan, `consent_scope='arama'`) Meta'ya hiç gitmez. `ad_consent_revoked_at` doluysa gitmez. Tüm Meta gönderimi `META_CAPI_ENABLED=true` değilse hiç çalışmaz (kuyruk birikir, satır `bekliyor` kalır).
- **Çocuk verisi yok:** CAPI yükünde çocuk adı, yaşı, doğum ay/yılı, semt, başlama zamanı, not **bulunmaz**. Yalnız: `ph` (SHA-256), `external_id` (SHA-256 lead id), `fbc`/`fbp` (**yalnız `ad_cookie_consent = true` ise**, KVKK çerez rehberi), `custom_data` (`Schedule`/`Enrolled`: `event_source:"crm"`, `lead_event_source:"Seker Panel"`; `Enrolled` ayrıca `value`/`currency`).
- **Meta olay eşleme:** form → `Lead` (`action_source:"website"`, `event_id = leads.meta_event_id`, pikselle aynı), randevu/görüşme/teklif → `Schedule` (`system_generated`), kazanıldı → `Enrolled` (özel olay, değer: onaylı teklif `offered_price` TL, `currency:"TRY"`). `Schedule`/`Enrolled` `event_id` = `<lead_id>:schedule` / `<lead_id>:enrolled`.
- **Meta sürümü:** `META_GRAPH_API_VERSION = "v26.0"` tek sabit (`lib/ads/meta/config.ts`), yanında kaynak URL yorumu. Google kodu v25'te kalır (yükseltme bu aşamanın işi değil).
- **Para:** Meta `spend` hesap para biriminde ondalıklı metin gelir (TRY). `cost_micros = Math.round(Number(spend) * 1_000_000)`. Google satırları yine mikro.
- **Meta yapılandırması yoksa** her yol "atlandı, yapılandırılmamış" der ve hata vermez: env `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_AD_ACCOUNT_ID` (`act_` önekli ya da değil), `META_PIXEL_ID` (CAPI için), `META_CAPI_TEST_CODE` (isteğe bağlı), `META_CAPI_ENABLED` (`"true"` değilse kapalı).
- **Piksel:** `NEXT_PUBLIC_META_PIXEL_ID` boşsa hiçbir Meta betiği yüklenmez. Doluysa yalnız çerez bandında "Kabul Et" seçilmişse yüklenir.
- **Onay metni v2:** `NEXT_PUBLIC_CONSENT_VERSION` (`"2"` değilse 1). Form etiketi ve kaydedilen `consent_version` bu değerden gelir; hukuk onayı gelene kadar 1 kalır.
- **Santral:** `channel` zaten `telefon` kabul eder; `CallButton`, `call-screen` dokunulmaz.
- Arayüz metinleri Türkçe; renkler yalnız `globals.css` token'ları; dokunma hedefi ≥ 44 px.
- Migration `packages/db/supabase/migrations/0016_reklam_cok_platform.sql`, sonra `pnpm --filter @seker/db gen:types`. Push, `db push`, deploy yok.
- Araştırma notu: `docs/superpowers/plans/2026-10-19-02-meta-api-notlari.md` (hazır). API alan adları ve sürüm buradan alınır, her sabit yanında kaynak URL yorumu.

## Review Focus

1. **Google kuyruğuna Meta satırı sızması:** Google `listPending` yalnız `platform='google'` satırları okumalı; Meta satırında `gclid` boş olduğu için bugün zaten süzülüyor ama bir Meta satırı gclid taşırsa (aynı velide iki tıklama) Google'a iki kez gider. Test: Task 4 (`platform=meta` satırı gclid'li olsa da Google listesinde yok).
2. **Aynı velide hem gclid hem Meta UTM:** Google kazanır (`source='reklam'`, `ad_platform='google'`), Meta satırı açılmaz. Test: Task 1.
3. **Bekleyen Meta olayı 7 günden eski:** `META_CAPI_ENABLED` aylarca kapalı kalıp açılınca eski satırlar Meta'ya gönderilmez, `atlandi · olay 7 günden eski` olur. Test: Task 5.
4. **Mükerrer başvuru (aynı telefon) Meta verisini ezmesin:** ikinci başvuru `fbc`/`fbp`/`meta_event_id`'yi yalnız boşsa doldurur, ikinci bir `Lead` satırı açmaz, `ad_platform`'u değiştirmez. Test: Task 1.
5. **Kodsuz Meta reklam adı:** `"Bir günümüz"` gibi kodsuz ad `content_code` null yazılır, senkron patlamaz. `"r-2645-a · x"` (küçük harf) eşleşmez → null (Claude adları büyük harfle kurar). Test: Task 3.

---

### Task 1: Migration 0016 — platform alanları, kuyruk ve web lead

**Files:**
- Create: `packages/db/supabase/migrations/0016_reklam_cok_platform.sql`
- Modify: `packages/db/src/database.types.ts` (üretilir)
- Test: `apps/panel/tests/rls/cok-platform.test.ts`

**Interfaces:**
- Produces (DB):
  - `leads`: `ad_platform text check (ad_platform in ('google','meta'))`, `fbclid text`, `fbc text`, `fbp text`, `meta_event_id text`, `consent_version smallint`, `ad_cookie_consent boolean`. Geri doldurma: `gclid` dolu ya da `source='reklam'` → `ad_platform='google'`.
  - `ad_spend_daily`: eklenir `platform text not null default 'google' check in ('google','meta')`, `level text not null default 'campaign' check in ('campaign','adset','ad')`, `object_id text` (geri doldurma `= campaign_id`, sonra `not null`), `adset_id text`, `adset_name text`, `ad_id text`, `ad_name text`, `content_code text`, `reach int`, `frequency numeric(8,4)`, `platform_results int`. PK `(platform, date, level, object_id)`. Kural (yorumla yazılır): her platform tek seviye yazar — Google `campaign`, Meta `ad`; böylece kampanya toplamı satırların toplamıdır.
  - `conversion_uploads`: eklenir `platform text not null default 'google' check in ('google','meta')`, `click_id_type text check in ('gclid','fbc')`, `event_id text`. `conversion_action` listesine `lead` eklenir. Tekillik `(lead_id, conversion_action, platform)` (eski `(lead_id, conversion_action)` kaldırılır).
  - `enqueue_conversion_upload()`: Google bölümü **aynen** kalır, yalnız insert'e `platform='google'`, `click_id_type='gclid'` (gclid varsa) ve `on conflict (lead_id, conversion_action, platform)` yazılır. Ardından Meta bölümü: `new.ad_platform='meta'` ise aynı eylemler (`randevu`, `kazanildi`'da ayrıca `kayit`) `platform='meta'` satırı olarak, `event_id = new.id || ':schedule'` / `':enrolled'`, `click_id_type = case when fbc dolu then 'fbc'`, durum `bekliyor`; ancak `old_web_lead_id` ya da `consent_scope='arama'` varsa `atlandi` / `onay yalnızca arama için`. `on conflict do nothing`. Uygunluğun geri kalanı (K9, iptal, 7 gün) gönderim anında TS'te.
  - `create_web_lead` (imza aynı): `p_meta` içinden `fbclid`, `fbc`, `fbp`, `meta_event_id`, `consent_version` (1–9 tam sayı), `ad_cookie_consent` (bool) okunur, her metin ≤ 200 karakter. Yeni velide: gclid varsa `source='reklam'`, `ad_platform='google'` (bugünkü gibi); yoksa Meta reklam işareti (Global Constraints) varsa `source='instagram'`, `ad_platform='meta'`; yoksa fbclid varsa `source='instagram'`, `ad_platform` null; yoksa `web_sitesi`. `ad_platform='meta'` yeni velide ayrıca `conversion_uploads` satırı: `conversion_action='lead'`, `platform='meta'`, `event_id = meta_event_id`, `click_id_type` fbc'ye göre, durum `bekliyor`. Mükerrer yolda: `fbclid/fbc/fbp/meta_event_id/consent_version/ad_cookie_consent` `coalesce` ile yalnız boşsa dolar; `ad_platform` ve `source` değişmez; yeni `lead` satırı açılmaz.
  - `site_visit_daily.source` listesine `meta_ads` eklenir (`record_site_visit` kontrolü varsa o da).
- Consumes: 0008 trigger gövdesi, 0014 `create_web_lead` gövdesi (kopyalanıp genişletilir).

- [ ] **Step 1: Write the failing test** `tests/rls/cok-platform.test.ts` (telefon öneki `+90500555`; `afterAll` siler):
  - `instagram reklam UTM'si meta platformu ve Lead kuyruğu açar`: `admin.rpc('create_web_lead', {..., p_gclid:'', p_utm:{utm_source:'instagram', utm_medium:'paid_social', utm_campaign:'120200', utm_content:'R-2645-A'}, p_meta:{fbclid:'IwAR1', fbc:'fb.1.1760000000000.IwAR1', fbp:'fb.1.1760000000000.123', meta_event_id:'ev-1', consent_version:2, ad_cookie_consent:true}})` → lead `source='instagram'`, `ad_platform='meta'`, `fbc`, `consent_version=2`, `content_code='R-2645-A'`; `conversion_uploads` tek satır `{platform:'meta', conversion_action:'lead', event_id:'ev-1', click_id_type:'fbc', status:'bekliyor'}`.
  - `yalnız fbclid organik instagram sayılır`: UTM yok, `p_meta:{fbclid:'X'}` → `source='instagram'`, `ad_platform` null, kuyruk satırı yok.
  - `gclid her zaman Google kazanır`: gclid + Meta UTM → `source='reklam'`, `ad_platform='google'`, meta satırı yok.
  - `mükerrer başvuru meta alanlarını ezmez`: aynı telefonla ikinci çağrı farklı `fbc`/`meta_event_id` → ilk değerler kalır, `lead` satırı sayısı 1.
  - `randevuya geçen meta velisi Schedule satırı açar, Google satırı açmaz`: `update status='randevu'` → `platform='meta', conversion_action='randevu', event_id='<id>:schedule'`; `platform='google'` satırı yok.
  - `Google velisinin kuyruğu değişmedi`: gclid'li veli `kazanildi` → `platform='google'` iki satır (`randevu`, `kayit`), `click_id_type='gclid'`, `status='bekliyor'`.
  - `ad_spend_daily aynı kampanya kimliği iki platformda ayrı satır`: aynı `(date, campaign_id)` için `platform:'google', level:'campaign', object_id:'1'` ve `platform:'meta', level:'ad', object_id:'1'` iki satır olarak yazılır.
  - `danışman ad_spend_daily ve conversion_uploads okuyamaz` (mevcut RLS korunur).
- [ ] **Step 2:** `pnpm --filter @seker/panel exec vitest run tests/rls/cok-platform.test.ts` → FAIL (kolon yok).
- [ ] **Step 3:** Migration'ı yaz. Trigger ve `create_web_lead` `create or replace`; yetkiler önceki gibi.
- [ ] **Step 4:** `pnpm --filter @seker/db exec supabase db reset`, `pnpm --filter @seker/db gen:types`, test → PASS. Ardından `pnpm --filter @seker/panel test` → hepsi PASS (özellikle `tests/rls/ads*.test.ts`, `web-leads.test.ts`, `on-buro-akisi.test.ts` değişmeden).
- [ ] **Step 5: Commit** `feat(db): reklam verisi platformlu, Meta alanları ve kuyruğu (0016)`

### Task 2: Meta yapılandırması, içerik kodu ve fbc yardımcıları (saf)

**Files:**
- Create: `apps/panel/lib/ads/meta/config.ts`, `apps/panel/lib/ads/content-code.ts`
- Test: `apps/panel/tests/unit/ads-meta-config.test.ts`, `apps/panel/tests/unit/content-code.test.ts`

**Interfaces:**
- Produces:
  - `META_GRAPH_API_VERSION: string` (kaynak yorumlu), `META_GRAPH_BASE = "https://graph.facebook.com"`
  - `interface MetaConfig { accessToken: string; appSecret: string; adAccountId: string /* "act_<rakam>" */; pixelId: string | null; testEventCode: string | null; capiEnabled: boolean }`
  - `readMetaConfig(env = process.env): MetaConfig | null` — token, app secret ya da hesap yoksa `null`. `META_AD_ACCOUNT_ID` rakamlarına `act_` eklenir. `capiEnabled = env.META_CAPI_ENABLED === "true" && pixelId !== null`.
  - `appSecretProof(accessToken: string, appSecret: string): string` — HMAC-SHA256 hex.
  - `parseContentCode(name: string | null | undefined): string | null` — baştaki `^([RS]-\d{4}-[A-Z])(?=$|[\s·\-:|])` (K11, K5).
  - `CONTENT_CODE_RE` dışa açılır (web/DB ile aynı desen `^[RS]-\d{4}-[A-Z]$`).

- [ ] **Step 1: Write the failing tests:**
  - `token yoksa null`, `act_ öneki eklenir` (`"123"` → `"act_123"`, `"act_123"` aynen), `META_CAPI_ENABLED yokken capiEnabled false`, `pixel yokken true yazılsa da capiEnabled false`.
  - `appSecretProof bilinen değeri üretir`: `appSecretProof("tok","sec") === createHmac("sha256","sec").update("tok").digest("hex")`.
  - `parseContentCode("R-2645-A · Bir günümüz") === "R-2645-A"`, `"S-2646-G"` → `"S-2646-G"`, `"Bir günümüz"` → null, `"r-2645-a · x"` → null, `"R-2645-AB"` → null, `null` → null.
- [ ] **Step 2:** `pnpm --filter @seker/panel exec vitest run tests/unit/ads-meta-config.test.ts tests/unit/content-code.test.ts` → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): Meta yapılandırması ve içerik kodu çözümü`

### Task 3: Meta reklam seviyesi harcama çekimi

**Files:**
- Create: `apps/panel/lib/ads/meta/insights.ts`, `apps/panel/tests/fixtures/meta-insights.json`
- Modify: `apps/panel/lib/ads/types.ts`
- Test: `apps/panel/tests/unit/ads-meta-insights.test.ts`

**Interfaces:**
- Consumes: `MetaConfig`, `appSecretProof`, `META_GRAPH_API_VERSION`, `parseContentCode` (Task 2), `FetchFn` (`types.ts`).
- Produces:
  - `types.ts`: `type AdPlatform = "google" | "meta"`; `interface PlatformSpendRow extends SpendRow { platform: AdPlatform; level: "campaign" | "adset" | "ad"; objectId: string; adsetId: string | null; adsetName: string | null; adId: string | null; adName: string | null; contentCode: string | null; reach: number | null; frequency: number | null; platformResults: number | null }`. `SpendRow` aynen kalır.
  - `class MetaApiError extends Error { status: number; code: number | null }`
  - `fetchMetaAdSpend(cfg: MetaConfig, from: string, to: string, fetchFn?: FetchFn): Promise<PlatformSpendRow[]>` — `GET {base}/{ver}/{adAccountId}/insights` `level=ad`, `time_increment=1`, `time_range={"since","until"}`, `action_attribution_windows=["7d_click","1d_view"]` (K7), alanlar notlardaki liste, `appsecret_proof` sorgu parametresi, erişim anahtarı `Authorization: Bearer` başlığında (URL'de değil). `paging.next` bitene kadar izlenir (en çok 20 sayfa). `platformResults` = `actions` içinde `offsite_conversion.fb_pixel_lead` değeri, o yoksa `lead` değeri, ikisi de yoksa 0. Zaman aşımı 30 sn. Hata yanıtı `{error:{message,code}}` → `MetaApiError` (mesaj ≤ 500 karakter, token içermez).

- [ ] **Step 1: Write the failing tests** (mock `fetchFn`, fixture iki sayfa):
  - `reklam satırlarını platformlu satıra çevirir`: `spend:"123.45"` → `costMicros: 123450000`, `platform:"meta"`, `level:"ad"`, `objectId` = ad_id, `campaignId`, `contentCode:"R-2645-A"`, `frequency: 1.42`, `platformResults: 3`.
  - `sonraki sayfayı izler`: iki sayfanın toplamı döner, ikinci çağrı `paging.next` adresine.
  - `kodsuz reklam adında contentCode null` (Review Focus 5).
  - `istekte appsecret_proof ve tarih aralığı var, token URL'de yok`.
  - `hata yanıtı MetaApiError fırlatır ve mesajda token geçmez`.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): Meta reklam seviyesi harcama çekimi`

### Task 4: Platformlu depo (store) — Google süzgeci ve Meta kuyruğu

**Files:**
- Modify: `apps/panel/lib/ads/store.ts`, `apps/panel/lib/ads/types.ts`
- Test: `apps/panel/tests/rls/ads-store-platform.test.ts`

**Interfaces:**
- Consumes: `PlatformSpendRow`, `AdPlatform` (Task 3).
- Produces:
  - `AdsStore.upsertSpend(rows: SpendRow[])` davranışı aynı: satırlar `platform:'google', level:'campaign', object_id: campaignId` ile yazılır, `onConflict: "platform,date,level,object_id"`. `listPending` sorgusuna `.eq("platform","google")` eklenir. İmzalar değişmez.
  - `interface MetaPendingEvent { id: string; leadId: string; action: "lead" | "randevu" | "kayit"; eventId: string; conversionAt: string; value: number | null; lead: { phone: string; createdAt: string; fbc: string | null; fbp: string | null; consentVersion: number | null; adCookieConsent: boolean | null; consentAt: string | null; adConsentRevokedAt: string | null; webPayload: Record<string, unknown> | null; landingPath: string | null } }`
  - `interface MetaStore { upsertSpend(rows: PlatformSpendRow[]): Promise<void>; listPending(limit: number): Promise<MetaPendingEvent[]>; saveOutcomes(outcomes: UploadOutcome[]): Promise<void> }`
  - `supabaseMetaStore(db: SupabaseClient): MetaStore` — `listPending` yalnız `platform='meta' and status='bekliyor'`, `conversion_at` artan.

- [ ] **Step 1: Write the failing tests** (gerçek DB, `admin`):
  - `google upsertSpend eski satırlara yazar`: aynı `(date, campaign_id)` iki kez → tek `platform='google'` satırı, son değer.
  - `meta upsertSpend reklam satırı yazar ve google satırını ezmez`.
  - `google listPending meta satırını görmez` (Review Focus 1): bir veliye `platform='meta'` gclid'li satır elle eklenir → Google `listPending` sonucunda yok; meta `listPending` sonucunda var.
  - `meta listPending velinin fbc, onay sürümü ve telefonunu döner`.
  - Mevcut `tests/rls/ads-store.test.ts` değişmeden PASS.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** `pnpm --filter @seker/panel exec vitest run tests/rls/ads-store.test.ts tests/rls/ads-store-platform.test.ts tests/rls/ads.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(panel): platformlu reklam deposu, Google kuyruğu yalnız Google`

### Task 5: Conversions API — uygunluk (K9), yük ve gönderim

**Files:**
- Create: `apps/panel/lib/ads/meta/capi.ts`
- Test: `apps/panel/tests/unit/ads-meta-capi.test.ts`

**Interfaces:**
- Consumes: `MetaConfig`, `appSecretProof`, `META_GRAPH_API_VERSION` (Task 2), `MetaPendingEvent`, `MetaStore`, `UploadOutcome` (Task 4), `adUserDataFor` (`lib/ads/consent.ts`).
- Produces:
  - `META_EVENT_NAMES: Record<"lead"|"randevu"|"kayit", "Lead"|"Schedule"|"Enrolled">`
  - `metaEligibility(ev: MetaPendingEvent, now: Date): { ok: true } | { ok: false; reason: string }` — sırayla: `adUserDataFor` "denied" → `"reklam verisi onayı yok"`; `consentVersion` < 2 ya da null → `"onay sürümü eski (Meta yok)"`; `action==='lead'` ve `adCookieConsent!==true` → `"çerez onayı yok"`; olay zamanı (lead için `lead.createdAt`, diğerleri `conversionAt`) 6 gün 20 saatten eski (7 gün sınırı, güvenlik payı; topluda tek eski olay tüm isteği düşürür) → `"olay 7 günden eski"`.
  - `hashPhone(e164: string): string` — `+` atılmış rakamların SHA-256 hex'i (notlardaki normalleştirme). `hashExternalId(leadId: string): string` — küçük harf lead id'nin SHA-256 hex'i.
  - `buildCapiEvent(ev: MetaPendingEvent, siteUrl: string | null): Record<string, unknown>` — `event_name`, `event_time` (saniye), `event_id`, `action_source` (`lead` → `"website"` + `event_source_url = siteUrl + landingPath`; diğerleri `"system_generated"`), `user_data: { ph: [hash], external_id: [hash], fbc?, fbp? }` (fbc/fbp yalnız `adCookieConsent === true` ise), `custom_data`: `lead`'de yok; `randevu`/`kayit`'ta `{ event_source: "crm", lead_event_source: "Seker Panel" }`, `kayit` ve değer > 0 ise ayrıca `value`, `currency: "TRY"`.
  - `sendCapiBatch(cfg: MetaConfig, events: Record<string, unknown>[], fetchFn?: FetchFn): Promise<{ ok: true; received: number } | { ok: false; error: string }>` — `POST {base}/{ver}/{pixelId}/events`, gövde `{ data, test_event_code? }`, `appsecret_proof`, zaman aşımı 15 sn.
  - `uploadMetaPending(deps: { cfg: MetaConfig; store: MetaStore; siteUrl: string | null; fetchFn?: FetchFn; now?: Date }, limit = 50): Promise<{ sent: number; failed: number; skipped: number }>` — uygun olmayanlar `atlandi`+neden; uygunlar tek toplu istekte; başarı → hepsi `gonderildi`, hata → hepsi `hata`. `cfg.capiEnabled` false ise hiçbir şey okunmaz/yazılmaz, `{0,0,0}` döner.

- [ ] **Step 1: Write the failing tests:**
  - `v1 onaylı velinin olayı atlanır`, `çerez onayı olmayan Lead atlanır ama Schedule gider`, `iptal edilmiş onay atlanır`, `8 günlük olay atlanır` (Review Focus 3), `içe aktarılmış veli (old_web_lead_id) atlanır`.
  - `yükte çocuk verisi ve düz telefon yok`: `JSON.stringify(buildCapiEvent(ev, "https://x"))` içinde `"+90"`, `child`, `birth`, `district` geçmez; `user_data.ph[0]` 64 karakter hex.
  - `çerez onayı yokken Schedule yükünde fbc/fbp yok`, `Enrolled değer ve TRY taşır`, `Lead website kaynağı ve event_source_url taşır`, `Schedule system_generated`.
  - `capiEnabled kapalıyken store hiç çağrılmaz`.
  - `toplu gönderim başarılıysa satırlar gonderildi, test kodu varsa gövdede`.
  - `Meta hata verirse satırlar hata olur ve mesaj kaydedilir`.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): Meta Conversions API gönderimi (kapalı gelir)`

### Task 6: Sabah görevi iki platformu çalıştırır

**Files:**
- Modify: `apps/panel/app/api/cron/ads/route.ts`
- Create: `apps/panel/lib/ads/meta/sync.ts`
- Test: `apps/panel/tests/unit/ads-cron-meta.test.ts` (mevcut `ads-cron-route.test.ts` dokunulmaz)

**Interfaces:**
- Consumes: `readMetaConfig` (Task 2), `fetchMetaAdSpend` (Task 3), `supabaseMetaStore` (Task 4), `uploadMetaPending` (Task 5).
- Produces:
  - `syncMetaSpend(deps: { cfg: MetaConfig; store: MetaStore; fetchFn?: FetchFn }, from: string, to: string): Promise<number>`
  - `META_RESYNC_DAYS = 7`.
  - Cron yanıtı: Google kısmı bugünkü gibi. Meta yapılandırılmamışsa yanıtta `meta` anahtarı **yok** (eski testler birebir). Meta yapılandırılmışsa ek `meta: { spendRows: number | null; sent; failed; skipped; capi: "acik" | "kapali" }`. Hiçbiri yapılandırılmamışsa `{ ok: true, skipped: "yapilandirilmamis" }`. Yalnız Meta varsa `{ ok, skipped: "yapilandirilmamis", meta: {...} }`. Meta hatası Google'ı durdurmaz, tersi de; hata metni `Meta harcama:`/`Meta dönüşüm:` önekiyle aynı `ads_senkron_hata` bildirimine eklenir. `siteUrl = process.env.SITE_PUBLIC_URL ?? "https://yeni.sekeranaokulu.com"`.

- [ ] **Step 1: Write the failing tests** (`ads-cron-route.test.ts` desenindeki mock'larla):
  - `yalnız Meta yapılandırılmışsa Google çağrılmaz, meta harcaması yazılır, capi kapalı`.
  - `Meta harcama hatası Google sonucunu bozmaz ve bildirim Meta önekiyle yazılır`.
  - `META_CAPI_ENABLED=true ve piksel varken bekleyen olaylar gönderilir`.
  - Mevcut `tests/unit/ads-cron-route.test.ts` değiştirilmeden PASS.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** `pnpm --filter @seker/panel exec vitest run tests/unit/ads-cron-route.test.ts tests/unit/ads-cron-meta.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(panel): sabah reklam görevi Instagram'ı da çeker`

### Task 7: Pazarlama raporu iki platform

**Files:**
- Modify: `apps/panel/lib/ads/report.ts`, `apps/panel/lib/queries/marketing.ts`, `apps/panel/components/marketing-table.tsx`, `apps/panel/components/conversion-upload-list.tsx`, `apps/panel/lib/ads/status-lines.ts`, `apps/panel/app/(app)/pazarlama/page.tsx`
- Test: `apps/panel/tests/unit/ads-report-platform.test.ts`, `apps/panel/tests/unit/ads-status-lines.test.ts` (yeni durumlar eklenir)

**Interfaces:**
- Consumes: `AdPlatform` (Task 3), `MetaConfig | null` (Task 2).
- Produces:
  - `ReportLead` yeni isteğe bağlı alan `ad_platform?: AdPlatform | null`; `ReportSpend` yeni isteğe bağlı `platform?: AdPlatform`. `ReportRow` yeni isteğe bağlı `platform?: AdPlatform`.
  - Kural: Google reklamı = `gclid || source==='reklam' || ad_platform==='google'` (anahtar bugünkü gibi `kampanya:<id>`). Meta reklamı = `ad_platform==='meta'` (anahtar `kampanya:meta:<utm_campaign>`; boşsa `kampanya:meta:bilinmiyor`, etiket "Instagram · kampanya bilinmiyor"). Meta harcama satırı `kampanya:meta:<campaign_id>`, ad `campaign_name`. Diğerleri kaynak satırı.
  - `adsStatusLines(google: AdsConfig | null, meta: MetaConfig | null = null): { spend: string; conversion: string; metaSpend: string; metaConversion: string }` — eski iki alan aynen. Meta: yoksa `"Instagram bağlantısı yok — Meta hesabı kurulunca her sabah 06:00'da otomatik"`, `"kapalı (Meta bağlantısı yok)"`; varsa `"her sabah 06:00'da otomatik (son 7 gün)"`, `capiEnabled ? "açık" : "kapalı (hukuk onayı bekleniyor · META_CAPI_ENABLED)"`.
  - Tablo rozeti: `platform==='meta'` → "Instagram", aksi kampanya → "Google Ads". Gönderim listesi her satırda platform etiketi (Google / Instagram) ve eylem etiketi (`lead` → "Başvuru").
- [ ] **Step 1: Write the failing tests:**
  - `meta velisi ve meta harcaması Instagram kampanya satırında birleşir`, `aynı kimlikli Google ve Meta kampanyası ayrı satır`, `organik instagram velisi kaynak satırında kalır`, mevcut `ads-report.test.ts` değişmeden PASS.
  - `meta yokken durum satırları` ve `capi kapalıyken hukuk onayı yazar`.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula. `marketing.ts` lead sorgusuna `ad_platform`, harcama sorgusuna `platform` eklenir. `CONVERSION_ACTIONS` sözlüğüne `lead: "Başvuru"` eklenir.
- [ ] **Step 4:** Test → PASS. Dev sunucuda `/pazarlama` (yönetici) 1440 px ve 390 px'te açılır; tablo ve durum satırları okunur.
- [ ] **Step 5: Commit** `feat(panel): pazarlama raporunda Google ve Instagram ayrı satırlar`

### Task 8: Web — fbclid/_fbc/_fbp, olay kimliği, onay sürümü

**Files:**
- Modify: `apps/web/lib/attribution.ts`, `apps/web/app/components/AttributionFields.tsx`, `apps/web/lib/leadSchema.ts`, `apps/web/lib/websiteLeads.ts`, `apps/web/app/components/LeadForm.tsx`, `apps/web/content/kvkk.ts`, `apps/web/lib/visits.ts`
- Create: `apps/web/lib/metaClick.ts`
- Test: `apps/web/lib/__tests__/metaClick.test.ts`, `apps/web/lib/__tests__/attribution.test.ts` (varsa genişletilir), `apps/web/lib/__tests__/leadSchema.test.ts`, `apps/web/lib/__tests__/visits.test.ts` (varsa), `apps/web/app/components/__tests__/LeadForm.consent.test.tsx`

**Interfaces:**
- Consumes: `create_web_lead` `p_meta` anahtarları (Task 1).
- Produces:
  - `Attribution` yeni alanlar `fbclid: string; fbc: string` (ilk dokunuşla birlikte saklanır; `fbc` tıklama anında `buildFbc(fbclid, Date.now())`). `hasSignal` fbclid'i de sayar. Eski depolanmış nesnede alan yoksa `''`.
  - `metaClick.ts`: `buildFbc(fbclid: string, ms: number): string` → `fb.1.<ms>.<fbclid>`; `readCookie(cookie: string, name: string): string`; `isMetaPaid(utm: Utm): boolean` (Global Constraints kuralı); `CONSENT_VERSION: 1 | 2` (`process.env.NEXT_PUBLIC_CONSENT_VERSION === "2" ? 2 : 1`).
  - Form gizli alanları: `fbclid`, `fbc` (çerez `_fbc` varsa o, yoksa saklanan), `fbp` (çerez `_fbp`), `metaEventId` (form açılışında `crypto.randomUUID()`), `adCookieConsent` (`readConsent(localStorage)==='granted'`).
  - `leadSchema` yeni gizli alanlar (kırpılır, varsayılan `''`/`false`): `fbclid`, `fbc`, `fbp`, `metaEventId`, `adCookieConsent: boolean`.
  - `createWebLead` `p_meta`'ya her zaman ekler: `consent_version: CONSENT_VERSION`, `ad_cookie_consent`, ve dolu olanlarından `fbclid`, `fbc`, `fbp`, `meta_event_id`.
  - `KVKK_CONSENT_LABEL` sürüme göre: v1 bugünkü metin aynen; v2 `"Aydınlatma Metni'ni okudum. Başvurum için aranmama ve başvuru bilgilerimin reklamlarımızın etkinliğini ölçmek amacıyla Google ve Meta (Instagram) ile paylaşılmasına onay veriyorum."`. `KVKK_TEXT` v2'de veri, amaç, aktarım bölümlerine Meta Platforms Ireland maddesi eklenir (yalnız sürüm 2 iken).
  - `classifyEntrySource`: gclid/gbraid/wbraid'den sonra `isMetaPaid` → `'meta_ads'`. `VISIT_SOURCES`'a `meta_ads`. Panel `site-traffic` etiketi "Instagram reklamı".
- [ ] **Step 1: Write the failing tests:**
  - `buildFbc biçimi`, `readCookie _fbc okur`, `isMetaPaid paid_social+instagram true, organik false`.
  - `fbclid ilk dokunuşta fbc ile saklanır, sonraki sayfa ezmez`.
  - `leadSchema fbc ve olay kimliğini kabul eder, 200 karakterde keser`.
  - `createWebLead p_meta'ya consent_version ve meta alanlarını koyar` (rpc mock).
  - `v1'de onay metni Meta içermez; v2'de Meta içerir` (env ile).
  - `instagram ücretli UTM'si meta_ads ziyareti sayılır`.
  - Mevcut `apps/web` testleri PASS (`adTargets`, `LeadForm.*`, `route.test`).
- [ ] **Step 2:** `pnpm --filter @seker/web test` → yeni testler FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** `pnpm --filter @seker/web test` → PASS.
- [ ] **Step 5: Commit** `feat(web): Instagram tıklama kimliği, olay kimliği ve onay sürümü kaydı`

### Task 9: Web — onaya bağlı Meta pikseli

**Files:**
- Create: `apps/web/app/components/MetaPixel.tsx`, `apps/web/lib/metaPixel.ts`
- Modify: `apps/web/app/layout.tsx` (ya da `Analytics`'in yüklendiği yer), `apps/web/app/components/CookieBanner.tsx`, `apps/web/app/components/LeadForm.tsx`
- Test: `apps/web/app/components/__tests__/MetaPixel.test.tsx`, `apps/web/lib/__tests__/metaPixel.test.ts`

**Interfaces:**
- Consumes: `CONSENT_KEY`, `readConsent` (`lib/consent.ts`), `metaEventId` (Task 8).
- Produces:
  - `metaPixelId(): string` — `NEXT_PUBLIC_META_PIXEL_ID` rakamsa döner, değilse `''`.
  - `trackMetaLead(eventId: string): void` — `window.fbq` varsa `fbq('track','Lead',{}, { eventID: eventId })`, yoksa hiçbir şey.
  - `CONSENT_EVENT = "seker:consent"`: `CookieBanner.choose` seçimi kaydettikten sonra `window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }))`.
  - `<MetaPixel />` istemci bileşeni: kimlik boşsa `null`; düzenleme modunda yüklenmez (`Analytics` gibi); onay `granted` olunca (ilk yüklemede ya da olayla) `fbevents.js` betiğini bir kez ekler, `fbq('init', id)`, `fbq('track','PageView')`. Onay yoksa hiçbir ağ isteği yok.
  - `LeadForm` başarıdan sonra `trackMetaLead(metaEventId)`.
- [ ] **Step 1: Write the failing tests:**
  - `kimlik boşken hiçbir şey çizmez ve betik eklemez`.
  - `onay yokken betik eklemez; onay olayı gelince bir kez ekler`.
  - `trackMetaLead fbq yokken hata vermez; varken eventID ile çağırır`.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** `pnpm --filter @seker/web test` → PASS.
- [ ] **Step 5: Commit** `feat(web): çerez onayına bağlı Meta pikseli (kimlik boşken kapalı)`

### Task 10: Veli kartında Instagram reklamı kaynağı

**Files:**
- Modify: `apps/panel/lib/lead-attribution.ts` (`originLines`), `apps/panel/components/lead-origin-card.tsx`, `apps/panel/app/(app)/leads/[id]/page.tsx` (select'e `ad_platform`), `apps/panel/components/call-queue-card.tsx` (kaynak etiketi)
- Test: `apps/panel/tests/unit/lead-origin.test.ts` (yeni durumlar)

**Interfaces:**
- Consumes: `leads.ad_platform` (Task 1).
- Produces: `originLines` girdisine isteğe bağlı `ad_platform`; `ad_platform==='meta'` → kanal etiketi `"Instagram reklamı · Sayfa formu"`, kod etiketi içerik kodu. Kuyruk kartında `ad_platform==='meta'` → "Instagram reklamı"; `source==='reklam'` → "Google" (bugünkü gibi).
- [ ] **Step 1: Write the failing tests:** `meta form velisi Instagram reklamı etiketi alır`; `organik instagram formu "Sayfa formu" kalır`; mevcut testler PASS.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(panel): veli kartında Instagram reklamı kaynağı`

### Task 11: Claude'un Meta masaüstü betikleri ve kurulum belgesi

**Files:**
- Create (repo dışı, commit edilmez): `C:\Users\meert\Desktop\seker-reklam-araclar\meta-lib.mjs`, `meta-read.mjs`, `meta-capi-test.mjs`, `meta-apply.mjs`
- Modify: `docs/pazarlama-kurulum.md` (Meta bölümü, env tablosu, bağlantı soneki, CAPI açma adımları)

**Interfaces:**
- `meta-lib.mjs`: `KEYFILE = 'C:/Users/meert/Desktop/seker-meta-ads-anahtarlar.txt'`, `VERSION` (Task 2 ile aynı), `loadEnv()` dosya yoksa `console.error("Meta anahtar dosyası yok: Desktop\\seker-meta-ads-anahtarlar.txt. Önce Meta hesap düzenini tamamlayın (7 adım).")` + `process.exit(1)`; `META_*` satırlarını okur, eksik zorunlu anahtarda aynı biçimde Türkçe hata. `graph(env)` → `{ get(path, params), post(path, body) }` (`appsecret_proof` ile).
- `meta-read.mjs`: hesap, kampanyalar, reklam setleri, reklamlar (`effective_status`, ad), son 7 gün insights özeti. Yalnız okur.
- `meta-capi-test.mjs`: `META_CAPI_TEST_CODE` yoksa çıkar; varsa tek `Lead` test olayı gönderir (yalnız test kodu ile).
- `meta-apply.mjs <plan.json> [--apply]`: kampanya/reklam seti/reklam **PAUSED** kurar; `--apply` yoksa yalnız `execution_options=["validate_only"]`. Reklam adı içerik koduyla başlamalı (K11), başlamıyorsa durur. Metne dokunmaz.

- [ ] **Step 1:** Betikleri yaz.
- [ ] **Step 2:** `node --check` her biri için → hata yok. `node meta-read.mjs` (anahtar dosyası yok) → Türkçe hata, çıkış kodu 1, ağ isteği yok.
- [ ] **Step 3:** `docs/pazarlama-kurulum.md` güncelle.
- [ ] **Step 4: Commit** `docs: Meta kurulum ve açma adımları`

### Task 12: Aşama sonu

- [ ] **Step 1:** `pnpm turbo run lint typecheck test` (yerel Supabase açık) → hepsi PASS.
- [ ] **Step 2:** `superpowers:requesting-code-review` ile Aşama 2 farkını inceletin (af0f3e1..HEAD). Bulguları düzeltin, testler yeşil.
- [ ] **Step 3: Commit** düzeltmeler.
- [ ] **Step 4:** Sabah raporuna Türkçe "Aşama 2'de ne çalışıyor" bölümü; koordinatöre SHA, dosyalar, 0016, env değişiklikleri (`META_*`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_CONSENT_VERSION`, `SITE_PUBLIC_URL`), crontab değişikliği yok.
