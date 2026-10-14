# Faz 3: Pazarlama Ekranı Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panelin Google Ads harcamasını her sabah çekmesi, "randevu" ve "kayıt" olan reklam adaylarını Google'a offline dönüşüm olarak geri göndermesi ve yöneticiye kampanya + kaynak bazında harcama → aday → randevu → kayıt hunisini gösteren bir `/pazarlama` ekranı sunması.

**Architecture:** `0008_ads.sql` iki tablo (`ad_spend_daily`, `conversion_uploads`) ve `leads` üzerinde bir trigger ekler. Trigger, durum `randevu`/`kazanildi` olduğunda kuyruğa satır yazar. Panelde `lib/ads/` altında küçük, `fetch` tabanlı, test edilebilir bir istemci var: harcama Google Ads API `googleAds:searchStream` ile, dönüşümler **Data Manager API** `events:ingest` ile gider. Her sabah 06:00'da cron `/api/cron/ads` ucunu çağırır. Rapor saf bir fonksiyonla (`buildMarketingReport`) üretilir ve Server Component sayfada gösterilir. Developer token beklenirken harcama, Google Ads'ten indirilen CSV ile içeri alınabilir.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase (Postgres + RLS), zod 4, Vitest 4, Google Ads API REST `v25`, Google Data Manager API `v1`, OAuth 2.0 refresh token.

**Spec:** `docs/superpowers/specs/2026-10-14-seker-platform-design.html` §"Reklam ölçümü", §"Reklam raporunu okumak", §"Gece işleri". Ortak sözleşme: `docs/superpowers/plans/2026-10-14-00-seker-platform-index.md`.

> **Spec'ten sapma (bilinçli, 2026-10-14'te doğrulandı):** Spec "offline dönüşüm Google Ads API ile yüklenir" diyor. Google'ın belgesine göre **15 Haziran 2026'dan itibaren `UploadClickConversions` isteği, developer token'ı daha önce offline dönüşüm yüklememişse reddediliyor** ve Google yeni entegrasyonlar için Data Manager API'yi öneriyor. Bizim token yeni olacağı için dönüşümler `POST https://datamanager.googleapis.com/v1/events:ingest` ile gönderilir. Harcama okuma (searchStream) Google Ads API'de kalır. Kaynak: https://developers.google.com/google-ads/api/docs/conversions/upload-clicks, https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/send-events, https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest

## Global Constraints

