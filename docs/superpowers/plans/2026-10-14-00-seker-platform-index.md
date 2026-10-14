# Şeker Okul Platformu: Uygulama Planı (İndeks ve Ortak Sözleşme)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Okul sitesi (`react-kindergarten-site`) ile CRM'i (`annem/anaokulcrm`) tek bir monorepo'da, tek Supabase projesi ve tek Lightsail sunucusu üzerinde, okulun kendisinin yönettiği bir platforma dönüştürmek.

**Architecture:** İki Next.js 16 uygulaması (`apps/web` → sekeranaokulu.com, `apps/panel` → panel.sekeranaokulu.com) pnpm + Turborepo monorepo'sunda yaşar, ortak paketlerle aynı Supabase projesini (Postgres + RLS + Auth) kullanır. Tek bir AWS Lightsail sunucusunda Docker Compose (Caddy + web + panel + cron) ile çalışır; imajlar GitHub Actions'ta derlenip GHCR'a gönderilir. Fotoğraflar ve gece veritabanı yedekleri S3'te durur.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind 4, pnpm workspaces, Turborepo, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), zod 4, Vitest 4, Tiptap 3, sharp, `@aws-sdk/client-s3`, Docker Compose, Caddy 2, GitHub Actions, Google Ads API (REST).