- İndeks dosyasındaki Global Constraints'in tamamı geçerlidir (Türkçe UI, `text + CHECK` enum'lar, kuruş integer, `Europe/Istanbul`, migration dosyası zorunlu, yeni Supabase anahtar adları, her Server Action kendi yetki kontrolünü yapar).
- Panel enum değerleri ve etiketleri yalnızca `apps/panel/lib/constants.ts`'te.
- Migration numarası: `0008_ads.sql`. Tablo ve kolon adları indeks sözleşmesindeki gibi: `ad_spend_daily(date, campaign_id, campaign_name, cost_micros, clicks, impressions)` pk `(date, campaign_id)`; `conversion_uploads(id, lead_id, gclid, conversion_action ∈ {'randevu','kayit'}, conversion_at, value, status ∈ {'bekliyor','gonderildi','hata','atlandi'}, error, uploaded_at)` unique `(lead_id, conversion_action)`.
- Env adları sözleşmedeki gibi: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (opsiyonel, MCC), `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_CONVERSION_ACTION_RANDEVU`, `GOOGLE_ADS_CONVERSION_ACTION_KAYIT` (dönüşüm işlemi **ID**'si, sayı), `CRON_SECRET`. Müşteri ID'leri tiresiz rakam (`1234567890`).
- Google Ads API sürümü tek bir sabitte: `GOOGLE_ADS_API_VERSION = "v25"` (`apps/panel/lib/ads/config.ts`).
- Hesap para birimi TRY varsayılır; `cost_micros / 10_000 = kuruş`.
- Cron ucu yalnızca `Authorization: Bearer $CRON_SECRET` ile çalışır; reklam yapılandırması eksikse 200 döner ve hiçbir şey yapmaz (alarm üretmez).
- `/pazarlama` ve tüm pazarlama Server Action'ları yalnızca `yonetici`.
- Hiçbir gizli değer (token, refresh token, gclid listesi) loglara yazılmaz; hata mesajları 500 karakterle kesilir.
- Panel içindeki tüm komutlar monorepo kökünden (`C:\Users\meert\Desktop\seker-platform`) çalıştırılır.

## Review Focus

1. **Aynı aday iki kez gönderilmesin:** aday randevu → ulaşıldı → randevu dönerse kuyruğa ikinci satır yazılmamalı; `transactionId` (`<lead_id>:<action>`) Google tarafında da tekilliği sağlar. → Task 1 RLS testi "tekrar randevu" ve Task 4 testi "transactionId".
2. **Bir hatalı gclid diğerlerini durdurmasın:** Data Manager bir istekteki tek hatalı olayda tüm isteği reddeder; her dönüşüm ayrı istekte gönderilmeli ve sadece hatalı olan `hata` olmalı. → Task 4 testi "bir hata diğerini engellemez".
3. **Türkçe arayüzden indirilmiş CSV:** başlıklar Türkçe (`Gün`, `Kampanya kimliği`, `Maliyet`), sayı biçimi `1.234,56`, ilk iki satır rapor başlığı, son satır `Toplam`. → Task 6 testleri.
4. **Reklamdan gelip kampanyası bilinmeyen aday:** `gclid` var ama `utm_campaign` boş veya harcama tablosunda olmayan bir değer; satır kaybolmamalı, "Google Ads · kampanya bilinmiyor" satırında sayılmalı. → Task 7 testi.
5. **Onay alanı:** formdan gelen her aday (`consent_at` dolu) `consent: { adUserData: "CONSENT_GRANTED" }` ile gönderilmeli; `consent_at` boşsa alan hiç gönderilmemeli. → Task 4 testleri "onay biliniyorsa" / "onay bilinmiyorsa" ve Task 5 `listPending` eşlemesi.

---

## Dosya yapısı

```
packages/db/supabase/migrations/0008_ads.sql            tablo + RLS + kuyruk trigger'ı
apps/panel/lib/constants.ts                              (değişir) CONVERSION_ACTIONS, CONVERSION_UPLOAD_STATUSES
apps/panel/lib/ads/config.ts                             env okuma + API sürüm sabiti
apps/panel/lib/ads/types.ts                              SpendRow, PendingConversion, UploadOutcome, AdsStore
apps/panel/lib/ads/googleAds.ts                          getAccessToken, searchStream, fetchCampaignSpend, ingestConversion
apps/panel/lib/ads/sync.ts                               syncSpend, uploadPending, toIstanbulOffsetTimestamp, istanbulDaysAgo
apps/panel/lib/ads/store.ts                              supabaseAdsStore (AdsStore'un Supabase uygulaması)
apps/panel/lib/ads/csv.ts                                parseSpendCsv
apps/panel/lib/ads/report.ts                             buildMarketingReport, normalizeRange
apps/panel/lib/queries/marketing.ts                      getMarketingData
apps/panel/app/api/cron/ads/route.ts                     cron ucu
apps/panel/actions/marketing.ts                          retryConversionUpload, importSpendCsv
apps/panel/app/(app)/pazarlama/page.tsx                  ekran
apps/panel/components/marketing-table.tsx                kampanya/kaynak tablosu
apps/panel/components/conversion-upload-list.tsx         dönüşüm durum listesi + tekrar dene
apps/panel/components/spend-csv-form.tsx                 CSV yükleme formu (client)
apps/panel/components/nav.tsx                            (değişir) Pazarlama menüsü
apps/panel/components/notification-bell.tsx              (değişir) ads_senkron_hata metni
infra/cron/crontab                                       (değişir) 06:00 satırı
apps/panel/tests/rls/ads.test.ts                         RLS + trigger testleri
apps/panel/tests/unit/ads-google.test.ts
apps/panel/tests/unit/ads-sync.test.ts
apps/panel/tests/unit/ads-csv.test.ts
apps/panel/tests/unit/ads-report.test.ts
docs/pazarlama-kurulum.md                                sahibin Google Ads kurulum listesi
```

---

### Task 0: Sahibin Google tarafı hazırlığı (kod yok, Faz 0'da başlar)

Bu görev kod içermez ama Task 9'daki canlı doğrulama buna bağlıdır. Faz 0'da başlatılmalıdır çünkü onaylar günler sürebilir.

**Files:**
- Create: `docs/pazarlama-kurulum.md`

- [ ] **Step 1: Kurulum listesini yaz**

`docs/pazarlama-kurulum.md` içeriği:

```markdown
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

## Token beklerken
- Google Ads → Raporlar → Kampanyalar raporu; segment "Gün"; kolonlar: Gün, Kampanya kimliği, Kampanya, Maliyet,
  Tıklamalar, Gösterimler → İndir → CSV. Panel → Pazarlama → "Harcama CSV'si yükle".
```

- [ ] **Step 2: Commit**

```bash
git add docs/pazarlama-kurulum.md
git commit -m "docs(pazarlama): Google Ads ve Data Manager kurulum listesi"
```

---

### Task 1: Migration 0008 — tablolar, RLS ve dönüşüm kuyruğu trigger'ı

**Files:**
- Create: `packages/db/supabase/migrations/0008_ads.sql`
- Create: `apps/panel/tests/rls/ads.test.ts`
- Modify: `packages/db/src/database.types.ts` (üretilir)

**Interfaces:**
- Consumes: Faz 1'in `leads.gclid`, `leads.consent_at`, `leads.source` (`'reklam'` dahil); mevcut `public.is_yonetici()`, `offers(lead_id, status, offered_price, decided_at)`.
- Produces: `public.ad_spend_daily`, `public.conversion_uploads`, trigger `enqueue_conversion_upload` (her `leads` update'inde). Kuyruk kuralı: yeni durum `randevu` → `conversion_action='randevu'`; `kazanildi` → `'kayit'` ve `value` = son onaylanmış teklifin `offered_price`'ı (aylık ücret). Satır yalnızca `gclid` dolu **veya** `source='reklam'` ise yazılır. `gclid` boşsa `status='atlandi', error='gclid yok'`; aday 89 günden eskiyse `status='atlandi', error='tıklama 90 günden eski'`; aksi halde `'bekliyor'`.

- [ ] **Step 1: Başarısız RLS/trigger testini yaz**

`apps/panel/tests/rls/ads.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const DAN_ID = "00000000-0000-0000-0000-000000000002";
let yon: SupabaseClient;
let dan: SupabaseClient;

async function makeLead(fields: Record<string, unknown>) {
  const { data, error } = await admin
    .from("leads")
    .insert({ parent_name: "Ads Test Veli", phone: `+90555${Math.floor(1000000 + Math.random() * 8999999)}`, source: "reklam", assigned_to: DAN_ID, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

async function uploadsFor(leadId: string) {
  const { data } = await admin
    .from("conversion_uploads")
    .select("conversion_action, status, error, value, gclid")
    .eq("lead_id", leadId)
    .order("conversion_action");
  return data ?? [];
}

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
});

describe("conversion_uploads kuyruğu", () => {
  it("danışman randevuya aldığında gclid'li aday için 'bekliyor' satırı oluşur", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-1" });
    const { error } = await dan.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(error).toBeNull();
    expect(await uploadsFor(id)).toEqual([
      { conversion_action: "randevu", status: "bekliyor", error: null, value: null, gclid: "TEST-GCLID-1" },
    ]);
  });

  it("tekrar randevu ikinci satır üretmez", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-2" });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    await admin.from("leads").update({ status: "ulasildi" }).eq("id", id);
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toHaveLength(1);
  });

  it("reklam kaynaklı ama gclid'siz aday 'atlandi' olur", async () => {
    const id = await makeLead({ gclid: null });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "gclid yok" }]);
  });

  it("reklamsız ve gclid'siz aday için satır yazılmaz", async () => {
    const id = await makeLead({ source: "referans", gclid: null });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toHaveLength(0);
  });

  it("89 günden eski aday 'atlandi' olur", async () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    const id = await makeLead({ gclid: "TEST-GCLID-OLD", created_at: old });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "tıklama 90 günden eski" }]);
  });

  it("kazanıldı satırı onaylı teklifin aylık ücretini değer olarak alır", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-3" });
    const { error: offerError } = await admin.from("offers").insert({
      lead_id: id, created_by: DAN_ID, program: "tam_gun", list_price: 22000,
      offered_price: 19500, status: "onaylandi", decided_at: new Date().toISOString(),
    });
    expect(offerError).toBeNull();
    await admin.from("leads").update({ status: "kazanildi" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ conversion_action: "kayit", status: "bekliyor", value: 19500 }]);
  });
});

describe("RLS", () => {
  it("yönetici okur, danışman okuyamaz, kimse yazamaz", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-4" });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);

    const yonRead = await yon.from("conversion_uploads").select("id").eq("lead_id", id);
    expect(yonRead.data).toHaveLength(1);

    const danRead = await dan.from("conversion_uploads").select("id").eq("lead_id", id);
    expect(danRead.data).toEqual([]);

    const yonWrite = await yon.from("ad_spend_daily").insert({
      date: "2026-10-01", campaign_id: "1", campaign_name: "x", cost_micros: 1, clicks: 0, impressions: 0,
    });
    expect(yonWrite.error).not.toBeNull();

    const spendRead = await dan.from("ad_spend_daily").select("date");
    expect(spendRead.data).toEqual([]);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/rls/ads.test.ts`
Expected: FAIL — `relation "public.conversion_uploads" does not exist` (veya PostgREST `PGRST205`).

- [ ] **Step 3: Migration'ı yaz**

`packages/db/supabase/migrations/0008_ads.sql`:

```sql
-- Faz 3: reklam harcaması + offline dönüşüm kuyruğu

create table public.ad_spend_daily (
  date date not null,
  campaign_id text not null,
  campaign_name text not null,
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  clicks int not null default 0 check (clicks >= 0),
  impressions int not null default 0 check (impressions >= 0),
  primary key (date, campaign_id)
);

create table public.conversion_uploads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  gclid text,
  conversion_action text not null check (conversion_action in ('randevu','kayit')),
  conversion_at timestamptz not null default now(),
  value numeric(12,2),
  status text not null default 'bekliyor' check (status in ('bekliyor','gonderildi','hata','atlandi')),
  error text,
  uploaded_at timestamptz,
  unique (lead_id, conversion_action)
);
create index idx_conversion_uploads_status on public.conversion_uploads (status, conversion_at);

alter table public.ad_spend_daily enable row level security;
alter table public.conversion_uploads enable row level security;

-- Yalnızca yönetici okur; yazma yalnızca service_role (cron ve yönetici Server Action'ları secret key ile).
create policy sel_ad_spend_daily on public.ad_spend_daily for select using (public.is_yonetici());
create policy sel_conversion_uploads on public.conversion_uploads for select using (public.is_yonetici());

grant select on public.ad_spend_daily, public.conversion_uploads to authenticated;
grant all on public.ad_spend_daily, public.conversion_uploads to service_role;

-- Kuyruk: durum randevu/kazanildi olunca bir kez satır yazar.
-- security definer: danışmanın update'i tetiklediğinde de RLS'e takılmadan yazabilsin.
create or replace function public.enqueue_conversion_upload() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_action text;
  v_value numeric(12,2);
  v_status text := 'bekliyor';
  v_error text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'randevu' then
    v_action := 'randevu';
  elsif new.status = 'kazanildi' then
    v_action := 'kayit';
  else
    return new;
  end if;

  if coalesce(new.gclid, '') = '' and new.source <> 'reklam' then
    return new;
  end if;

  if coalesce(new.gclid, '') = '' then
    v_status := 'atlandi';
    v_error := 'gclid yok';
  elsif new.created_at < now() - interval '89 days' then
    v_status := 'atlandi';
    v_error := 'tıklama 90 günden eski';
  end if;

  if v_action = 'kayit' then
    select o.offered_price into v_value
    from public.offers o
    where o.lead_id = new.id and o.status = 'onaylandi'
    order by o.decided_at desc nulls last, o.created_at desc
    limit 1;
  end if;

  insert into public.conversion_uploads (lead_id, gclid, conversion_action, conversion_at, value, status, error)
  values (new.id, nullif(new.gclid, ''), v_action, now(), v_value, v_status, v_error)
  on conflict (lead_id, conversion_action) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_conversion_upload() from public, anon, authenticated;

create trigger enqueue_conversion_upload
  after update of status on public.leads
  for each row execute function public.enqueue_conversion_upload();
```

- [ ] **Step 4: Migration'ı test veritabanına uygula ve tipleri üret**

Run: `pnpm --filter @seker/db exec supabase db reset`
Expected: `Applying migration 0008_ads.sql...` ve `Finished supabase db reset`.

Run: `pnpm --filter @seker/db gen:types`
Expected: `packages/db/src/database.types.ts` içinde `ad_spend_daily` ve `conversion_uploads` geçer (`git diff --stat` dosyayı değişmiş gösterir).

- [ ] **Step 5: Testin geçtiğini gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/rls/ads.test.ts`
Expected: PASS — 7 test.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/migrations/0008_ads.sql packages/db/src/database.types.ts apps/panel/tests/rls/ads.test.ts
git commit -m "feat(db): reklam harcama tablosu ve offline dönüşüm kuyruğu (0008)"
```

---

### Task 2: Sabitler, yapılandırma ve tipler

**Files:**
- Modify: `apps/panel/lib/constants.ts` (dosya sonuna ekle, `label` fonksiyonundan önce)
- Create: `apps/panel/lib/ads/config.ts`
- Create: `apps/panel/lib/ads/types.ts`
- Test: `apps/panel/tests/unit/ads-google.test.ts` (bu görevde yalnızca `readAdsConfig` testleri)

**Interfaces:**
- Produces:
  ```ts
  // constants.ts
  export const CONVERSION_ACTIONS = { randevu: "Randevu", kayit: "Kayıt" } as const;
  export type ConversionAction = keyof typeof CONVERSION_ACTIONS;
  export const CONVERSION_UPLOAD_STATUSES = { bekliyor: "Bekliyor", gonderildi: "Gönderildi", hata: "Hata", atlandi: "Atlandı" } as const;
  export type ConversionUploadStatus = keyof typeof CONVERSION_UPLOAD_STATUSES;
  // config.ts
  export const GOOGLE_ADS_API_VERSION = "v25";
  export type AdsConfig = { developerToken: string; clientId: string; clientSecret: string; refreshToken: string; customerId: string; loginCustomerId: string | null; conversionActionIds: Record<ConversionAction, string> };
  export function readAdsConfig(env?: Record<string, string | undefined>): AdsConfig | null;
  // types.ts
  export type SpendRow = { date: string; campaignId: string; campaignName: string; costMicros: number; clicks: number; impressions: number };
  export type PendingConversion = { id: string; leadId: string; gclid: string; action: ConversionAction; conversionAt: string; value: number | null; adUserData: "granted" | "denied" | null };
  export type UploadOutcome = { id: string; status: "gonderildi" | "hata" | "atlandi"; error: string | null };
  export interface AdsStore { upsertSpend(rows: SpendRow[]): Promise<void>; listPending(limit: number): Promise<PendingConversion[]>; saveOutcomes(outcomes: UploadOutcome[]): Promise<void>; }
  export type FetchFn = typeof fetch;
  ```

- [ ] **Step 1: Başarısız testi yaz**

`apps/panel/tests/unit/ads-google.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readAdsConfig } from "@/lib/ads/config";

const FULL_ENV = {
  GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token",
  GOOGLE_ADS_CLIENT_ID: "client-id",
  GOOGLE_ADS_CLIENT_SECRET: "client-secret",
  GOOGLE_ADS_REFRESH_TOKEN: "refresh",
  GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: "",
  GOOGLE_ADS_CONVERSION_ACTION_RANDEVU: "111",
  GOOGLE_ADS_CONVERSION_ACTION_KAYIT: "222",
};

describe("readAdsConfig", () => {
  it("tüm değerler varsa yapılandırmayı tiresiz müşteri ID'siyle döner", () => {
    expect(readAdsConfig(FULL_ENV)).toEqual({
      developerToken: "dev-token",
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh",
      customerId: "1234567890",
      loginCustomerId: null,
      conversionActionIds: { randevu: "111", kayit: "222" },
    });
  });

  it("tek bir zorunlu değer eksikse null döner", () => {
    expect(readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_REFRESH_TOKEN: "" })).toBeNull();
  });

  it("MCC ID'si verilirse tiresiz saklanır", () => {
    expect(readAdsConfig({ ...FULL_ENV, GOOGLE_ADS_LOGIN_CUSTOMER_ID: "999-888-7777" })?.loginCustomerId).toBe("9998887777");
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-google.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ads/config"`.

- [ ] **Step 3: Sabitleri ekle**

`apps/panel/lib/constants.ts` içinde `export function label(` satırının hemen üstüne:

```ts
export const CONVERSION_ACTIONS = {
  randevu: "Randevu", kayit: "Kayıt",
} as const;
export type ConversionAction = keyof typeof CONVERSION_ACTIONS;

export const CONVERSION_UPLOAD_STATUSES = {
  bekliyor: "Bekliyor", gonderildi: "Gönderildi", hata: "Hata", atlandi: "Atlandı",
} as const;
export type ConversionUploadStatus = keyof typeof CONVERSION_UPLOAD_STATUSES;
```

- [ ] **Step 4: `config.ts` ve `types.ts` yaz**

`apps/panel/lib/ads/config.ts`:

```ts
import type { ConversionAction } from "@/lib/constants";

/** Google Ads API sürümü tek yerde. Google yılda birkaç sürüm çıkarır; yükseltirken yalnızca burası değişir. */
export const GOOGLE_ADS_API_VERSION = "v25";

export interface AdsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId: string | null;
  conversionActionIds: Record<ConversionAction, string>;
}

function digits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Reklam entegrasyonu için gereken env değerlerini okur. Biri eksikse null (entegrasyon kapalı). */
export function readAdsConfig(
  env: Record<string, string | undefined> = process.env,
): AdsConfig | null {
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() ?? "";
  const clientId = env.GOOGLE_ADS_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_ADS_CLIENT_SECRET?.trim() ?? "";
  const refreshToken = env.GOOGLE_ADS_REFRESH_TOKEN?.trim() ?? "";
  const customerId = digits(env.GOOGLE_ADS_CUSTOMER_ID);
  const randevu = digits(env.GOOGLE_ADS_CONVERSION_ACTION_RANDEVU);
  const kayit = digits(env.GOOGLE_ADS_CONVERSION_ACTION_KAYIT);
  const login = digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

  if (!developerToken || !clientId || !clientSecret || !refreshToken || !customerId || !randevu || !kayit) {
    return null;
  }

  return {
    developerToken,
    clientId,
    clientSecret,
    refreshToken,
    customerId,
    loginCustomerId: login || null,
    conversionActionIds: { randevu, kayit },
  };
}
```

`apps/panel/lib/ads/types.ts`:

```ts
import type { ConversionAction } from "@/lib/constants";

export type FetchFn = typeof fetch;

export interface SpendRow {
  date: string; // YYYY-MM-DD (hesap saat dilimi)
  campaignId: string;
  campaignName: string;
  costMicros: number;
  clicks: number;
  impressions: number;
}

export interface PendingConversion {
  id: string;
  leadId: string;
  gclid: string;
  action: ConversionAction;
  conversionAt: string; // ISO (DB timestamptz)
  value: number | null; // TL
  adUserData: "granted" | "denied" | null;
}

export interface UploadOutcome {
  id: string;
  status: "gonderildi" | "hata" | "atlandi";
  error: string | null;
}

export interface AdsStore {
  upsertSpend(rows: SpendRow[]): Promise<void>;
  listPending(limit: number): Promise<PendingConversion[]>;
  saveOutcomes(outcomes: UploadOutcome[]): Promise<void>;
}
```

- [ ] **Step 5: Testin geçtiğini gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-google.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 6: Commit**

```bash
git add apps/panel/lib/constants.ts apps/panel/lib/ads/config.ts apps/panel/lib/ads/types.ts apps/panel/tests/unit/ads-google.test.ts
git commit -m "feat(panel): reklam entegrasyonu yapılandırması ve tipleri"
```

---

### Task 3: Google istemcisi (OAuth, searchStream, Data Manager ingest)

**Files:**
- Create: `apps/panel/lib/ads/googleAds.ts`
- Modify: `apps/panel/tests/unit/ads-google.test.ts` (test ekle)

**Interfaces:**
- Consumes: `AdsConfig`, `GOOGLE_ADS_API_VERSION` (Task 2), `SpendRow`, `PendingConversion`, `FetchFn` (Task 2).
- Produces:
  ```ts
  export async function getAccessToken(cfg: AdsConfig, fetchFn?: FetchFn): Promise<string>;
  export async function searchStream(cfg: AdsConfig, token: string, query: string, fetchFn?: FetchFn): Promise<unknown[]>; // düzleştirilmiş results
  export async function fetchCampaignSpend(cfg: AdsConfig, token: string, from: string, to: string, fetchFn?: FetchFn): Promise<SpendRow[]>;
  export type IngestResult = { ok: true; requestId: string | null } | { ok: false; error: string };
  export async function ingestConversion(cfg: AdsConfig, token: string, conv: PendingConversion, eventTimestamp: string, fetchFn?: FetchFn): Promise<IngestResult>;
  export class GoogleApiError extends Error { status: number }
  ```

- [ ] **Step 1: Başarısız testleri ekle**

`apps/panel/tests/unit/ads-google.test.ts` dosyasının sonuna:

```ts
import { vi } from "vitest";
import {
  getAccessToken,
  fetchCampaignSpend,
  ingestConversion,
  GoogleApiError,
} from "@/lib/ads/googleAds";
import type { AdsConfig } from "@/lib/ads/config";

const CFG: AdsConfig = {
  developerToken: "dev-token",
  clientId: "cid",
  clientSecret: "csecret",
  refreshToken: "rtok",
  customerId: "1234567890",
  loginCustomerId: "9998887777",
  conversionActionIds: { randevu: "111", kayit: "222" },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("getAccessToken", () => {
  it("refresh token'ı form gövdesiyle değiştirir", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "acc-1", expires_in: 3599 }));
    await expect(getAccessToken(CFG, fetchFn)).resolves.toBe("acc-1");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body as string);
    expect(Object.fromEntries(body)).toEqual({
      client_id: "cid", client_secret: "csecret", refresh_token: "rtok", grant_type: "refresh_token",
    });
  });

  it("Google hata dönerse GoogleApiError fırlatır (token metne yazılmaz)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: "invalid_grant" }, 400));
    const err = await getAccessToken(CFG, fetchFn).catch((e) => e);
    expect(err).toBeInstanceOf(GoogleApiError);
    expect(err.status).toBe(400);
    expect(String(err.message)).not.toContain("rtok");
  });
});

describe("fetchCampaignSpend", () => {
  it("searchStream yanıtını SpendRow listesine çevirir, eksik metrikleri 0 sayar", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          results: [
            { campaign: { id: "555", name: "Beylikdüzü" }, metrics: { costMicros: "12500000", clicks: "7", impressions: "300" }, segments: { date: "2026-10-12" } },
            { campaign: { id: "556", name: "Kreş 2 yaş" }, metrics: {}, segments: { date: "2026-10-12" } },
          ],
          fieldMask: "segments.date,campaign.id,campaign.name,metrics.costMicros,metrics.clicks,metrics.impressions",
        },
      ]),
    );

    const rows = await fetchCampaignSpend(CFG, "acc", "2026-10-12", "2026-10-12", fetchFn);

    expect(rows).toEqual([
      { date: "2026-10-12", campaignId: "555", campaignName: "Beylikdüzü", costMicros: 12500000, clicks: 7, impressions: 300 },
      { date: "2026-10-12", campaignId: "556", campaignName: "Kreş 2 yaş", costMicros: 0, clicks: 0, impressions: 0 },
    ]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://googleads.googleapis.com/v25/customers/1234567890/googleAds:searchStream");
    expect(init.headers).toMatchObject({
      authorization: "Bearer acc",
      "developer-token": "dev-token",
      "login-customer-id": "9998887777",
    });
    expect(JSON.parse(init.body).query).toContain("segments.date BETWEEN '2026-10-12' AND '2026-10-12'");
  });

  it("tarih biçimi bozuksa istek atmadan hata verir", async () => {
    const fetchFn = vi.fn();
    await expect(fetchCampaignSpend(CFG, "acc", "2026-10-12' OR 1=1", "2026-10-12", fetchFn)).rejects.toThrow("Geçersiz tarih");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("ingestConversion", () => {
  const conv = {
    id: "u1", leadId: "lead-1", gclid: "GCLID-X", action: "kayit" as const,
    conversionAt: "2026-10-13T09:00:00Z", value: 19500, adUserData: "granted" as const,
  };

  it("Data Manager'a doğru hedef, transactionId ve değerle gönderir", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ requestId: "req-9" }));
    const result = await ingestConversion(CFG, "acc", conv, "2026-10-13T12:00:00+03:00", fetchFn);
    expect(result).toEqual({ ok: true, requestId: "req-9" });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://datamanager.googleapis.com/v1/events:ingest");
    expect(init.headers).toMatchObject({ authorization: "Bearer acc" });
    expect(JSON.parse(init.body)).toEqual({
      destinations: [
        {
          operatingAccount: { accountType: "GOOGLE_ADS", accountId: "1234567890" },
          loginAccount: { accountType: "GOOGLE_ADS", accountId: "9998887777" },
          productDestinationId: "222",
        },
      ],
      consent: { adUserData: "CONSENT_GRANTED" },
      events: [
        {
          adIdentifiers: { gclid: "GCLID-X" },
          eventTimestamp: "2026-10-13T12:00:00+03:00",
          transactionId: "lead-1:kayit",
          eventSource: "WEB",
          conversionValue: 19500,
          currency: "TRY",
        },
      ],
      validateOnly: false,
    });
  });

  it("onay bilinmiyorsa consent alanını göndermez, değer yoksa conversionValue göndermez", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ requestId: "req-10" }));
    await ingestConversion(CFG, "acc", { ...conv, action: "randevu", value: null, adUserData: null }, "2026-10-13T12:00:00+03:00", fetchFn);
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.consent).toBeUndefined();
    expect(body.events[0].conversionValue).toBeUndefined();
    expect(body.events[0].currency).toBeUndefined();
    expect(body.destinations[0].productDestinationId).toBe("111");
  });

  it("4xx yanıtında Google'ın mesajını 500 karakterle döner", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: { message: "x".repeat(800) } }, 400));
    const result = await ingestConversion(CFG, "acc", conv, "2026-10-13T12:00:00+03:00", fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toHaveLength(500);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-google.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ads/googleAds"`.

- [ ] **Step 3: İstemciyi yaz**

`apps/panel/lib/ads/googleAds.ts`:

```ts
import { GOOGLE_ADS_API_VERSION, type AdsConfig } from "./config";
import type { FetchFn, PendingConversion, SpendRow } from "./types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_MANAGER_INGEST_URL = "https://datamanager.googleapis.com/v1/events:ingest";
const MAX_ERROR_LENGTH = 500;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class GoogleApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GoogleApiError";
  }
}

function truncate(text: string): string {
  return text.length > MAX_ERROR_LENGTH ? text.slice(0, MAX_ERROR_LENGTH) : text;
}

async function errorText(response: Response): Promise<string> {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as { error?: string | { message?: string }; error_description?: string };
    if (typeof parsed.error === "string") return truncate(parsed.error_description ?? parsed.error);
    if (parsed.error?.message) return truncate(parsed.error.message);
  } catch {
    // JSON değilse ham metin
  }
  return truncate(raw || `HTTP ${response.status}`);
}

/** Refresh token'ı kısa ömürlü access token'a çevirir. */
export async function getAccessToken(cfg: AdsConfig, fetchFn: FetchFn = fetch): Promise<string> {
  const response = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!response.ok) {
    throw new GoogleApiError(`OAuth token alınamadı: ${await errorText(response)}`, response.status);
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new GoogleApiError("OAuth yanıtında access_token yok", 500);
  return data.access_token;
}

function adsHeaders(cfg: AdsConfig, token: string): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "developer-token": cfg.developerToken,
    "content-type": "application/json",
  };
  if (cfg.loginCustomerId) headers["login-customer-id"] = cfg.loginCustomerId;
  return headers;
}

/** GAQL sorgusunu searchStream ile çalıştırır; tüm parçaların `results` dizilerini tek diziye düzleştirir. */
export async function searchStream(
  cfg: AdsConfig,
  token: string,
  query: string,
  fetchFn: FetchFn = fetch,
): Promise<unknown[]> {
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cfg.customerId}/googleAds:searchStream`;
  const response = await fetchFn(url, {
    method: "POST",
    headers: adsHeaders(cfg, token),
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new GoogleApiError(`Google Ads sorgusu başarısız: ${await errorText(response)}`, response.status);
  }
  const batches = (await response.json()) as { results?: unknown[] }[];
  return batches.flatMap((batch) => batch.results ?? []);
}

interface CampaignMetricsResult {
  campaign?: { id?: string; name?: string };
  metrics?: { costMicros?: string; clicks?: string; impressions?: string };
  segments?: { date?: string };
}

/** Kampanya bazında günlük harcamayı çeker. Tarihler YYYY-MM-DD, iki uç dahil. */
export async function fetchCampaignSpend(
  cfg: AdsConfig,
  token: string,
  from: string,
  to: string,
  fetchFn: FetchFn = fetch,
): Promise<SpendRow[]> {
  if (!YMD.test(from) || !YMD.test(to)) throw new Error("Geçersiz tarih");
  const query =
    "SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions " +
    `FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`;
  const results = (await searchStream(cfg, token, query, fetchFn)) as CampaignMetricsResult[];
  return results.map((row) => ({
    date: row.segments?.date ?? from,
    campaignId: String(row.campaign?.id ?? ""),
    campaignName: row.campaign?.name ?? "",
    costMicros: Number(row.metrics?.costMicros ?? 0),
    clicks: Number(row.metrics?.clicks ?? 0),
    impressions: Number(row.metrics?.impressions ?? 0),
  }));
}

export type IngestResult = { ok: true; requestId: string | null } | { ok: false; error: string };

/**
 * Tek bir offline dönüşümü Data Manager API'ye gönderir.
 * Data Manager bir istekteki tek hatalı olayda tüm isteği reddettiği için her dönüşüm ayrı istektir.
 */
export async function ingestConversion(
  cfg: AdsConfig,
  token: string,
  conv: PendingConversion,
  eventTimestamp: string,
  fetchFn: FetchFn = fetch,
): Promise<IngestResult> {
  const event: Record<string, unknown> = {
    adIdentifiers: { gclid: conv.gclid },
    eventTimestamp,
    transactionId: `${conv.leadId}:${conv.action}`,
    eventSource: "WEB",
  };
  if (conv.value != null && conv.value > 0) {
    event.conversionValue = conv.value;
    event.currency = "TRY";
  }

  const body: Record<string, unknown> = {
    destinations: [
      {
        operatingAccount: { accountType: "GOOGLE_ADS", accountId: cfg.customerId },
        loginAccount: { accountType: "GOOGLE_ADS", accountId: cfg.loginCustomerId ?? cfg.customerId },
        productDestinationId: cfg.conversionActionIds[conv.action],
      },
    ],
    events: [event],
    validateOnly: false,
  };
  if (conv.adUserData === "granted") body.consent = { adUserData: "CONSENT_GRANTED" };

  const response = await fetchFn(DATA_MANAGER_INGEST_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) return { ok: false, error: await errorText(response) };
  const data = (await response.json().catch(() => ({}))) as { requestId?: string };
  return { ok: true, requestId: data.requestId ?? null };
}
```

> Not: `body` testte `validateOnly: false` ile aynen karşılaştırılır; anahtar sırası JSON eşitliğini etkilemez.

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-google.test.ts`
Expected: PASS — 10 test.

- [ ] **Step 5: Commit**

```bash
git add apps/panel/lib/ads/googleAds.ts apps/panel/tests/unit/ads-google.test.ts
git commit -m "feat(panel): Google Ads searchStream ve Data Manager ingest istemcisi"
```

---

### Task 4: Senkron mantığı (`syncSpend`, `uploadPending`)

**Files:**
- Create: `apps/panel/lib/ads/sync.ts`
- Test: `apps/panel/tests/unit/ads-sync.test.ts`

**Interfaces:**
- Consumes: `AdsStore`, `PendingConversion`, `UploadOutcome`, `SpendRow` (Task 2); `fetchCampaignSpend`, `ingestConversion` (Task 3).
- Produces:
  ```ts
  export function toIstanbulOffsetTimestamp(iso: string): string; // "2026-10-13T12:00:00+03:00"
  export function istanbulDaysAgo(days: number, now?: Date): string; // YYYY-MM-DD
  export type SyncDeps = { cfg: AdsConfig; token: string; store: AdsStore; fetchFn?: FetchFn };
  export async function syncSpend(deps: SyncDeps, from: string, to: string): Promise<number>;
  export async function uploadPending(deps: SyncDeps, limit?: number): Promise<{ sent: number; failed: number; skipped: number }>;
  ```

- [ ] **Step 1: Başarısız testi yaz**

`apps/panel/tests/unit/ads-sync.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { syncSpend, uploadPending, toIstanbulOffsetTimestamp, istanbulDaysAgo } from "@/lib/ads/sync";
import type { AdsStore, PendingConversion, SpendRow, UploadOutcome } from "@/lib/ads/types";
import type { AdsConfig } from "@/lib/ads/config";

const CFG: AdsConfig = {
  developerToken: "d", clientId: "c", clientSecret: "s", refreshToken: "r",
  customerId: "1234567890", loginCustomerId: null, conversionActionIds: { randevu: "111", kayit: "222" },
};

function fakeStore(pending: PendingConversion[] = []) {
  const spend: SpendRow[] = [];
  const outcomes: UploadOutcome[] = [];
  const store: AdsStore = {
    upsertSpend: async (rows) => { spend.push(...rows); },
    listPending: async (limit) => pending.slice(0, limit),
    saveOutcomes: async (o) => { outcomes.push(...o); },
  };
  return { store, spend, outcomes };
}

function pending(overrides: Partial<PendingConversion>): PendingConversion {
  return {
    id: "u1", leadId: "lead-1", gclid: "G1", action: "randevu",
    conversionAt: "2026-10-13T09:00:00Z", value: null, adUserData: null, ...overrides,
  };
}

const ok = () => new Response(JSON.stringify({ requestId: "r" }), { status: 200 });
const bad = (msg: string) => new Response(JSON.stringify({ error: { message: msg } }), { status: 400 });

describe("toIstanbulOffsetTimestamp", () => {
  it("UTC zamanı +03:00 ofsetli yerel zamana çevirir", () => {
    expect(toIstanbulOffsetTimestamp("2026-10-13T21:30:05Z")).toBe("2026-10-14T00:30:05+03:00");
  });
});

describe("istanbulDaysAgo", () => {
  it("İstanbul takvimine göre geriye sayar", () => {
    expect(istanbulDaysAgo(1, new Date("2026-10-13T22:30:00Z"))).toBe("2026-10-13");
    expect(istanbulDaysAgo(3, new Date("2026-10-14T06:00:00+03:00"))).toBe("2026-10-11");
  });
});

describe("syncSpend", () => {
  it("çekilen satırları store'a yazar ve sayısını döner", async () => {
    const { store, spend } = fakeStore();
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ results: [{ campaign: { id: "1", name: "A" }, metrics: { costMicros: "10" }, segments: { date: "2026-10-12" } }] }]), { status: 200 }),
    );
    await expect(syncSpend({ cfg: CFG, token: "t", store, fetchFn }, "2026-10-12", "2026-10-12")).resolves.toBe(1);
    expect(spend).toEqual([{ date: "2026-10-12", campaignId: "1", campaignName: "A", costMicros: 10, clicks: 0, impressions: 0 }]);
  });
});

describe("uploadPending", () => {
  it("başarılıları gönderildi, hatalıyı hata yapar; bir hata diğerini engellemez", async () => {
    const { store, outcomes } = fakeStore([
      pending({ id: "u1", gclid: "G1" }),
      pending({ id: "u2", gclid: "BAD", leadId: "lead-2" }),
      pending({ id: "u3", gclid: "G3", leadId: "lead-3" }),
    ]);
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(bad("Invalid gclid"))
      .mockResolvedValueOnce(ok());

    const result = await uploadPending({ cfg: CFG, token: "t", store, fetchFn });

    expect(result).toEqual({ sent: 2, failed: 1, skipped: 0 });
    expect(outcomes).toEqual([
      { id: "u1", status: "gonderildi", error: null },
      { id: "u2", status: "hata", error: "Invalid gclid" },
      { id: "u3", status: "gonderildi", error: null },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("reklam verisi onayı reddedilmişse göndermeden atlar", async () => {
    const { store, outcomes } = fakeStore([pending({ adUserData: "denied" })]);
    const fetchFn = vi.fn();
    const result = await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(outcomes).toEqual([{ id: "u1", status: "atlandi", error: "reklam verisi onayı yok" }]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("olay zamanını İstanbul ofsetiyle gönderir ve transactionId kullanır", async () => {
    const { store } = fakeStore([pending({ conversionAt: "2026-10-13T09:00:00Z" })]);
    const fetchFn = vi.fn().mockResolvedValue(ok());
    await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    const event = JSON.parse(fetchFn.mock.calls[0][1].body).events[0];
    expect(event.eventTimestamp).toBe("2026-10-13T12:00:00+03:00");
    expect(event.transactionId).toBe("lead-1:randevu");
  });

  it("ağ hatası (fetch reddi) o satırı hata yapar, döngü devam eder", async () => {
    const { store, outcomes } = fakeStore([pending({ id: "u1" }), pending({ id: "u2", leadId: "lead-2" })]);
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(ok());
    const result = await uploadPending({ cfg: CFG, token: "t", store, fetchFn });
    expect(result).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(outcomes[0]).toEqual({ id: "u1", status: "hata", error: "ECONNRESET" });
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-sync.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ads/sync"`.

- [ ] **Step 3: `sync.ts` yaz**

`apps/panel/lib/ads/sync.ts`:

```ts
import type { AdsConfig } from "./config";
import { fetchCampaignSpend, ingestConversion } from "./googleAds";
import type { AdsStore, FetchFn, UploadOutcome } from "./types";

export interface SyncDeps {
  cfg: AdsConfig;
  token: string;
  store: AdsStore;
  fetchFn?: FetchFn;
}

/** Türkiye 2016'dan beri sabit UTC+3 (yaz saati yok). */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

/** ISO zaman damgasını Data Manager'ın beklediği "+03:00" ofsetli biçime çevirir. */
export function toIstanbulOffsetTimestamp(iso: string): string {
  const local = new Date(new Date(iso).getTime() + ISTANBUL_OFFSET_MS);
  return `${local.toISOString().slice(0, 19)}+03:00`;
}

/** İstanbul takvimine göre `days` gün önceki tarihi YYYY-MM-DD döner. */
export function istanbulDaysAgo(days: number, now: Date = new Date()): string {
  const local = new Date(now.getTime() + ISTANBUL_OFFSET_MS - days * 86400000);
  return local.toISOString().slice(0, 10);
}

/** Harcamayı çeker ve idempotent biçimde yazar (aynı gün tekrar çekilirse üzerine yazar). */
export async function syncSpend(deps: SyncDeps, from: string, to: string): Promise<number> {
  const rows = await fetchCampaignSpend(deps.cfg, deps.token, from, to, deps.fetchFn);
  if (rows.length > 0) await deps.store.upsertSpend(rows);
  return rows.length;
}

/** Bekleyen dönüşümleri tek tek gönderir; her satırın sonucunu kaydeder. */
export async function uploadPending(
  deps: SyncDeps,
  limit = 50,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const pending = await deps.store.listPending(limit);
  const outcomes: UploadOutcome[] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const conv of pending) {
    if (conv.adUserData === "denied") {
      outcomes.push({ id: conv.id, status: "atlandi", error: "reklam verisi onayı yok" });
      skipped += 1;
      continue;
    }
    try {
      const result = await ingestConversion(
        deps.cfg,
        deps.token,
        conv,
        toIstanbulOffsetTimestamp(conv.conversionAt),
        deps.fetchFn,
      );
      if (result.ok) {
        outcomes.push({ id: conv.id, status: "gonderildi", error: null });
        sent += 1;
      } else {
        outcomes.push({ id: conv.id, status: "hata", error: result.error });
        failed += 1;
      }
    } catch (error) {
      outcomes.push({ id: conv.id, status: "hata", error: (error as Error).message.slice(0, 500) });
      failed += 1;
    }
  }

  if (outcomes.length > 0) await deps.store.saveOutcomes(outcomes);
  return { sent, failed, skipped };
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-sync.test.ts`
Expected: PASS — 7 test.

- [ ] **Step 5: Commit**

```bash
git add apps/panel/lib/ads/sync.ts apps/panel/tests/unit/ads-sync.test.ts
git commit -m "feat(panel): harcama senkronu ve dönüşüm yükleme döngüsü"
```

---

### Task 5: Supabase store, cron ucu, crontab ve hata bildirimi

**Files:**
- Create: `apps/panel/lib/ads/store.ts`
- Create: `apps/panel/app/api/cron/ads/route.ts`
- Modify: `infra/cron/crontab`
- Modify: `apps/panel/components/notification-bell.tsx`

**Interfaces:**
- Consumes: `createAdminSupabase()` (`@seker/auth/admin`), `readAdsConfig`, `getAccessToken`, `syncSpend`, `uploadPending`, `istanbulDaysAgo`.
- Produces: `export function supabaseAdsStore(db: SupabaseClient): AdsStore;` ve `GET /api/cron/ads` → `{ ok: true, spendRows, sent, failed, skipped }` | `{ ok: true, skipped: "yapilandirilmamis" }` | 401 | 500 `{ ok: false, error }`. Bildirim tipi `ads_senkron_hata` payload `{ message, tarih }`.

Bu görevde yeni saf mantık yoktur (Task 3–4 test edildi); doğrulama `curl` ile yapılır.

- [ ] **Step 1: `store.ts` yaz**

`apps/panel/lib/ads/store.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversionAction } from "@/lib/constants";
import type { AdsStore, PendingConversion } from "./types";

interface PendingRow {
  id: string;
  lead_id: string;
  gclid: string | null;
  conversion_action: ConversionAction;
  conversion_at: string;
  value: number | string | null;
  lead: { consent_at: string | null } | { consent_at: string | null }[] | null;
}

/**
 * Sahip kararı (2026-10-14): formdaki zorunlu KVKK onayı reklam verisi onayı sayılır.
 * Formdan gelen her adayın consent_at'i dolu olduğu için Google'a CONSENT_GRANTED gider.
 * consent_at boşsa (panelden elle girilmiş aday) onay alanı gönderilmez.
 */
function readAdUserData(consentAt: string | null | undefined): "granted" | null {
  return consentAt ? "granted" : null;
}

export function supabaseAdsStore(db: SupabaseClient): AdsStore {
  return {
    async upsertSpend(rows) {
      const { error } = await db.from("ad_spend_daily").upsert(
        rows.map((row) => ({
          date: row.date,
          campaign_id: row.campaignId,
          campaign_name: row.campaignName,
          cost_micros: row.costMicros,
          clicks: row.clicks,
          impressions: row.impressions,
        })),
        { onConflict: "date,campaign_id" },
      );
      if (error) throw new Error(`ad_spend_daily yazılamadı: ${error.message}`);
    },

    async listPending(limit) {
      const { data, error } = await db
        .from("conversion_uploads")
        .select("id, lead_id, gclid, conversion_action, conversion_at, value, lead:leads(consent_at)")
        .eq("status", "bekliyor")
        .not("gclid", "is", null)
        .order("conversion_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`conversion_uploads okunamadı: ${error.message}`);
      return ((data ?? []) as unknown as PendingRow[]).map((row): PendingConversion => {
        const lead = Array.isArray(row.lead) ? row.lead[0] : row.lead;
        return {
          id: row.id,
          leadId: row.lead_id,
          gclid: row.gclid ?? "",
          action: row.conversion_action,
          conversionAt: row.conversion_at,
          value: row.value == null ? null : Number(row.value),
          adUserData: readAdUserData(lead?.consent_at),
        };
      });
    },

    async saveOutcomes(outcomes) {
      const now = new Date().toISOString();
      for (const outcome of outcomes) {
        const { error } = await db
          .from("conversion_uploads")
          .update({
            status: outcome.status,
            error: outcome.error,
            uploaded_at: outcome.status === "gonderildi" ? now : null,
          })
          .eq("id", outcome.id);
        if (error) throw new Error(`conversion_uploads güncellenemedi: ${error.message}`);
      }
    },
  };
}
```

- [ ] **Step 2: Cron ucunu yaz**

`apps/panel/app/api/cron/ads/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@seker/auth/admin";
import { readAdsConfig } from "@/lib/ads/config";
import { getAccessToken } from "@/lib/ads/googleAds";
import { supabaseAdsStore } from "@/lib/ads/store";
import { istanbulDaysAgo, syncSpend, uploadPending } from "@/lib/ads/sync";
import { istanbulDateString } from "@/lib/cron-rules";

export const dynamic = "force-dynamic";

/** Google maliyeti birkaç gün düzeltebildiği için son 3 gün her sabah yeniden çekilir. */
const RESYNC_DAYS = 3;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = readAdsConfig();
  if (!cfg) return NextResponse.json({ ok: true, skipped: "yapilandirilmamis" });

  const db = createAdminSupabase();
  try {
    const token = await getAccessToken(cfg);
    const deps = { cfg, token, store: supabaseAdsStore(db) };
    const spendRows = await syncSpend(deps, istanbulDaysAgo(RESYNC_DAYS), istanbulDaysAgo(1));
    const upload = await uploadPending(deps);
    return NextResponse.json({ ok: true, spendRows, ...upload });
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    console.error("[cron/ads]", message);
    const today = istanbulDateString();
    const { data: yoneticiler } = await db.from("profiles").select("id").eq("role", "yonetici").eq("is_active", true);
    for (const y of yoneticiler ?? []) {
      const { data: existing } = await db
        .from("notifications")
        .select("id")
        .eq("user_id", y.id)
        .eq("type", "ads_senkron_hata")
        .eq("payload->>tarih", today)
        .limit(1);
      if (existing?.length) continue;
      await db.from("notifications").insert({ user_id: y.id, type: "ads_senkron_hata", payload: { message, tarih: today } });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Bildirim metnini ekle**

`apps/panel/components/notification-bell.tsx` içinde `notificationText` switch'ine `case "teklif_reddedildi":` satırından hemen önce:

```tsx
    case "ads_senkron_hata":
      return "Google Ads senkronu bu sabah başarısız oldu. Pazarlama ekranına bakın.";
```

ve `notificationHref` fonksiyonunun ilk satırı olarak:

```tsx
  if (notification.type === "ads_senkron_hata") return "/pazarlama";
```

- [ ] **Step 4: Crontab satırını ekle**

`infra/cron/crontab` dosyasında `/api/cron/daily` satırının hemen altına, o satırla aynı biçimde (aynı `curl` bayrakları ve `$CRON_SECRET` kullanımı):

```
0 6 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://panel:3000/api/cron/ads
```

- [ ] **Step 5: Yerelde doğrula**

Run (ayrı terminalde): `pnpm --filter @seker/panel dev`
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/ads`
Expected: `401`

Run (Google env değişkenleri `.env.local`'de **yokken**): `curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ads`
Expected: `{"ok":true,"skipped":"yapilandirilmamis"}`

Run: `pnpm --filter @seker/panel exec tsc --noEmit`
Expected: hata yok.

- [ ] **Step 6: Commit**

```bash
git add apps/panel/lib/ads/store.ts apps/panel/app/api/cron/ads/route.ts apps/panel/components/notification-bell.tsx infra/cron/crontab
git commit -m "feat(panel): sabah reklam senkronu cron ucu ve hata bildirimi"
```

---

### Task 6: Harcama CSV'si içe aktarma (token beklerken)

**Files:**
- Create: `apps/panel/lib/ads/csv.ts`
- Create: `apps/panel/actions/marketing.ts` (bu görevde `importSpendCsv`)
- Test: `apps/panel/tests/unit/ads-csv.test.ts`

**Interfaces:**
- Consumes: `SpendRow` (Task 2), `supabaseAdsStore` (Task 5), `getSessionProfile` (`@/lib/auth`), `createAdminSupabase` (`@seker/auth/admin`).
- Produces:
  ```ts
  export function parseLocaleNumber(raw: string): number | null;
  export function parseSpendCsv(text: string): { rows: SpendRow[]; errors: string[] };
  // actions/marketing.ts
  export async function importSpendCsv(formData: FormData): Promise<{ ok: true; count: number; warnings: string[] } | { ok: false; error: string }>;
  ```

- [ ] **Step 1: Başarısız testi yaz**

`apps/panel/tests/unit/ads-csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseLocaleNumber, parseSpendCsv } from "@/lib/ads/csv";

describe("parseLocaleNumber", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["234,5", 234.5],
    ["1.234", 1234],
    ["12.5", 12.5],
    ["₺1.050,00", 1050],
    ["TRY 75,00", 75],
    ["0", 0],
    ["--", null],
    ["", null],
  ])("%s → %s", (raw, expected) => {
    expect(parseLocaleNumber(raw)).toBe(expected);
  });
});

describe("parseSpendCsv", () => {
  it("Türkçe arayüzden indirilen, başlık satırları ve Toplam satırı olan CSV'yi okur", () => {
    const csv = [
      "\uFEFFKampanya raporu",
      '"1 Ekim 2026 - 13 Ekim 2026"',
      "Gün,Kampanya kimliği,Kampanya,Maliyet,Tıklamalar,Gösterimler",
      '2026-10-12,555,Beylikdüzü,"1.234,56",12,"1.020"',
      "12.10.2026,556,\"Kreş, 2 yaş\",\"75,00\",3,90",
      'Toplam: Hesap,,,"1.309,56",15,"1.110"',
    ].join("\n");

    const { rows, errors } = parseSpendCsv(csv);

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { date: "2026-10-12", campaignId: "555", campaignName: "Beylikdüzü", costMicros: 1234560000, clicks: 12, impressions: 1020 },
      { date: "2026-10-12", campaignId: "556", campaignName: "Kreş, 2 yaş", costMicros: 75000000, clicks: 3, impressions: 90 },
    ]);
  });

  it("İngilizce, sekmeyle ayrılmış (Excel CSV) dosyayı okur", () => {
    const tsv = [
      "Campaign report",
      "All time",
      "Day\tCampaign ID\tCampaign\tCost\tClicks\tImpr.",
      "2026-10-11\t555\tBeylikdüzü\t10.50\t2\t40",
    ].join("\r\n");
    expect(parseSpendCsv(tsv).rows).toEqual([
      { date: "2026-10-11", campaignId: "555", campaignName: "Beylikdüzü", costMicros: 10500000, clicks: 2, impressions: 40 },
    ]);
  });

  it("Kampanya kimliği kolonu yoksa anlaşılır bir hata döner", () => {
    const { rows, errors } = parseSpendCsv("Gün,Kampanya,Maliyet\n2026-10-12,A,10");
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      "CSV'de şu kolonlar bulunamadı: Gün, Kampanya kimliği, Kampanya, Maliyet. Raporu 'Gün' segmentiyle ve 'Kampanya kimliği' kolonuyla indirin.",
    ]);
  });

  it("maliyeti okunamayan satırı atlar ve satır numarasıyla bildirir", () => {
    const { rows, errors } = parseSpendCsv("Gün,Kampanya kimliği,Kampanya,Maliyet\n2026-10-12,555,A,abc\n2026-10-12,556,B,5");
    expect(rows).toHaveLength(1);
    expect(errors).toEqual(["2. satır: maliyet okunamadı (abc)"]);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-csv.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ads/csv"`.

- [ ] **Step 3: Ayrıştırıcıyı yaz**

`apps/panel/lib/ads/csv.ts`:

```ts
import type { SpendRow } from "./types";

const ALIASES = {
  date: ["gün", "day", "date", "tarih"],
  campaignId: ["kampanya kimliği", "campaign id"],
  campaignName: ["kampanya", "campaign"],
  cost: ["maliyet", "cost"],
  clicks: ["tıklamalar", "tıklama", "clicks"],
  impressions: ["gösterimler", "gösterim", "gösterim sayısı", "impr.", "impressions"],
} as const;
type Column = keyof typeof ALIASES;
const REQUIRED: Column[] = ["date", "campaignId", "campaignName", "cost"];
const REQUIRED_LABELS = "Gün, Kampanya kimliği, Kampanya, Maliyet";

/**
 * Ba\u015Fl\u0131\u011F\u0131n iki k\u00FC\u00E7\u00FCk harf bi\u00E7imini d\u00F6ner. T\u00FCrk\u00E7e yerelde "ID" \u2192 "\u0131d" olur ("Campaign ID" e\u015Fle\u015Fmez),
 * T\u00FCrk\u00E7e olmayan k\u00FC\u00E7\u00FCltmede "TIKLAMALAR" \u2192 "tiklamalar" olur; ikisini birden denemek her iki dili yakalar.
 */
function headerVariants(value: string): string[] {
  const trimmed = value.replace(/^\uFEFF/, "").trim();
  return [trimmed.toLocaleLowerCase("tr-TR"), trimmed.toLowerCase()];
}

function detectDelimiter(line: string): string {
  const counts = [",", "\t", ";"].map((d) => [d, line.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** "1.234,56", "1,234.56", "₺75,00" gibi biçimleri sayıya çevirir. Okunamazsa null. */
export function parseLocaleNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(cleaned) ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = /^-?\d{1,3}(\.\d{3})+$/.test(cleaned) ? cleaned.replace(/\./g, "") : cleaned;
  } else {
    normalized = cleaned;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDate(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const tr = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (tr) return `${tr[3]}-${tr[2].padStart(2, "0")}-${tr[1].padStart(2, "0")}`;
  return null;
}

/** Google Ads "Kampanyalar" raporu CSV/TSV dışa aktarımını SpendRow listesine çevirir. */
export function parseSpendCsv(text: string): { rows: SpendRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  let headerIndex = -1;
  let delimiter = ",";
  let columns: Partial<Record<Column, number>> = {};

  for (let i = 0; i < Math.min(lines.length, 10); i += 1) {
    const d = detectDelimiter(lines[i]);
    const headers = splitLine(lines[i], d).map(headerVariants);
    const found: Partial<Record<Column, number>> = {};
    for (const [column, aliases] of Object.entries(ALIASES) as [Column, readonly string[]][]) {
      const index = headers.findIndex((variants) => variants.some((v) => aliases.includes(v)));
      if (index >= 0) found[column] = index;
    }
    if (REQUIRED.every((c) => found[c] !== undefined)) {
      headerIndex = i;
      delimiter = d;
      columns = found;
      break;
    }
  }

  if (headerIndex < 0) {
    return {
      rows: [],
      errors: [`CSV'de şu kolonlar bulunamadı: ${REQUIRED_LABELS}. Raporu 'Gün' segmentiyle ve 'Kampanya kimliği' kolonuyla indirin.`],
    };
  }

  const rows: SpendRow[] = [];
  const errors: string[] = [];
  lines.slice(headerIndex + 1).forEach((line, offset) => {
    const lineNo = headerIndex + offset + 2; // dosyadaki 1 tabanlı satır (boş satırlar hariç)
    const cells = splitLine(line, delimiter);
    const date = parseDate(cells[columns.date!] ?? "");
    if (!date) return; // "Toplam" ve özet satırları
    const campaignId = (cells[columns.campaignId!] ?? "").replace(/\D/g, "");
    if (!campaignId) {
      errors.push(`${lineNo}. satır: kampanya kimliği yok`);
      return;
    }
    const costRaw = cells[columns.cost!] ?? "";
    const cost = parseLocaleNumber(costRaw);
    if (cost == null) {
      errors.push(`${lineNo}. satır: maliyet okunamadı (${costRaw})`);
      return;
    }
    const clicks = columns.clicks !== undefined ? parseLocaleNumber(cells[columns.clicks] ?? "") ?? 0 : 0;
    const impressions = columns.impressions !== undefined ? parseLocaleNumber(cells[columns.impressions] ?? "") ?? 0 : 0;
    rows.push({
      date,
      campaignId,
      campaignName: cells[columns.campaignName!] ?? "",
      costMicros: Math.round(cost * 1_000_000),
      clicks: Math.round(clicks),
      impressions: Math.round(impressions),
    });
  });

  return { rows, errors };
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-csv.test.ts`
Expected: PASS — 14 test (10 `it.each` + 4).

- [ ] **Step 5: Server Action'ı yaz**

`apps/panel/actions/marketing.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@seker/auth/admin";
import { getSessionProfile } from "@/lib/auth";
import { parseSpendCsv } from "@/lib/ads/csv";
import { supabaseAdsStore } from "@/lib/ads/store";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export async function importSpendCsv(
  formData: FormData,
): Promise<{ ok: true; count: number; warnings: string[] } | { ok: false; error: string }> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Bir CSV dosyası seçin" };
  if (file.size > MAX_CSV_BYTES) return { ok: false, error: "Dosya 2 MB'tan büyük olamaz" };

  const buffer = Buffer.from(await file.arrayBuffer());
  // Google Ads "Excel için CSV" dışa aktarımı UTF-16LE gelir (BOM: FF FE).
  const text = buffer[0] === 0xff && buffer[1] === 0xfe ? buffer.toString("utf16le") : buffer.toString("utf8");

  const { rows, errors } = parseSpendCsv(text);
  if (rows.length === 0) return { ok: false, error: errors[0] ?? "Dosyada okunabilir satır yok" };

  await supabaseAdsStore(createAdminSupabase()).upsertSpend(rows);
  revalidatePath("/pazarlama");
  return { ok: true, count: rows.length, warnings: errors.slice(0, 5) };
}
```

- [ ] **Step 6: Tip kontrolü ve commit**

Run: `pnpm --filter @seker/panel exec tsc --noEmit`
Expected: hata yok.

```bash
git add apps/panel/lib/ads/csv.ts apps/panel/actions/marketing.ts apps/panel/tests/unit/ads-csv.test.ts
git commit -m "feat(panel): Google Ads harcama CSV'si içe aktarma"
```

---

### Task 7: Rapor mantığı (`buildMarketingReport`, `normalizeRange`) ve sorgu

**Files:**
- Create: `apps/panel/lib/ads/report.ts`
- Create: `apps/panel/lib/queries/marketing.ts`
- Test: `apps/panel/tests/unit/ads-report.test.ts`

**Interfaces:**
- Consumes: `LEAD_SOURCES`, `label`, `LeadSource`, `LeadStatus` (`@/lib/constants`; Faz 1 `web_sitesi`'yi ekledi), `istanbulDateString` (`@/lib/cron-rules`), `createServerSupabase` (`@/lib/supabase/server`).
- Produces:
  ```ts
  export type ReportLead = { id: string; source: LeadSource; gclid: string | null; utm_campaign: string | null; status: LeadStatus; converted_student_id: string | null };
  export type ReportSpend = { campaign_id: string; campaign_name: string; cost_micros: number };
  export type ReportRow = { key: string; kind: "kampanya" | "kaynak"; label: string; spendKurus: number; leads: number; randevu: number; kayit: number; costPerLeadKurus: number | null; costPerKayitKurus: number | null };
  export type MarketingReport = { rows: ReportRow[]; total: ReportRow };
  export function buildMarketingReport(leads: ReportLead[], appointmentLeadIds: Set<string>, spend: ReportSpend[]): MarketingReport;
  export function normalizeRange(bas: string | undefined, bit: string | undefined, today: string): { from: string; to: string };
  // queries/marketing.ts
  export async function getMarketingData(from: string, to: string): Promise<{ report: MarketingReport; uploads: UploadListItem[] }>;
  export type UploadListItem = { id: string; leadId: string; parentName: string; action: ConversionAction; status: ConversionUploadStatus; error: string | null; conversionAt: string };
  ```

- [ ] **Step 1: Başarısız testi yaz**

`apps/panel/tests/unit/ads-report.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildMarketingReport, normalizeRange, type ReportLead } from "@/lib/ads/report";

function lead(overrides: Partial<ReportLead>): ReportLead {
  return { id: crypto.randomUUID(), source: "reklam", gclid: null, utm_campaign: null, status: "yeni", converted_student_id: null, ...overrides };
}

describe("buildMarketingReport", () => {
  it("reklam adaylarını kampanya ID'siyle eşler, maliyetleri kuruş hesaplar", () => {
    const a1 = lead({ gclid: "g1", utm_campaign: "555", status: "kazanildi" });
    const a2 = lead({ gclid: "g2", utm_campaign: "555", status: "randevu" });
    const report = buildMarketingReport(
      [a1, a2],
      new Set(),
      [
        { campaign_id: "555", campaign_name: "Beylikdüzü", cost_micros: 600_000_000 },
        { campaign_id: "555", campaign_name: "Beylikdüzü", cost_micros: 400_000_000 },
      ],
    );
    expect(report.rows[0]).toEqual({
      key: "kampanya:555", kind: "kampanya", label: "Beylikdüzü",
      spendKurus: 100_000, leads: 2, randevu: 2, kayit: 1,
      costPerLeadKurus: 50_000, costPerKayitKurus: 100_000,
    });
  });

  it("kampanyası bilinmeyen reklam adayını ayrı satırda sayar", () => {
    const report = buildMarketingReport([lead({ gclid: "g", utm_campaign: null }), lead({ gclid: "g", utm_campaign: "999" })], new Set(), []);
    expect(report.rows).toEqual([
      expect.objectContaining({ key: "kampanya:bilinmiyor", label: "Google Ads · kampanya bilinmiyor", leads: 2, spendKurus: 0, costPerLeadKurus: null }),
    ]);
  });

  it("harcaması olup adayı olmayan kampanyayı da gösterir", () => {
    const report = buildMarketingReport([], new Set(), [{ campaign_id: "1", campaign_name: "Kreş 2 yaş", cost_micros: 50_000_000 }]);
    expect(report.rows).toEqual([
      expect.objectContaining({ key: "kampanya:1", leads: 0, spendKurus: 5_000, costPerLeadKurus: null, costPerKayitKurus: null }),
    ]);
  });

  it("reklamsız kaynakları kaynak etiketiyle gruplar; randevu kaydı olan adayı randevu sayar", () => {
    const withAppt = lead({ source: "instagram", status: "ulasildi" });
    const report = buildMarketingReport(
      [withAppt, lead({ source: "instagram" }), lead({ source: "referans", converted_student_id: "s1", status: "kazanildi" })],
      new Set([withAppt.id]),
      [],
    );
    expect(report.rows.map((r) => [r.key, r.label, r.leads, r.randevu, r.kayit])).toEqual([
      ["kaynak:instagram", "Instagram", 2, 1, 0],
      ["kaynak:referans", "Referans", 1, 1, 1],
    ]);
  });

  it("kampanyalar harcamaya, kaynaklar aday sayısına göre sıralanır; toplam satırı doğru", () => {
    const report = buildMarketingReport(
      [lead({ gclid: "g", utm_campaign: "1" }), lead({ source: "telefon" }), lead({ source: "referans" }), lead({ source: "referans" })],
      new Set(),
      [
        { campaign_id: "1", campaign_name: "Küçük", cost_micros: 10_000_000 },
        { campaign_id: "2", campaign_name: "Büyük", cost_micros: 90_000_000 },
      ],
    );
    expect(report.rows.map((r) => r.key)).toEqual(["kampanya:2", "kampanya:1", "kaynak:referans", "kaynak:telefon"]);
    expect(report.total).toEqual(expect.objectContaining({ label: "Toplam", spendKurus: 10_000, leads: 4, costPerLeadKurus: 2_500 }));
  });
});