**Spec:** `docs/superpowers/specs/2026-10-14-seker-platform-design.html` (yayındaki kopya: https://claude.ai/artifact/CYcWXVL2wbmLA3GX2KEXDZ). Karar: Lightsail + Supabase Free + S3 onaylandı (2026-10-14). "Okulun ağı" kapsam dışı; çok kiracılı (`okul_id`/`sube_id`) kolon **eklenmez**.

---

## Plan dosyaları ve sıra

| Sıra | Dosya | Kapsam | Tahmin | Bağımlılık |
|---|---|---|---|---|
| 0 | `2026-10-14-01-faz0-temel-ve-tasinma.md` | Monorepo, Next 16, yeni Supabase anahtarları, Docker/Caddy/Lightsail, CI/CD, yedek, izleme, DNS geçişi | ~4 gün | yok |
| 1 | `2026-10-14-02-faz1-basvuru-akisi.md` | Site formu → CRM `leads`, UTM, tekrar başvuru, bildirim, KVKK aydınlatma metni + onay kutusu, eski başvuruların aktarımı, `/admin` kaldırma | ~2,5 gün | Faz 0 |
| 2 | `2026-10-14-03-faz2-yerinde-duzenleme.md` | İçerik tabloları, ortak oturum, düzenleme modu, Editable bileşenleri, tüm sayfaların sarılması, fotoğraf, duyurular, geçmiş | ~10–11 gün | Faz 0 (Faz 1 ile paralel olabilir; yalnız Task 16 Faz 1 Task 6a'yı bekler) |
| 3 | `2026-10-14-04-faz3-pazarlama.md` | Google Ads harcama senkronu, offline dönüşüm yükleme, Pazarlama ekranı | ~4–5 gün | Faz 1 + developer token onayı |
| 4 | `2026-10-14-05-faz4-odeme-cilasi.md` | Gecikenler listesi, WhatsApp hatırlatma, aylık özet, Bugün kartı | ~2 gün | Faz 0 |

Her faz kendi başına çalışan, test edilmiş, yayına alınabilir yazılım üretir. Bir fazın görevleri bitmeden bir sonraki faza geçilmez (Faz 1/2/4 arası paralellik hariç).

---

## Global Constraints (her görev için geçerli)

- Dil: tüm UI metinleri Türkçe. Kod tanımlayıcıları İngilizce. Domain enum değerleri Türkçe string (`'web_sitesi'`), Postgres native enum değil, `text + CHECK`.
- Panelde enum değerleri ve etiketleri YALNIZCA `apps/panel/lib/constants.ts`'te tanımlanır.
- Para: DB'de `numeric(12,2)`, TS iş mantığında kuruş cinsinden integer (panelin mevcut kuralı, `lib/money.ts`).
- Telefon: E.164 `+905XXXXXXXXX`. Tek normalizasyon fonksiyonu `normalizeTurkishPhone` (`packages/shared/src/phone.ts`).
- Saat dilimi: `Europe/Istanbul`; DB'de `timestamptz`.
- `events` tablosu append-only.
- Kayıt (sign-up) ekranı yok; hesapları yönetici açar (`apps/panel/scripts/seed/create-staff.ts`).
- Her şema değişikliği `packages/db/supabase/migrations/NNNN_ad.sql` dosyasıyla yapılır; dashboard'dan elle değişiklik yasak. Numaralar: `0006` Faz 1, `0007` Faz 2, `0008` Faz 3, `0009` Faz 4.
- Supabase anahtarları yalnızca yeni biçim: `sb_publishable_…` ve `sb_secret_…`. `anon`/`service_role` anahtar adları kodda geçmez (Faz 0'dan sonra).
- Gizli anahtarlar yalnızca sunucudaki `/opt/seker/.env` dosyasında ve GitHub Actions secrets'ta durur; Docker imajına, depoya, loglara girmez.
- Ziyaretçi sayfaları (`apps/web` altındaki `(site)` ve `(lp)` grupları) oturum çerezi okumaz, Supabase'e istek başına gitmez; içerik `"use cache"` + `cacheTag('site-content')` ile önbellekten gelir.
- Her Server Action kendi içinde oturumu ve yetkiyi yeniden kontrol eder (middleware'e güvenilmez).
- Node ≥ 22, pnpm 10, Next `16.2.x` (iki uygulamada aynı sürüm).
- Commit: her görev sonunda en az bir commit, mesajlar Conventional Commits (`feat(web): …`, `fix(panel): …`, `chore(infra): …`).

---

## Ortak Sözleşme (fazlar arası isimler; değiştirmek için önce bu dosya güncellenir)

### Depo düzeni

```
C:\Users\meert\Desktop\seker-platform\        (yeni git deposu, GitHub: private "seker-platform")
├─ apps/
│  ├─ web/                 @seker/web    ← react-kindergarten-site (git subtree, geçmişiyle)
│  └─ panel/               @seker/panel  ← annem/anaokulcrm (git subtree split, geçmişiyle)
├─ packages/
│  ├─ db/                  @seker/db     supabase/ (config.toml, migrations, seed.sql), src/database.types.ts
│  ├─ auth/                @seker/auth   Supabase istemci fabrikaları + çerez ayarı + editör kontrolü
│  └─ shared/              @seker/shared phone.ts, env.ts (zod ile env doğrulama)
├─ infra/
│  ├─ docker-compose.yml   Caddyfile   cron/ (Dockerfile, crontab, backup.sh)
│  ├─ Dockerfile.web       Dockerfile.panel
│  └─ server-setup.md      (Lightsail ilk kurulum adımları)
├─ docs/superpowers/{specs,plans}/   (bu klasör buraya taşınır)
├─ .github/workflows/ci.yml, deploy.yml
├─ turbo.json  pnpm-workspace.yaml  package.json  .nvmrc (22)
```

### Ortam değişkenleri (tek isim listesi)

| Değişken | Kullanan | Not |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web, panel | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | web, panel | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | web (sunucu), panel (sunucu), testler | `sb_secret_…` |
| `SUPABASE_DB_URL` | cron (yedek) | Session pooler bağlantı dizesi |
| `AUTH_COOKIE_DOMAIN` | web, panel | Prod: `.sekeranaokulu.com`; lokal: boş |
| `SITE_URL` | panel | `https://sekeranaokulu.com` |
| `PANEL_URL` | web | `https://panel.sekeranaokulu.com` |
| `NEXT_PUBLIC_PANEL_URL` | web (istemci) | Düzenleme çubuğundaki "Panele dön" bağlantısı; `PANEL_URL` ile aynı değer |
| `CRON_SECRET` | panel, cron | |
| `RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL`, `LEAD_FROM_EMAIL` | web | `LEAD_FROM_EMAIL` doğrulanmış alan adıyla |
| `NEXT_PUBLIC_GTM_ID` | web | |
| `S3_BUCKET`, `S3_REGION` | web (fotoğraf) | Medya bucket'ı |
| `S3_BACKUP_BUCKET` | cron (yedek) | Ayrı, private, versiyonlu bucket |
| `MEDIA_AWS_ACCESS_KEY_ID`, `MEDIA_AWS_SECRET_ACCESS_KEY` | web | `/opt/seker/.env`'de bu adla; compose web konteynerinde `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` olarak eşler. IAM: `seker-web-media` |
| `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY` | cron | Aynı şekilde cron konteynerinde eşlenir. IAM: `seker-backup` |
| `HC_BACKUP_URL`, `HC_CRON_DAILY_URL` | cron | Healthchecks.io ping adresleri |
| `GHCR_OWNER`, `ACME_EMAIL` | compose, Caddy | İmaj sahibi, Let's Encrypt e-postası |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | web | `https://<bucket>.s3.eu-central-1.amazonaws.com` |
| `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_CONVERSION_ACTION_RANDEVU`, `GOOGLE_ADS_CONVERSION_ACTION_KAYIT` | panel | Faz 3 |
| `IMAGE_TAG`, `SITE_HOST`, `PANEL_HOST` | docker compose | `SITE_HOST`/`PANEL_HOST` staging'de `yeni.`/`panel-yeni.` |

### `@seker/shared`

```ts
// packages/shared/src/phone.ts  (panelin bugünkü lib/phone.ts'inden taşınır, davranış aynı)
export function normalizeTurkishPhone(raw: string): string | null;
```

### `@seker/auth`

Kök export **yok**; yalnızca alt yollar: `@seker/auth/cookie`, `@seker/auth/server`, `@seker/auth/admin`, (Faz 2'de) `@seker/auth/editor`. Neden: `server` `next/headers` import eder; betikler ve testler yalnızca `admin`'i çekebilmeli. `@seker/shared` ise kök export'a sahiptir (`import { normalizeTurkishPhone } from '@seker/shared'`).

```ts
// packages/auth/src/cookie.ts
import type { CookieOptionsWithName } from '@supabase/ssr';
export function authCookieOptions(): CookieOptionsWithName;
// { domain: process.env.AUTH_COOKIE_DOMAIN || undefined, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }

// packages/auth/src/server.ts
export async function createServerSupabase(): Promise<SupabaseClient<Database>>; // cookies() ile, publishable key
// packages/auth/src/admin.ts
export function createAdminSupabase(): SupabaseClient<Database>; // secret key, persistSession:false; YALNIZCA sunucu
// packages/auth/src/editor.ts
export type Editor = { id: string; fullName: string };
export async function getEditor(): Promise<Editor | null>; // getUser() + profiles.is_active && profiles.can_edit_site
```

`getEditor()` Faz 0'da değil, Faz 2'de eklenir (`can_edit_site` kolonu o fazda geliyor). `apps/web` hem `@seker/auth` hem `@seker/shared`'ı workspace bağımlılığı olarak alır. Geçiş notu: `apps/web` Faz 1'e kadar eski `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `ADMIN_PASSWORD` değişkenleriyle çalışmaya devam eder; Faz 1 bunları kaldırır.

Dağıtım notu: her dağıtımda iki imaj da tek `IMAGE_TAG` ile derlenir (sadelik için); "yalnız değişeni derle" uygulanmaz.

Panelin `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts` dosyaları kalır ama istemciyi `@seker/auth`'tan alır ve `cookieOptions: authCookieOptions()` geçer.

### `@seker/db`

- `packages/db/supabase/` = panelin bugünkü `supabase/` klasörü (taşınır).
- `packages/db/src/database.types.ts`: `pnpm --filter @seker/db gen:types` ile üretilir (`supabase gen types typescript --linked`). `export type { Database } from './database.types'`.
- RLS testleri `apps/panel/tests/rls/` altında kalır.

### Veritabanı nesneleri (faz bazında)

| Faz | Nesne | İmza / kolonlar |
|---|---|---|
| 1 | `leads` yeni kolonlar | `gclid text`, `utm_source text`, `utm_medium text`, `utm_campaign text`, `utm_term text`, `utm_content text`, `landing_path text`, `consent_at timestamptz`, `web_payload jsonb` |
| 1 | `leads.source` CHECK | mevcut değerler + `'web_sitesi'` |
| 1 | `public.create_web_lead(p_parent_name text, p_phone text, p_gclid text, p_utm jsonb, p_landing_path text, p_consent_at timestamptz, p_meta jsonb default '{}')  returns jsonb` | `{ "lead_id": uuid, "duplicate": boolean }`; `security definer`, `search_path = ''`; `execute` yalnızca `service_role`'a. `p_meta` içe aktarma için: `silent` (bildirim yok), `old_web_lead_id` (idempotens) |
| 1 | `events` olay tipleri | `web_basvuru`, `web_tekrar_basvuru` (`entity_type = 'lead'`, `actor_id = null`) |
| 1 | `notifications.type` | `web_basvuru` (payload: `{ leadId, parentName, source, landingPath, duplicate }`) |
| 1→3 | Reklam verisi onayı | Ayrı çerez onayı taşınmaz. Formdaki zorunlu KVKK onayı (`leads.consent_at`) esas alınır; Faz 3 her form adayı için `consent: { adUserData: CONSENT_GRANTED }` gönderir (sahip kararı, 2026-10-14). Ön koşul: KVKK aydınlatma metni, başvuru verisinin reklam ölçümü için Google ile paylaşıldığını söylemeli |
| 1 | `app_settings` | `web_lead_assignee` (jsonb string: profil uuid'i veya atanmamış için `""`; kolon NOT NULL) |
| 2 | `profiles.can_edit_site boolean not null default false` | |
| 2 | `public.can_edit_site() returns boolean` | security definer; `auth.uid()` aktif ve `can_edit_site` mı |
| 2 | `site_content` | `key text pk`, `value jsonb not null`, `kind text check in ('text','rich','image','list')`, `updated_by uuid → profiles`, `updated_at timestamptz` |
| 2 | `content_revisions` | `id uuid pk`, `key text`, `old_value jsonb`, `new_value jsonb not null`, `editor_id uuid → profiles`, `created_at` |
| 2 | `announcements` | `id uuid pk`, `title text`, `body text` (temizlenmiş HTML), `image_id uuid → media_assets null`, `starts_on date`, `ends_on date null`, `published boolean`, `sort int`, `updated_by`, `updated_at` |
| 2 | `media_assets` | `id uuid pk`, `s3_key text unique`, `width int`, `height int`, `alt text not null`, `faces text check in ('yok','bulanik_veya_izinli')`, `uploaded_by uuid`, `created_at` |
| 3 | `ad_spend_daily` | `date date`, `campaign_id text`, `campaign_name text`, `cost_micros bigint`, `clicks int`, `impressions int`; pk `(date, campaign_id)` |
| 3 | `conversion_uploads` | `id uuid pk`, `lead_id uuid → leads`, `gclid text`, `conversion_action text check in ('randevu','kayit')`, `conversion_at timestamptz`, `value numeric(12,2) null`, `status text check in ('bekliyor','gonderildi','hata','atlandi')`, `error text`, `uploaded_at`; unique `(lead_id, conversion_action)` |
| 3 | Dönüşüm yükleme yolu | Google Ads API `uploadClickConversions` değil, **Data Manager API** (`POST datamanager.googleapis.com/v1/events:ingest`). Sebep: 2026-06-15'ten beri daha önce dönüşüm yüklememiş developer token'lar için `UploadClickConversions` reddediliyor. Harcama okuma Google Ads API v25 `searchStream` ile. OAuth kapsamlarına `datamanager` eklenir |
| 3 | Kampanya eşleme | Google Ads hesap düzeyi son ek: `utm_campaign={campaignid}`; `leads.utm_campaign` = kampanya kimliği |
| 3 | `notifications.type` | `ads_senkron_hata` (yöneticilere) |
| 4 | view `public.v_overdue_installments` | `installment_id, student_id, student_name, family_phone, due_date, amount, days_overdue, item_type, season` (security_invoker) |

### `apps/web` içerik katmanı (Faz 2)

```ts
// apps/web/lib/content/registry.ts
export type ContentKind = 'text' | 'rich' | 'image' | 'list';
export type SlotDef = {
  kind: ContentKind; default: unknown; label: string;
  max?: number; pattern?: RegExp; warn?: string; allowHeadings?: boolean; // allowHeadings yalnızca legal.*
  // list için:
  fields?: Record<string, { kind: 'text' | 'rich' | 'image' | 'flag'; max?: number; label: string }>;
  maxItems?: number; fixedItems?: boolean; newItem?: () => Record<string, unknown>;
};
export const SLOTS: Record<string, SlotDef>; // anahtar örn. 'home.hero.title'
// apps/web/lib/content/getContent.ts
export async function getContent(): Promise<ContentMap>; // "use cache" + cacheTag('site-content'); hata olursa {}
export function read<T>(map: ContentMap, key: string): T; // map[key] ?? SLOTS[key].default
export async function isEditing(): Promise<boolean>;        // draftMode().isEnabled
export async function getReaderData(): Promise<ReaderData>;  // içerik + düzenleme modunda slot meta'sı
export async function getAnnouncements(): Promise<Announcement[]>;
// apps/web/app/actions/content.ts
export type ContentEdit = { key: string; value: unknown; baseUpdatedAt: string | null };
export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string; conflicts?: string[] };
export async function saveContent(edits: ContentEdit[]): Promise<SaveResult>;
export async function revertRevision(revisionId: string): Promise<SaveResult>;
// apps/web/app/actions/media.ts
export async function uploadImage(form: FormData): Promise<{ ok: true; asset: MediaAsset } | { ok: false; error: string }>;
```

Ek SQL nesneleri (Faz 2): `public.set_can_edit_site(p_user uuid, p_value boolean)` (yalnızca yönetici), `public.save_site_content(p_edits jsonb)` (tek transaction'da upsert + revizyon + çakışma kontrolü), view `public.active_announcements`, trigger `guard_profiles_can_edit_site` (yönetici olmayan `can_edit_site` değiştiremez). `content_revisions.new_value` NULL olabilir (silinen liste öğesi / varsayılana dönüş).

Önbellek mekanizması: `cacheComponents: true` + `"use cache"`. Faz 2 Task 1 bu ayar mevcut sayfaları bozarsa yedek yol `unstable_cache(..., { tags: ['site-content'] })` + `updateTag`'tir; hangisi seçildiyse Task 1'in commit mesajında yazar.

Gizlilik: `/gizlilik` metni Faz 1 Task 6a'da `apps/web/content/kvkk.ts` (`KVKK_TEXT`, `KVKK_CONSENT_LABEL`) olarak yazılır; Faz 2 `legal.gizlilik.body` varsayılanını `kvkkToHtml(KVKK_TEXT)`'ten üretir. `KVKK_CONSENT_LABEL` düzenlenebilir slot **değildir**.

Önbellek etiketi: `'site-content'` (içerik + duyurular + medya meta). Yayınlama: `updateTag('site-content')`.
Düzenleme modu uçları: `GET /api/edit/enable?next=<path>`, `GET /api/edit/disable`. Panel menüsünde "Siteyi düzenle" → `${SITE_URL}/api/edit/enable?next=/`.
S3 anahtar biçimi: `site-images/YYYY/MM/<uuid>.webp`.

### Sağlık uçları

- `apps/web/app/api/health/route.ts` → `{ ok: true }` (DB'ye dokunmaz).
- `apps/panel/app/api/health/route.ts` → `app_settings`'ten tek satır okur (Supabase'i aktif tutar ve DB'yi kontrol eder); middleware matcher'ında `api/health` hariç tutulur.

### Cron (Faz 0'da kurulur, fazlar satır ekler)

| Saat (TZ=Europe/Istanbul) | Komut | Faz |
|---|---|---|
| `30 2 * * *` | `/app/backup.sh` | 0 |
| `0 3 * * *` | `curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://panel:3000/api/cron/daily` | 0 |
| `0 6 * * *` | `curl … http://panel:3000/api/cron/ads` | 3 |

---

## Sahibin yapması gerekenler (kod dışı, ilgili görevde hatırlatılır)

- [ ] Bugün: sekeranaokulu.com'dan test formu gönder; e-posta ve kayıt geliyor mu kontrol et.
- [ ] GitHub'da private `seker-platform` deposu (Faz 0 Task 1).
- [ ] AWS hesabı: Lightsail sunucusu, S3 bucket'ları, iki IAM kullanıcısı (Faz 0 Task 6).
- [ ] Alan adının DNS paneline erişim (Faz 0 Task 9).
- [ ] Supabase panelinde yeni API anahtarlarını oluşturma (Faz 0 Task 3).
- [ ] Sitenin bugün yazdığı Supabase projesinin hangisi olduğu ve erişimi (Faz 1 Task 5).
- [ ] Resend'de `sekeranaokulu.com` alan adı doğrulaması (Faz 1).
- [ ] Google Ads: MCC, developer token başvurusu (Faz 0'da başvur, Faz 3'te kullan), OAuth istemcisi.