describe("normalizeRange", () => {
  it("parametre yoksa son 30 günü döner", () => {
    expect(normalizeRange(undefined, undefined, "2026-10-14")).toEqual({ from: "2026-09-15", to: "2026-10-14" });
  });
  it("ters verilen aralığı düzeltir", () => {
    expect(normalizeRange("2026-10-10", "2026-10-01", "2026-10-14")).toEqual({ from: "2026-10-01", to: "2026-10-10" });
  });
  it("bozuk tarihte varsayılana döner", () => {
    expect(normalizeRange("dün", "2026-10-10", "2026-10-14")).toEqual({ from: "2026-09-15", to: "2026-10-14" });
  });
  it("366 günden uzun aralığı başlangıçtan kırpar", () => {
    expect(normalizeRange("2024-01-01", "2026-10-14", "2026-10-14")).toEqual({ from: "2025-10-14", to: "2026-10-14" });
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-report.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ads/report"`.

- [ ] **Step 3: `report.ts` yaz**

`apps/panel/lib/ads/report.ts`:

```ts
import { LEAD_SOURCES, label, type LeadSource, type LeadStatus } from "@/lib/constants";

export interface ReportLead {
  id: string;
  source: LeadSource;
  gclid: string | null;
  utm_campaign: string | null;
  status: LeadStatus;
  converted_student_id: string | null;
}

export interface ReportSpend {
  campaign_id: string;
  campaign_name: string;
  cost_micros: number;
}

export interface ReportRow {
  key: string;
  kind: "kampanya" | "kaynak";
  label: string;
  spendKurus: number;
  leads: number;
  randevu: number;
  kayit: number;
  costPerLeadKurus: number | null;
  costPerKayitKurus: number | null;
}

export interface MarketingReport {
  rows: ReportRow[];
  total: ReportRow;
}

const UNKNOWN_CAMPAIGN = "kampanya:bilinmiyor";
const REACHED_RANDEVU: LeadStatus[] = ["randevu", "gorusme_yapildi", "teklif", "kazanildi"];
const MICROS_PER_KURUS = 10_000;
const DAY_MS = 86400000;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 29;

function emptyRow(key: string, kind: ReportRow["kind"], rowLabel: string): ReportRow {
  return { key, kind, label: rowLabel, spendKurus: 0, leads: 0, randevu: 0, kayit: 0, costPerLeadKurus: null, costPerKayitKurus: null };
}

function withCosts(row: ReportRow): ReportRow {
  return {
    ...row,
    costPerLeadKurus: row.spendKurus > 0 && row.leads > 0 ? Math.round(row.spendKurus / row.leads) : null,
    costPerKayitKurus: row.spendKurus > 0 && row.kayit > 0 ? Math.round(row.spendKurus / row.kayit) : null,
  };
}

/** Kampanya + kaynak bazında harcama → aday → randevu → kayıt tablosu. */
export function buildMarketingReport(
  leads: ReportLead[],
  appointmentLeadIds: Set<string>,
  spend: ReportSpend[],
): MarketingReport {
  const rows = new Map<string, ReportRow>();
  const campaignNames = new Map<string, string>();

  for (const s of spend) {
    const key = `kampanya:${s.campaign_id}`;
    campaignNames.set(s.campaign_id, s.campaign_name);
    const row = rows.get(key) ?? emptyRow(key, "kampanya", s.campaign_name);
    row.spendKurus += Math.round(Number(s.cost_micros) / MICROS_PER_KURUS);
    rows.set(key, row);
  }

  for (const lead of leads) {
    const isAd = Boolean(lead.gclid) || lead.source === "reklam";
    let key: string;
    if (isAd) {
      const campaign = lead.utm_campaign?.trim() ?? "";
      key = campaign && campaignNames.has(campaign) ? `kampanya:${campaign}` : UNKNOWN_CAMPAIGN;
    } else {
      key = `kaynak:${lead.source}`;
    }
    const row =
      rows.get(key) ??
      (key === UNKNOWN_CAMPAIGN
        ? emptyRow(key, "kampanya", "Google Ads · kampanya bilinmiyor")
        : emptyRow(key, "kaynak", label(LEAD_SOURCES, lead.source)));
    row.leads += 1;
    if (appointmentLeadIds.has(lead.id) || REACHED_RANDEVU.includes(lead.status)) row.randevu += 1;
    if (lead.status === "kazanildi" || lead.converted_student_id) row.kayit += 1;
    rows.set(key, row);
  }

  const all = [...rows.values()].map(withCosts);
  const campaigns = all.filter((r) => r.kind === "kampanya").sort((a, b) => b.spendKurus - a.spendKurus || b.leads - a.leads);
  const sources = all.filter((r) => r.kind === "kaynak").sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label, "tr"));

  const total = withCosts(
    all.reduce(
      (acc, r) => ({
        ...acc,
        spendKurus: acc.spendKurus + r.spendKurus,
        leads: acc.leads + r.leads,
        randevu: acc.randevu + r.randevu,
        kayit: acc.kayit + r.kayit,
      }),
      emptyRow("toplam", "kaynak", "Toplam"),
    ),
  );

  return { rows: [...campaigns, ...sources], total };
}

function addDays(ymd: string, days: number): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function isYmd(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

/** URL'deki ?bas=&bit= değerlerini güvenli bir tarih aralığına çevirir. */
export function normalizeRange(bas: string | undefined, bit: string | undefined, today: string): { from: string; to: string } {
  if (!isYmd(bas) || !isYmd(bit)) return { from: addDays(today, -DEFAULT_RANGE_DAYS), to: today };
  let [from, to] = bas <= bit ? [bas, bit] : [bit, bas];
  if (addDays(from, MAX_RANGE_DAYS - 1) < to) from = addDays(to, -(MAX_RANGE_DAYS - 1));
  return { from, to };
}
```

> Kontrol: `normalizeRange("2024-01-01","2026-10-14")` → `from = addDays("2026-10-14", -365) = "2025-10-14"`. Testle aynı.

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/ads-report.test.ts`
Expected: PASS — 9 test.

- [ ] **Step 5: Sorgu katmanını yaz**

`apps/panel/lib/queries/marketing.ts`:

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { ConversionAction, ConversionUploadStatus } from "@/lib/constants";
import { buildMarketingReport, type MarketingReport, type ReportLead, type ReportSpend } from "@/lib/ads/report";

export interface UploadListItem {
  id: string;
  leadId: string;
  parentName: string;
  action: ConversionAction;
  status: ConversionUploadStatus;
  error: string | null;
  conversionAt: string;
}

/** YYYY-MM-DD gününün İstanbul'daki başlangıcı (UTC ISO). */
function istanbulDayStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+03:00`).toISOString();
}

function nextDay(ymd: string): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
}

export async function getMarketingData(
  from: string,
  to: string,
): Promise<{ report: MarketingReport; uploads: UploadListItem[] }> {
  const supabase = await createServerSupabase();

  const [leadsResult, spendResult, uploadsResult] = await Promise.all([
    supabase
      .from("leads")
      .select("id, source, gclid, utm_campaign, status, converted_student_id")
      .gte("created_at", istanbulDayStartIso(from))
      .lt("created_at", istanbulDayStartIso(nextDay(to))),
    supabase.from("ad_spend_daily").select("campaign_id, campaign_name, cost_micros").gte("date", from).lte("date", to),
    supabase
      .from("conversion_uploads")
      .select("id, lead_id, conversion_action, status, error, conversion_at, lead:leads(parent_name)")
      .order("conversion_at", { ascending: false })
      .limit(50),
  ]);

  if (leadsResult.error) throw new Error(leadsResult.error.message);
  if (spendResult.error) throw new Error(spendResult.error.message);

  const leads = (leadsResult.data ?? []) as ReportLead[];
  const ids = leads.map((l) => l.id);
  const { data: appointments } = ids.length
    ? await supabase.from("appointments").select("lead_id").in("lead_id", ids)
    : { data: [] as { lead_id: string }[] };

  const report = buildMarketingReport(
    leads,
    new Set((appointments ?? []).map((a) => a.lead_id as string)),
    (spendResult.data ?? []) as ReportSpend[],
  );

  type UploadRow = {
    id: string; lead_id: string; conversion_action: ConversionAction; status: ConversionUploadStatus;
    error: string | null; conversion_at: string; lead: { parent_name: string } | { parent_name: string }[] | null;
  };
  const uploads = ((uploadsResult.data ?? []) as unknown as UploadRow[]).map((row) => {
    const lead = Array.isArray(row.lead) ? row.lead[0] : row.lead;
    return {
      id: row.id,
      leadId: row.lead_id,
      parentName: lead?.parent_name ?? "—",
      action: row.conversion_action,
      status: row.status,
      error: row.error,
      conversionAt: row.conversion_at,
    };
  });

  return { report, uploads };
}
```

- [ ] **Step 6: Tip kontrolü ve commit**

Run: `pnpm --filter @seker/panel exec tsc --noEmit`
Expected: hata yok.

```bash
git add apps/panel/lib/ads/report.ts apps/panel/lib/queries/marketing.ts apps/panel/tests/unit/ads-report.test.ts
git commit -m "feat(panel): pazarlama hunisi rapor mantığı ve sorgusu"
```

---

### Task 8: `/pazarlama` ekranı, menü ve "Tekrar dene"

**Files:**
- Create: `apps/panel/app/(app)/pazarlama/page.tsx`
- Create: `apps/panel/components/marketing-table.tsx`
- Create: `apps/panel/components/conversion-upload-list.tsx`
- Create: `apps/panel/components/spend-csv-form.tsx`
- Modify: `apps/panel/actions/marketing.ts` (`retryConversionUpload` ekle)
- Modify: `apps/panel/components/nav.tsx`

**Interfaces:**
- Consumes: `getMarketingData`, `normalizeRange`, `importSpendCsv`, `formatTRY` (`@/lib/money`), `CONVERSION_ACTIONS`, `CONVERSION_UPLOAD_STATUSES`, `istanbulDateString`.
- Produces: `export async function retryConversionUpload(id: string): Promise<{ ok: true } | { ok: false; error: string }>;` (yalnızca `status='hata'` satırı `bekliyor`'a döner). Rota `/pazarlama?bas=YYYY-MM-DD&bit=YYYY-MM-DD`.

- [ ] **Step 1: `retryConversionUpload`'ı ekle**

`apps/panel/actions/marketing.ts` sonuna:

```ts
export async function retryConversionUpload(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir" };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Geçersiz kayıt" };

  const { data, error } = await createAdminSupabase()
    .from("conversion_uploads")
    .update({ status: "bekliyor", error: null })
    .eq("id", id)
    .eq("status", "hata")
    .select("id");
  if (error) return { ok: false, error: "Kayıt güncellenemedi" };
  if (!data?.length) return { ok: false, error: "Yalnızca hatalı kayıtlar tekrar denenebilir" };

  revalidatePath("/pazarlama");
  return { ok: true };
}
```

- [ ] **Step 2: Tablo bileşenini yaz**

`apps/panel/components/marketing-table.tsx`:

```tsx
import { formatTRY } from "@/lib/money";
import type { MarketingReport, ReportRow } from "@/lib/ads/report";

function money(kurus: number | null) {
  return kurus == null ? "—" : formatTRY(kurus);
}

function Row({ row, strong = false }: { row: ReportRow; strong?: boolean }) {
  const cell = "px-3 py-3 text-right tabular-nums";
  return (
    <tr className={strong ? "border-t-2 border-border font-semibold" : "border-t border-border"}>
      <th scope="row" className="px-3 py-3 text-left font-medium text-foreground">
        {row.label}
        {row.kind === "kampanya" && !strong ? (
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Google Ads</span>
        ) : null}
      </th>
      <td className={cell}>{row.spendKurus > 0 ? formatTRY(row.spendKurus) : "—"}</td>
      <td className={cell}>{row.leads}</td>
      <td className={cell}>{row.randevu}</td>
      <td className={cell}>{row.kayit}</td>
      <td className={cell}>{money(row.costPerLeadKurus)}</td>
      <td className={cell}>{money(row.costPerKayitKurus)}</td>
    </tr>
  );
}

export function MarketingTable({ report }: { report: MarketingReport }) {
  if (report.rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
        Bu tarih aralığında aday veya reklam harcaması yok.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">Kampanya / kaynak</th>
            <th scope="col" className="px-3 py-2 text-right">Harcama</th>
            <th scope="col" className="px-3 py-2 text-right">Aday</th>
            <th scope="col" className="px-3 py-2 text-right">Randevu</th>
            <th scope="col" className="px-3 py-2 text-right">Kayıt</th>
            <th scope="col" className="px-3 py-2 text-right">Aday başı</th>
            <th scope="col" className="px-3 py-2 text-right">Kayıt başı</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <Row key={row.key} row={row} />
          ))}
          <Row row={report.total} strong />
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Dönüşüm listesi ve CSV formu (client) yaz**

`apps/panel/components/conversion-upload-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { retryConversionUpload } from "@/actions/marketing";
import { CONVERSION_ACTIONS, CONVERSION_UPLOAD_STATUSES, label } from "@/lib/constants";
import type { UploadListItem } from "@/lib/queries/marketing";

const STATUS_CLASS: Record<string, string> = {
  bekliyor: "bg-amber-50 text-amber-800 ring-amber-200",
  gonderildi: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  hata: "bg-red-50 text-red-700 ring-red-200",
  atlandi: "bg-muted text-muted-foreground ring-border",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

export function ConversionUploadList({ uploads }: { uploads: UploadListItem[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (uploads.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz Google'a bildirilecek bir randevu veya kayıt yok.</p>;
  }

  return (
    <div className="space-y-3">
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {uploads.map((u) => (
          <li key={u.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href={`/leads/${u.leadId}`} className="font-semibold text-foreground hover:underline">{u.parentName}</Link>
              <p className="text-sm text-muted-foreground">
                {label(CONVERSION_ACTIONS, u.action)} · {dateFormatter.format(new Date(u.conversionAt))}
                {u.error ? <span className="block break-words text-red-700">{u.error}</span> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_CLASS[u.status]}`}>
                {label(CONVERSION_UPLOAD_STATUSES, u.status)}
              </span>
              {u.status === "hata" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await retryConversionUpload(u.id);
                      setMessage(result.ok ? "Yarın sabahki senkronda tekrar gönderilecek." : result.error);
                    })
                  }
                  className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-60"
                >
                  Tekrar dene
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`apps/panel/components/spend-csv-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { importSpendCsv } from "@/actions/marketing";

export function SpendCsvForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await importSpendCsv(formData);
          setMessage(
            result.ok
              ? `${result.count} satır harcama içeri alındı.${result.warnings.length ? ` Atlanan: ${result.warnings.join("; ")}` : ""}`
              : result.error,
          );
        });
      }}
    >
      <label htmlFor="spend-csv" className="text-sm font-medium text-foreground">Harcama CSV'si</label>
      <input id="spend-csv" name="file" type="file" accept=".csv,.tsv,text/csv" required className="text-sm" />
      <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Yükleniyor…" : "Yükle"}
      </button>
      {message ? <p role="status" className="text-sm text-muted-foreground sm:ml-2">{message}</p> : null}
    </form>
  );
}
```

> `bg-primary` / `text-primary-foreground` panelde tanımlı değilse, uygulamacı `components/` altındaki mevcut birincil düğme sınıfını (`grep -rn "bg-primary\|bg-brand" apps/panel/components | head`) kullanır.

- [ ] **Step 4: Sayfayı yaz**

`apps/panel/app/(app)/pazarlama/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { istanbulDateString } from "@/lib/cron-rules";
import { normalizeRange } from "@/lib/ads/report";
import { readAdsConfig } from "@/lib/ads/config";
import { getMarketingData } from "@/lib/queries/marketing";
import { MarketingTable } from "@/components/marketing-table";
import { ConversionUploadList } from "@/components/conversion-upload-list";
import { SpendCsvForm } from "@/components/spend-csv-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PazarlamaPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") redirect("/pipeline");

  const params = await searchParams;
  const { from, to } = normalizeRange(first(params.bas), first(params.bit), istanbulDateString());
  const { report, uploads } = await getMarketingData(from, to);
  const adsConnected = readAdsConfig() !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Pazarlama</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hangi reklam ve kaynak kaç aday, randevu ve kayıt getirdi. Harcama her sabah 06:00'da güncellenir.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-sm">
            <span className="block text-muted-foreground">Başlangıç</span>
            <input type="date" name="bas" defaultValue={from} className="min-h-11 rounded-xl border border-border px-3" />
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">Bitiş</span>
            <input type="date" name="bit" defaultValue={to} className="min-h-11 rounded-xl border border-border px-3" />
          </label>
          <button type="submit" className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Göster</button>
        </form>
      </div>

      {!adsConnected ? (
        <p className="rounded-2xl border border-amber-200 bg-warning-soft p-4 text-sm text-foreground">
          Google Ads bağlantısı henüz kurulmadı. Harcamayı aşağıdan CSV ile yükleyebilirsiniz; adaylar ve kayıtlar yine sayılır.
        </p>
      ) : null}

      <MarketingTable report={report} />

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Google'a bildirilen randevu ve kayıtlar</h2>
        <p className="text-sm text-muted-foreground">
          Reklamdan gelen bir veli randevuya veya kayda dönünce Google'a bildirilir. Böylece Google kayıt olan veliye benzeyenleri bulmayı öğrenir.
        </p>
        <ConversionUploadList uploads={uploads} />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Harcamayı elle yükle</h2>
        <p className="text-sm text-muted-foreground">
          Google Ads → Raporlar → Kampanyalar; "Gün" segmenti ve Gün, Kampanya kimliği, Kampanya, Maliyet, Tıklamalar, Gösterimler kolonlarıyla CSV indirin.
          Aynı gün tekrar yüklenirse üzerine yazılır.
        </p>
        <SpendCsvForm />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Menüye ekle**

`apps/panel/components/nav.tsx`:
- `lucide-react` importuna `Megaphone,` ekle (alfabetik sırada `LogOut`'tan sonra).
- `profileLinks` dizisinde `/teklifler` satırından sonra:

```tsx
  { href: "/pazarlama", label: "Pazarlama", icon: Megaphone, roles: ["yonetici"] },
```

- [ ] **Step 6: Elle doğrula**

Run: `pnpm --filter @seker/panel exec tsc --noEmit` → hata yok.
Run: `pnpm --filter @seker/panel exec vitest run tests/unit` → tüm birim testleri PASS.
Run: `pnpm --filter @seker/panel dev`, yönetici hesabıyla gir, `/pazarlama`'yı aç.
Expected:
- Menüde "Pazarlama" var; danışman hesabında yok ve `/pazarlama` adresi `/pipeline`'a yönlendirir.
- Task 6 testindeki Türkçe CSV'yi dosya olarak yükle → "2 satır harcama içeri alındı." ve tabloda "Beylikdüzü" 1.234,56 ₺ ile görünür.
- `?bas=2026-10-12&bit=2026-10-12` ile yalnızca o günün harcaması görünür.
- Admin ile bir `conversion_uploads` satırını `status='hata', error='test'` yap → listede "Hata" ve "Tekrar dene" görünür; basınca satır "Bekliyor" olur.
- Telefon genişliğinde (390 px) tablo yatay kayar, sayfa kaymaz.

- [ ] **Step 7: Commit**

```bash
git add "apps/panel/app/(app)/pazarlama/page.tsx" apps/panel/components/marketing-table.tsx apps/panel/components/conversion-upload-list.tsx apps/panel/components/spend-csv-form.tsx apps/panel/actions/marketing.ts apps/panel/components/nav.tsx
git commit -m "feat(panel): Pazarlama ekranı, dönüşüm durum listesi ve CSV yükleme"
```

---

### Task 9: Canlı doğrulama (token ve env hazır olunca)

**Files:**
- Create: `apps/panel/scripts/ads/check.ts`
- Modify: `apps/panel/package.json` (script)

**Interfaces:**
- Consumes: `readAdsConfig`, `getAccessToken`, `fetchCampaignSpend`, `istanbulDaysAgo`. Data Manager için `validateOnly: true` ile kendi isteğini atar (veri yazmaz).

- [ ] **Step 1: Kontrol betiğini yaz**

`apps/panel/scripts/ads/check.ts`:

```ts
import "dotenv/config";
import { readAdsConfig } from "../../lib/ads/config";
import { getAccessToken, fetchCampaignSpend } from "../../lib/ads/googleAds";
import { istanbulDaysAgo } from "../../lib/ads/sync";

async function main() {
  const cfg = readAdsConfig();
  if (!cfg) throw new Error("GOOGLE_ADS_* değişkenlerinden biri eksik");

  const token = await getAccessToken(cfg);
  console.log("1/3 OAuth: tamam");

  const rows = await fetchCampaignSpend(cfg, token, istanbulDaysAgo(7), istanbulDaysAgo(1));
  console.log(`2/3 Harcama: son 7 günde ${rows.length} kampanya-gün satırı`);

  const response = await fetch("https://datamanager.googleapis.com/v1/events:ingest", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      destinations: [
        {
          operatingAccount: { accountType: "GOOGLE_ADS", accountId: cfg.customerId },
          loginAccount: { accountType: "GOOGLE_ADS", accountId: cfg.loginCustomerId ?? cfg.customerId },
          productDestinationId: cfg.conversionActionIds.randevu,
        },
      ],
      events: [
        {
          adIdentifiers: { gclid: "TeSter-123-check" },
          eventTimestamp: new Date().toISOString().slice(0, 19) + "+00:00",
          transactionId: "check:validate-only",
          eventSource: "WEB",
        },
      ],
      validateOnly: true,
    }),
  });
  console.log(`3/3 Data Manager (validateOnly): HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
}

main().catch((error) => {
  console.error("HATA:", (error as Error).message);
  process.exit(1);
});
```

`apps/panel/package.json` `scripts` içine:

```json
    "ads:check": "tsx scripts/ads/check.ts"
```

- [ ] **Step 2: Sunucuda çalıştır**

Run (sunucuda): `docker compose -f /opt/seker/docker-compose.yml exec panel node --version` ile konteynerin ayakta olduğunu gör; ardından yerelde, prod env değerleri `apps/panel/.env` dosyasındayken:
`pnpm --filter @seker/panel ads:check`
Expected:
```
1/3 OAuth: tamam
2/3 Harcama: son 7 günde N kampanya-gün satırı
3/3 Data Manager (validateOnly): HTTP 200 …
```
3. adımda HTTP 400 ve mesaj "gclid" ile ilgiliyse (sahte gclid) bağlantı ve yetki doğrudur. 401/403 ise Task 0'daki scope'ları, "In production" durumunu ve Data Manager API'nin etkin olduğunu kontrol et.

- [ ] **Step 3: Cron'u bir kez elle tetikle**

Run (sunucuda): `docker compose -f /opt/seker/docker-compose.yml exec cron sh -c 'curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://panel:3000/api/cron/ads'`
Expected: `{"ok":true,"spendRows":N,"sent":0,"failed":0,"skipped":0}` (N ≥ 0). Panel → Pazarlama tablosunda dünün harcaması görünür.

- [ ] **Step 4: Uçtan uca dönüşüm**

Gerçek bir reklam tıklamasıyla sitede form doldurulmuş bir test adayını panelde "Randevu"ya al. Ertesi sabah (veya cron'u elle tetikleyerek) `/pazarlama` listesinde satır "Gönderildi" olmalı. Google Ads'te "Panel · Randevu" dönüşümü 24–48 saat içinde görünür (Google'ın işleme süresi).

- [ ] **Step 5: Commit**

```bash
git add apps/panel/scripts/ads/check.ts apps/panel/package.json
git commit -m "chore(panel): Google Ads bağlantı kontrol betiği"
```

---

## Self-review notları

- **Spec kapsamı:** harcama çekme (Task 3–5), offline dönüşüm randevu+kayıt (Task 1, 3–5), huni raporu kampanya + reklamsız kaynaklar (Task 7–8), yöneticiye hata bildirimi (Task 5), developer token beklerken CSV (Task 6), erken başvuru (Task 0). Kampanya oluşturma/bütçe değiştirme bilinçli olarak kapsam dışı (spec).
- **Tip tutarlılığı:** `SpendRow`, `PendingConversion`, `UploadOutcome`, `AdsStore`, `AdsConfig`, `ReportRow`, `UploadListItem` tek yerde tanımlı ve aynı adlarla kullanılıyor. `importSpendCsv` dönüşüne `warnings` eklendi; Task 8 formu bunu kullanıyor.
- **Faz 1'e bağımlılıklar:** `leads.utm_campaign`, `leads.gclid`, `leads.consent_at`. Onay: `consent_at` doluysa `CONSENT_GRANTED` gönderilir (formdaki zorunlu KVKK onayı; sahip kararı 2026-10-14). `PendingConversion.adUserData` tipindeki `"denied"` dalı ileride çerez onayı taşınırsa diye korunur.
```
