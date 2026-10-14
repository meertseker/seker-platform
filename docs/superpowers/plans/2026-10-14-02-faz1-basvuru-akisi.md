# Faz 1: Başvuru Akışı (Site Formu → CRM) Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sitedeki her ön görüşme formu, kaynağıyla (gclid, UTM, iniş sayfası) birlikte doğrudan paneldeki `leads` tablosuna düşsün. Aynı veli iki kez kart açtırmasın, yönetici anında bildirim alsın, sitedeki eski `/admin` ve ayrı başvuru veritabanı kalksın.

**Architecture:** Tek giriş noktası Postgres'teki `public.create_web_lead(...)` fonksiyonu (`security definer`, yalnızca `service_role` çalıştırabilir). Site, `/api/lead` route'unda formu zod ile doğrular, telefonu E.164'e çevirir, `@seker/auth`'un `createAdminSupabase()` istemcisiyle bu fonksiyonu çağırır, sonra Resend ile e-posta atar. Tekrar başvuru tespiti, kaynak belirleme, atama ve bildirim veritabanında tek transaction içinde yapılır; panel sadece yeni kaynak değerini ve bildirimi gösterir.

**Tech Stack:** Next.js 16 (App Router route handler), zod 4, `@supabase/supabase-js` (`@seker/auth` üzerinden), Postgres plpgsql, Supabase CLI (lokal), Vitest 4, Resend, tsx (tek seferlik aktarım betiği).

**Spec:** `docs/superpowers/specs/2026-10-14-seker-platform-design.html` (bölümler: "Bir veli formu doldurduğunda", "Teknik akışlar → 1 · Başvuru akışı", "Güvenlik ve KVKK"). Ortak isimler: `docs/superpowers/plans/2026-10-14-00-seker-platform-index.md`.

**Ön koşul:** Faz 0 tamamlandı. Monorepo `C:\Users\meert\Desktop\seker-platform`; `apps/web` (eski `react-kindergarten-site`), `apps/panel` (eski `anaokulcrm`), `packages/db/supabase/migrations/0001…0005`, `@seker/auth` (`createAdminSupabase`), `@seker/shared` (`normalizeTurkishPhone`) mevcut. Lokal Supabase Docker'da çalışıyor (`apps/panel/.env.local` → `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`). `apps/panel/tests/rls/helpers.ts` Faz 0'da yeni anahtar adlarına geçirildi ve `clientFor(email)` ile `admin` dışa aktarıyor.

## Global Constraints

- Dil: tüm UI ve kullanıcıya dönen hata metinleri Türkçe. Kod tanımlayıcıları İngilizce. Domain enum değerleri Türkçe string, `text + CHECK` (native enum değil).
- Panelde enum değerleri ve etiketleri YALNIZCA `apps/panel/lib/constants.ts`'te tanımlanır.
- Telefon: E.164 `+905XXXXXXXXX`. Tek normalizasyon fonksiyonu `normalizeTurkishPhone` (`@seker/shared`). Sabit hat kabul edilmez.
- Saat dilimi `Europe/Istanbul`; DB'de `timestamptz`.
- `events` tablosu append-only: fonksiyon yalnızca INSERT yapar.
- Şema değişikliği yalnızca `packages/db/supabase/migrations/0006_web_leads.sql` ile. Dashboard'dan elle değişiklik yasak.
- Supabase anahtarları yalnızca yeni biçim (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`). `anon`/`service_role` anahtar adları kodda geçmez.
- `SUPABASE_SECRET_KEY` yalnızca sunucu kodunda (`app/api/**`, `lib/websiteLeads.ts`). Hiçbir `'use client'` dosyası `@seker/auth`'u import etmez.
- Kişisel veri (ad, telefon) sunucu loglarına yazılmaz. Loglarda yalnızca hata kodu ve lead id.
- Kayıt önce, e-posta sonra. E-posta hatası başvuruyu kaybettirmez; veritabanı hatası da e-posta giderse başvuruyu kaybettirmez.
- Faz kapsamındaki `source` değeri: `'web_sitesi'`; `gclid` varsa `'reklam'`.
- Commit: her görev sonunda en az bir commit, Conventional Commits (`feat(db): …`, `feat(web): …`, `feat(panel): …`).

## Review Focus

Spec'in ima ettiği ama tek tek görev testlerinin kendiliğinden yakalamayacağı, gerçek veliyi en çok etkileyecek beş durum:

1. **Telefon biçimleri:** `0530 101 88 75`, `+90 530 101 88 75`, `0090530…`, `(0530) 101-88-75` aynı veli sayılmalı (`+905301018875`); `0212 222 33 44` gibi sabit hat Türkçe bir alan hatasıyla reddedilmeli, 500 dönmemeli. → Task 4 testleri.
2. **Çift gönderim / sayfa yenileme:** Aynı telefonla 10 dakika içinde gelen ikinci başvuru yeni kart açmamalı ve ikinci bildirim üretmemeli; olay kaydı (event) yine düşmeli. → Task 1 testi.
3. **Çok uzun gizli alanlar:** 1.000 karakterlik `utm_campaign` veya 300 karakterlik `gclid` başvuruyu reddettirmemeli, 200 karaktere kırpılmalı. → Task 1 ve Task 4 testleri.
4. **Supabase erişilemez:** Fonksiyon hata verirse veli "Talebiniz alındı" görmeli ve yönetici e-postayla "panele kaydedilemedi" uyarılı başvuruyu almalı; ikisi birden başarısızsa 500 ve telefonla ulaşma mesajı. → Task 6 testleri.
5. **Kapanmış lead ile aynı telefon:** Daha önce `kaybedildi` veya `kazanildi` olmuş bir velinin yeni başvurusu kapalı karta eklenmemeli (dönüştürülmüş lead kilidine takılmamalı), yeni kart açılmalı. → Task 1 testi.

Ek: Faz 0'dan önce açılmış tarayıcı oturumunda `sessionStorage`'da eski biçimli (utm'siz) kayıt bulunması çökmeye yol açmamalı. → Task 3 testi.

---

## Dosya Yapısı

| Dosya | Durum | Sorumluluk |
|---|---|---|
| `packages/db/supabase/migrations/0006_web_leads.sql` | Oluştur | `leads` kolonları, `leads_source_check`, `app_settings.web_lead_assignee`, `create_web_lead` fonksiyonu ve yetkileri |
| `packages/db/src/database.types.ts` | Yeniden üret | Yeni kolon ve fonksiyon tipleri |
| `apps/panel/tests/rls/web-leads.test.ts` | Oluştur | Fonksiyonun yetki ve davranış testleri (lokal Supabase) |
| `apps/panel/lib/constants.ts` | Değiştir | `web_sitesi` kaynağı, `web_basvuru`/`web_tekrar_basvuru` olay etiketleri |
| `apps/panel/actions/notifications.ts` | Değiştir | `NotificationType`'a `web_basvuru` |
| `apps/panel/lib/notification-text.ts` | Oluştur | Bildirim metni (bell bileşeninden çıkarılır, test edilebilir olur) |
| `apps/panel/components/notification-bell.tsx` | Değiştir | `notificationText`'i lib'den alır |
| `apps/panel/lib/lead-attribution.ts` | Oluştur | Lead detayında gösterilecek web kaynağı satırları |
| `apps/panel/app/(app)/leads/[id]/page.tsx` | Değiştir | Yeni kolonları seçer, "Web kaynağı" bloğunu gösterir |
| `apps/panel/tests/unit/notification-text.test.ts`, `lead-attribution.test.ts` | Oluştur | Birim testleri |
| `apps/web/lib/attribution.ts` | Değiştir | UTM yakalama, ilk dokunuş kuralı |
| `apps/web/app/components/AttributionFields.tsx` | Değiştir | UTM gizli alanları |
| `apps/web/lib/leadSchema.ts` | Değiştir | Telefon normalizasyonu, utm, honeypot, kırpma |
| `apps/web/app/components/LeadForm.tsx` | Değiştir | utm ve honeypot alanlarını gönderir |
| `apps/web/lib/rateLimit.ts` | Oluştur | Bellek içi IP başına sınır |
| `apps/web/lib/websiteLeads.ts` | Yeniden yaz | `createWebLead()` → `create_web_lead` RPC |
| `apps/web/lib/leadEmail.ts` | Oluştur | Resend e-postası, asla throw etmez |
| `apps/web/app/api/lead/route.ts` | Yeniden yaz | Sınır → doğrulama → honeypot → kayıt → e-posta |
| `apps/web/app/api/lead/__tests__/*.test.ts`, `apps/web/lib/__tests__/*.test.ts` | Değiştir/Oluştur | Testler |
| `apps/web/app/admin/**`, `apps/web/app/api/admin/**`, `apps/web/lib/adminAuth.ts`, `apps/web/lib/__tests__/adminAuth.test.ts`, `apps/web/lib/supabase.ts` | Sil | Eski admin ve REST istemcisi |
| `apps/web/next.config.ts` | Değiştir | `/admin` → panel yönlendirmesi |
| `apps/web/.env.example` | Değiştir | Yeni değişken adları |
| `apps/panel/scripts/seed/import-old-web-leads.ts` | Oluştur | Eski başvuru veritabanından tek seferlik aktarım |
| `apps/panel/tests/seed/import-old-web-leads.test.ts` | Oluştur | Aktarım satır dönüştürme testleri |

---

### Task 1: Veritabanı: `0006_web_leads.sql` ve `create_web_lead`

**Files:**
- Create: `packages/db/supabase/migrations/0006_web_leads.sql`
- Create: `apps/panel/tests/rls/web-leads.test.ts`
- Regenerate: `packages/db/src/database.types.ts`

**Interfaces:**
- Consumes: mevcut `public.leads`, `public.events`, `public.notifications`, `public.profiles`, `public.app_settings` (0001–0005). Gerçek CHECK adı `leads_source_check` (0003'te yeniden tanımlandı).
- Produces:
  - `leads` kolonları: `gclid text`, `utm_source text`, `utm_medium text`, `utm_campaign text`, `utm_term text`, `utm_content text`, `landing_path text`, `consent_at timestamptz`, `web_payload jsonb`.
  - `public.create_web_lead(p_parent_name text, p_phone text, p_gclid text, p_utm jsonb, p_landing_path text, p_consent_at timestamptz, p_meta jsonb default '{}') returns jsonb` → `{ "lead_id": uuid, "duplicate": boolean }`. İlk altı parametre indeks sözleşmesindeki imza; `p_meta` varsayılanlı yedinci parametre (aktarım betiği için: `{"silent": true, "old_web_lead_id": "…"}`), normal çağrı onu hiç göndermez.
  - `events.event_type`: `web_basvuru`, `web_tekrar_basvuru` (`entity_type='lead'`, `actor_id=null`, payload = `web_payload`).
  - `notifications.type = 'web_basvuru'`, payload `{ leadId, parentName, source, landingPath, duplicate }`.
  - `app_settings` anahtarı `web_lead_assignee` (jsonb string: `""` = atanmamış, ya da profil uuid; `value` kolonu NOT NULL olduğu için JSON null kullanılmaz).

- [ ] **Step 1: Failing testi yaz**

`apps/panel/tests/rls/web-leads.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const YON_ID = "00000000-0000-0000-0000-000000000001";
const DAN_ID = "00000000-0000-0000-0000-000000000002";

// Her test kendi numarasını kullanır; temizlik bu önekle yapılır.
const PREFIX = "+90500777";
let seq = 0;
const nextPhone = () => `${PREFIX}${String(++seq).padStart(4, "0")}`;

function args(over: Record<string, unknown> = {}) {
  return {
    p_parent_name: "Web Test Veli",
    p_phone: nextPhone(),
    p_gclid: "",
    p_utm: {},
    p_landing_path: "/kayit",
    p_consent_at: new Date().toISOString(),
    ...over,
  };
}

async function notificationsFor(leadId: string) {
  const { data } = await admin
    .from("notifications")
    .select("user_id, type, payload")
    .eq("type", "web_basvuru")
    .eq("payload->>leadId", leadId);
  return data ?? [];
}

async function eventsFor(leadId: string, type: string) {
  const { data } = await admin
    .from("events")
    .select("id, payload")
    .eq("entity_type", "lead")
    .eq("entity_id", leadId)
    .eq("event_type", type);
  return data ?? [];
}

let dan: SupabaseClient;

beforeAll(async () => {
  dan = await clientFor("danisman@test.local");
  await admin.from("app_settings").update({ value: "" }).eq("key", "web_lead_assignee");
});

afterAll(async () => {
  const { data } = await admin.from("leads").select("id").like("phone", `${PREFIX}%`);
  const ids = (data ?? []).map((l) => l.id);
  for (const id of ids) {
    await admin.from("notifications").delete().eq("payload->>leadId", id);
  }
  await admin.from("leads").delete().like("phone", `${PREFIX}%`);
  await admin.from("app_settings").update({ value: "" }).eq("key", "web_lead_assignee");
});

describe("create_web_lead yetkileri", () => {
  it("publishable anahtarla (ziyaretçi) çağrılamaz", async () => {
    const anon = createClient(url, publishable, { auth: { persistSession: false } });
    const { error } = await anon.rpc("create_web_lead", args());
    expect(error).not.toBeNull();
  });

  it("giriş yapmış personel de doğrudan çağıramaz", async () => {
    const { error } = await dan.rpc("create_web_lead", args());
    expect(error).not.toBeNull();
  });
});

describe("create_web_lead davranışı (service role)", () => {
  it("yeni veli için 'yeni' durumunda web_sitesi kaynaklı lead, olay ve yönetici bildirimi oluşturur", async () => {
    const a = args({ p_landing_path: "/iletisim" });
    const { data, error } = await admin.rpc("create_web_lead", a);
    expect(error).toBeNull();
    expect(data.duplicate).toBe(false);

    const { data: lead } = await admin.from("leads").select("*").eq("id", data.lead_id).single();
    expect(lead.source).toBe("web_sitesi");
    expect(lead.status).toBe("yeni");
    expect(lead.phone).toBe(a.p_phone);
    expect(lead.landing_path).toBe("/iletisim");
    expect(lead.source_detail).toBe("/iletisim");
    expect(lead.consent_at).not.toBeNull();
    expect(lead.assigned_to).toBeNull();

    expect(await eventsFor(data.lead_id, "web_basvuru")).toHaveLength(1);
    const notes = await notificationsFor(data.lead_id);
    expect(notes.map((n) => n.user_id)).toContain(YON_ID);
    expect(notes.map((n) => n.user_id)).not.toContain(DAN_ID);
  });

  it("gclid varsa kaynak 'reklam' olur, gclid ve kampanya saklanır", async () => {
    const { data } = await admin.rpc(
      "create_web_lead",
      args({ p_gclid: "Cj0TEST", p_utm: { utm_source: "google", utm_campaign: "beylikduzu" }, p_landing_path: "/lp/beylikduzu-anaokulu" }),
    );
    const { data: lead } = await admin.from("leads").select("*").eq("id", data.lead_id).single();
    expect(lead.source).toBe("reklam");
    expect(lead.gclid).toBe("Cj0TEST");
    expect(lead.utm_source).toBe("google");
    expect(lead.utm_campaign).toBe("beylikduzu");
    expect(lead.source_detail).toBe("beylikduzu");
  });

  it("aynı telefonla açık lead varsa yeni kart açmaz; olay yazar, 10 dk içinde ikinci bildirim atmaz", async () => {
    const a = args();
    const first = await admin.rpc("create_web_lead", a);
    const second = await admin.rpc("create_web_lead", { ...a, p_gclid: "Cj0LATER" });
    expect(second.error).toBeNull();
    expect(second.data.duplicate).toBe(true);
    expect(second.data.lead_id).toBe(first.data.lead_id);

    const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("phone", a.p_phone);
    expect(count).toBe(1);
    expect(await eventsFor(first.data.lead_id, "web_tekrar_basvuru")).toHaveLength(1);
    expect(await notificationsFor(first.data.lead_id)).toHaveLength(1);

    // Önceden gclid'i olmayan karta sonradan gelen gclid eklenir (offline dönüşüm için).
    const { data: lead } = await admin.from("leads").select("gclid").eq("id", first.data.lead_id).single();
    expect(lead.gclid).toBe("Cj0LATER");
  });

  it("aynı telefonun lead'i kaybedildi ise yeni lead açar", async () => {
    const a = args();
    await admin.from("leads").insert({
      parent_name: "Eski Veli", phone: a.p_phone, source: "referans",
      status: "kaybedildi", lost_reason: "fiyat",
    });
    const { data, error } = await admin.rpc("create_web_lead", a);
    expect(error).toBeNull();
    expect(data.duplicate).toBe(false);
    const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("phone", a.p_phone);
    expect(count).toBe(2);
  });

  it("çok uzun utm ve gclid değerlerini 200 karaktere kırpar", async () => {
    const { data, error } = await admin.rpc(
      "create_web_lead",
      args({ p_gclid: "g".repeat(300), p_utm: { utm_campaign: "c".repeat(1000), utm_bogus: "x" } }),
    );
    expect(error).toBeNull();
    const { data: lead } = await admin.from("leads").select("gclid, utm_campaign, web_payload").eq("id", data.lead_id).single();
    expect(lead.gclid).toHaveLength(200);
    expect(lead.utm_campaign).toHaveLength(200);
    expect(lead.web_payload.utm).not.toHaveProperty("utm_bogus");
  });

  it("E.164 olmayan telefonu ve boş adı reddeder", async () => {
    expect((await admin.rpc("create_web_lead", args({ p_phone: "05301018875" }))).error).not.toBeNull();
    expect((await admin.rpc("create_web_lead", args({ p_phone: "+902122223344" }))).error).not.toBeNull();
    expect((await admin.rpc("create_web_lead", args({ p_parent_name: " " }))).error).not.toBeNull();
    expect((await admin.rpc("create_web_lead", args({ p_consent_at: null }))).error).not.toBeNull();
  });

  it("web_lead_assignee ayarlıysa lead'i ona atar ve ona da bildirir", async () => {
    await admin.from("app_settings").update({ value: DAN_ID }).eq("key", "web_lead_assignee");
    const { data } = await admin.rpc("create_web_lead", args());
    const { data: lead } = await admin.from("leads").select("assigned_to").eq("id", data.lead_id).single();
    expect(lead.assigned_to).toBe(DAN_ID);
    const users = (await notificationsFor(data.lead_id)).map((n) => n.user_id);
    expect(users).toEqual(expect.arrayContaining([YON_ID, DAN_ID]));
    await admin.from("app_settings").update({ value: "" }).eq("key", "web_lead_assignee");
  });

  it("p_meta.silent ile bildirim üretmez, p_meta web_payload'a yazılır", async () => {
    const { data } = await admin.rpc("create_web_lead", args({ p_meta: { silent: true, old_web_lead_id: "old-1" } }));
    expect(await notificationsFor(data.lead_id)).toHaveLength(0);
    const { data: lead } = await admin.from("leads").select("web_payload").eq("id", data.lead_id).single();
    expect(lead.web_payload.old_web_lead_id).toBe("old-1");
    expect(lead.web_payload).not.toHaveProperty("silent");
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run (repo kökünden):
```bash
cd packages/db && npx supabase db reset && cd ../..
pnpm --filter @seker/panel exec vitest run tests/rls/web-leads.test.ts
```
Expected: FAIL. Davranış testleri `data` null olduğu için `TypeError: Cannot read properties of null (reading 'duplicate')` ile düşer (RPC hatası `PGRST202 Could not find the function public.create_web_lead`). Yetki testleri bu aşamada da geçebilir; sorun değil.

- [ ] **Step 3: Migration'ı yaz**

`packages/db/supabase/migrations/0006_web_leads.sql`:

```sql
-- 0006_web_leads.sql — Faz 1: site formu doğrudan CRM leads tablosuna yazar.

-- === Atıf (attribution) kolonları ===
alter table public.leads
  add column gclid text,
  add column utm_source text,
  add column utm_medium text,
  add column utm_campaign text,
  add column utm_term text,
  add column utm_content text,
  add column landing_path text,
  add column consent_at timestamptz,
  add column web_payload jsonb;

create index idx_leads_gclid on public.leads (gclid) where gclid is not null;

-- === Kaynak listesine web_sitesi ===
alter table public.leads drop constraint leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('referans','instagram','reklam','tabela_gecerken','telefon','etkinlik','web_sitesi','diger'));

-- === Web başvurularının varsayılan danışmanı ("" = atanmamış; value NOT NULL) ===
insert into public.app_settings (key, value) values ('web_lead_assignee', '""'::jsonb)
  on conflict (key) do nothing;

-- === Tek giriş noktası ===
create or replace function public.create_web_lead(
  p_parent_name text,
  p_phone text,
  p_gclid text,
  p_utm jsonb,
  p_landing_path text,
  p_consent_at timestamptz,
  p_meta jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_parent_name, ''));
  v_gclid text := nullif(left(btrim(coalesce(p_gclid, '')), 200), '');
  v_path text := nullif(left(btrim(coalesce(p_landing_path, '')), 200), '');
  v_in jsonb := case when jsonb_typeof(p_utm) = 'object' then p_utm else '{}'::jsonb end;
  v_meta jsonb := case when jsonb_typeof(p_meta) = 'object' then p_meta else '{}'::jsonb end;
  v_silent boolean := coalesce(v_meta->>'silent', '') = 'true';
  v_utm jsonb;
  v_campaign text;
  v_payload jsonb;
  v_source text;
  v_lead_id uuid;
  v_assignee uuid;
  v_recent boolean;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'create_web_lead: invalid parent_name' using errcode = '22023';
  end if;
  if p_phone is null or p_phone !~ '^\+905[0-9]{9}$' then
    raise exception 'create_web_lead: invalid phone' using errcode = '22023';
  end if;
  if p_consent_at is null then
    raise exception 'create_web_lead: consent required' using errcode = '22023';
  end if;

  -- Yalnızca bilinen utm anahtarları, her biri en fazla 200 karakter.
  v_utm := jsonb_strip_nulls(jsonb_build_object(
    'utm_source',   nullif(left(btrim(coalesce(v_in->>'utm_source', '')), 200), ''),
    'utm_medium',   nullif(left(btrim(coalesce(v_in->>'utm_medium', '')), 200), ''),
    'utm_campaign', nullif(left(btrim(coalesce(v_in->>'utm_campaign', '')), 200), ''),
    'utm_term',     nullif(left(btrim(coalesce(v_in->>'utm_term', '')), 200), ''),
    'utm_content',  nullif(left(btrim(coalesce(v_in->>'utm_content', '')), 200), '')
  ));
  v_campaign := v_utm->>'utm_campaign';
  v_payload := jsonb_build_object('gclid', v_gclid, 'landing_path', v_path, 'utm', v_utm)
               || (v_meta - 'silent');

  -- Aynı telefondan eşzamanlı iki istek iki kart açmasın.
  perform pg_advisory_xact_lock(hashtext('create_web_lead:' || p_phone));

  select l.id into v_lead_id
  from public.leads l
  where l.phone = p_phone
    and l.status not in ('kazanildi', 'kaybedildi')
  order by l.created_at desc
  limit 1;

  if v_lead_id is not null then
    select exists (
      select 1 from public.events e
      where e.entity_type = 'lead'
        and e.entity_id = v_lead_id
        and e.event_type in ('web_basvuru', 'web_tekrar_basvuru')
        and e.created_at > now() - interval '10 minutes'
    ) into v_recent;

    update public.leads
       set last_activity_at = now(),
           gclid = coalesce(gclid, v_gclid)
     where id = v_lead_id;

    insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
    values ('lead', v_lead_id, 'web_tekrar_basvuru', null, v_payload);

    if not v_recent and not v_silent then
      insert into public.notifications (user_id, type, payload)
      select p.id, 'web_basvuru', jsonb_build_object(
               'leadId', v_lead_id, 'parentName', v_name, 'source', null,
               'landingPath', v_path, 'duplicate', true)
      from public.profiles p
      join public.leads l on l.id = v_lead_id
      where p.is_active and (p.role = 'yonetici' or p.id = l.assigned_to);
    end if;

    return jsonb_build_object('lead_id', v_lead_id, 'duplicate', true);
  end if;

  v_source := case when v_gclid is not null then 'reklam' else 'web_sitesi' end;

  begin
    select nullif(s.value #>> '{}', '')::uuid into v_assignee
    from public.app_settings s where s.key = 'web_lead_assignee';
  exception when invalid_text_representation then
    v_assignee := null;
  end;
  if v_assignee is not null and not exists (
    select 1 from public.profiles p where p.id = v_assignee and p.is_active
  ) then
    v_assignee := null;
  end if;

  insert into public.leads (
    parent_name, phone, source, source_detail, status, assigned_to,
    gclid, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    landing_path, consent_at, web_payload
  ) values (
    v_name, p_phone, v_source, coalesce(v_campaign, v_path), 'yeni', v_assignee,
    v_gclid, v_utm->>'utm_source', v_utm->>'utm_medium', v_campaign,
    v_utm->>'utm_term', v_utm->>'utm_content',
    v_path, p_consent_at, v_payload
  ) returning id into v_lead_id;

  insert into public.events (entity_type, entity_id, event_type, actor_id, payload)
  values ('lead', v_lead_id, 'web_basvuru', null, v_payload);

  if not v_silent then
    insert into public.notifications (user_id, type, payload)
    select p.id, 'web_basvuru', jsonb_build_object(
             'leadId', v_lead_id, 'parentName', v_name, 'source', v_source,
             'landingPath', v_path, 'duplicate', false)
    from public.profiles p
    where p.is_active and (p.role = 'yonetici' or p.id = v_assignee);
  end if;

  return jsonb_build_object('lead_id', v_lead_id, 'duplicate', false);
end;
$$;

revoke all on function public.create_web_lead(text, text, text, jsonb, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_web_lead(text, text, text, jsonb, text, timestamptz, jsonb)
  to service_role;
```

- [ ] **Step 4: Migration'ı uygula, testleri geçir**

Run:
```bash
cd packages/db && npx supabase db reset && cd ../..
pnpm --filter @seker/panel exec vitest run tests/rls/web-leads.test.ts
pnpm --filter @seker/panel exec vitest run tests/rls/rls.test.ts
```
Expected: `web-leads.test.ts` 10 test PASS. `rls.test.ts` önceki gibi PASS (kaynak CHECK genişledi, daralmadı).

- [ ] **Step 5: Tipleri yeniden üret**

Run:
```bash
cd packages/db && npx supabase gen types typescript --local > src/database.types.ts && cd ../..
grep -n "create_web_lead" packages/db/src/database.types.ts
```
Expected: `create_web_lead: {` satırı ve `Args` içinde `p_meta?: Json` görünür.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/migrations/0006_web_leads.sql packages/db/src/database.types.ts apps/panel/tests/rls/web-leads.test.ts
git commit -m "feat(db): create_web_lead ile site başvurularını leads tablosuna yaz"
```

---

### Task 2: Panel: web kaynağı, bildirim ve lead detayında atıf

**Files:**
- Modify: `apps/panel/lib/constants.ts` (`LEAD_SOURCES`, `EVENT_LABELS`)
- Modify: `apps/panel/actions/notifications.ts:8-12` (`NotificationType`)
- Create: `apps/panel/lib/notification-text.ts`
- Modify: `apps/panel/components/notification-bell.tsx` (yerel `moneyFromPayload` ve `notificationText` kaldırılır)
- Create: `apps/panel/lib/lead-attribution.ts`
- Modify: `apps/panel/app/(app)/leads/[id]/page.tsx` (`LeadRow`, select listesi, "Kaynak detayı" bloğunun altı)
- Test: `apps/panel/tests/unit/notification-text.test.ts`, `apps/panel/tests/unit/lead-attribution.test.ts`

**Interfaces:**
- Consumes: Task 1'deki kolonlar ve `notifications` payload'u `{ leadId, parentName, source, landingPath, duplicate }`.
- Produces:
  - `notificationText(n: { type: string; payload: Record<string, unknown> }): string`
  - `type LeadAttribution = { gclid: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; landing_path: string | null }`
  - `attributionLines(lead: LeadAttribution): string[]`

- [ ] **Step 1: Failing testleri yaz**

`apps/panel/tests/unit/notification-text.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { notificationText } from "@/lib/notification-text";

describe("notificationText", () => {
  it("yeni web başvurusunu veli adı ve sayfayla yazar", () => {
    expect(
      notificationText({
        type: "web_basvuru",
        payload: { parentName: "Ayşe Yılmaz", landingPath: "/lp/kres-2-yas", duplicate: false },
      }),
    ).toBe("Yeni web başvurusu: Ayşe Yılmaz (/lp/kres-2-yas)");
  });

  it("tekrar başvuruyu ayırt eder", () => {
    expect(
      notificationText({ type: "web_basvuru", payload: { parentName: "Ayşe Yılmaz", landingPath: null, duplicate: true } }),
    ).toBe("Ayşe Yılmaz siteden tekrar başvurdu");
  });

  it("mevcut teklif bildirimlerini değiştirmez", () => {
    expect(notificationText({ type: "teklif_reddedildi", payload: {} })).toBe("Teklifiniz reddedildi.");
    expect(notificationText({ type: "teklif_onay_bekliyor", payload: { offered: 18000 } })).toContain("Onay bekleyen yeni teklif");
  });

  it("bilinmeyen türde genel metin döner", () => {
    expect(notificationText({ type: "baska", payload: {} })).toBe("Yeni bildirim var.");
  });
});
```

`apps/panel/tests/unit/lead-attribution.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { attributionLines } from "@/lib/lead-attribution";

const empty = { gclid: null, utm_source: null, utm_medium: null, utm_campaign: null, landing_path: null };

describe("attributionLines", () => {
  it("web dışı lead için boş liste döner", () => {
    expect(attributionLines(empty)).toEqual([]);
  });

  it("reklamdan gelen lead için kampanya, kaynak, sayfa ve Google Ads satırı verir", () => {
    expect(
      attributionLines({
        gclid: "Cj0ABC", utm_source: "google", utm_medium: "cpc",
        utm_campaign: "beylikduzu", landing_path: "/lp/beylikduzu-anaokulu",
      }),
    ).toEqual([
      "Kampanya: beylikduzu",
      "Kaynak: google / cpc",
      "İniş sayfası: /lp/beylikduzu-anaokulu",
      "Google Ads tıklaması (dönüşüm geri bildirilebilir)",
    ]);
  });

  it("yalnız sayfa bilgisi olan organik başvuru", () => {
    expect(attributionLines({ ...empty, landing_path: "/iletisim" })).toEqual(["İniş sayfası: /iletisim"]);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/notification-text.test.ts tests/unit/lead-attribution.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/notification-text"` ve `"@/lib/lead-attribution"`.

- [ ] **Step 3: Uygula**

`apps/panel/lib/notification-text.ts`:

```ts
import { formatTRY, tlToKurus } from "@/lib/money";

function moneyFromPayload(value: unknown) {
  return typeof value === "number" ? formatTRY(tlToKurus(value)) : null;
}

export function notificationText(notification: {
  type: string;
  payload: Record<string, unknown>;
}): string {
  const { payload } = notification;
  const offered = moneyFromPayload(payload.offered);
  const counterPrice = moneyFromPayload(payload.counterPrice);

  switch (notification.type) {
    case "teklif_onay_bekliyor":
      return offered
        ? `Onay bekleyen yeni teklif: ${offered}`
        : "Yeni teklif onay bekliyor.";
    case "teklifiniz_onaylandi":
      return "Teklifiniz onaylandı.";
    case "teklif_revize_edildi":
      return counterPrice
        ? `Teklif için karşı rakam girildi: ${counterPrice}`
        : "Teklif için karşı rakam girildi.";
    case "teklif_reddedildi":
      return "Teklifiniz reddedildi.";
    case "web_basvuru": {
      const name = typeof payload.parentName === "string" ? payload.parentName : "Bir veli";
      if (payload.duplicate === true) return `${name} siteden tekrar başvurdu`;
      const page = typeof payload.landingPath === "string" && payload.landingPath ? ` (${payload.landingPath})` : "";
      return `Yeni web başvurusu: ${name}${page}`;
    }
    default:
      return "Yeni bildirim var.";
  }
}
```

`apps/panel/components/notification-bell.tsx`: dosyanın başındaki `import { formatTRY, tlToKurus } from "@/lib/money";` satırını `import { notificationText } from "@/lib/notification-text";` ile değiştir; yerel `moneyFromPayload` ve `notificationText` fonksiyonlarını (bugünkü 43–66. satırlar) sil. `formatTRY`/`tlToKurus` dosyanın başka bir yerinde hâlâ kullanılıyorsa (`grep -n "formatTRY" apps/panel/components/notification-bell.tsx`) money import'unu koru. `notificationHref` aynen kalır (`web_basvuru` payload'unda `leadId` olduğu için `/leads/<id>`'ye gider).

`apps/panel/actions/notifications.ts`:

```ts
export type NotificationType =
  | "teklif_onay_bekliyor"
  | "teklifiniz_onaylandi"
  | "teklif_revize_edildi"
  | "teklif_reddedildi"
  | "web_basvuru";
```

`apps/panel/lib/constants.ts`:

```ts
export const LEAD_SOURCES = {
  referans: "Referans", instagram: "Instagram", reklam: "Reklam",
  tabela_gecerken: "Tabela / Geçerken", telefon: "Telefon",
  etkinlik: "Etkinlik", web_sitesi: "Web Sitesi", diger: "Diğer",
} as const;
```

ve `EVENT_LABELS` nesnesinin sonuna (`aileye_baglandi` satırından sonra):

```ts
  web_basvuru: "Web sitesinden başvurdu",
  web_tekrar_basvuru: "Web sitesinden tekrar başvurdu",
```

`apps/panel/lib/lead-attribution.ts`:

```ts
export type LeadAttribution = {
  gclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
};

export function attributionLines(lead: LeadAttribution): string[] {
  const lines: string[] = [];
  if (lead.utm_campaign) lines.push(`Kampanya: ${lead.utm_campaign}`);
  if (lead.utm_source) {
    lines.push(`Kaynak: ${lead.utm_medium ? `${lead.utm_source} / ${lead.utm_medium}` : lead.utm_source}`);
  }
  if (lead.landing_path) lines.push(`İniş sayfası: ${lead.landing_path}`);
  if (lead.gclid) lines.push("Google Ads tıklaması (dönüşüm geri bildirilebilir)");
  return lines;
}
```

`apps/panel/app/(app)/leads/[id]/page.tsx`:
1. Import ekle: `import { attributionLines, type LeadAttribution } from "@/lib/lead-attribution";`
2. `interface LeadRow` → `interface LeadRow extends LeadAttribution {` (alanlar aynen kalır).
3. Bugünkü 291. satırdaki select dizesinde `source_detail,` sonrasına ` gclid, utm_source, utm_medium, utm_campaign, landing_path,` ekle.
4. "Kaynak detayı" bloğunun (`{lead.source_detail ? ( … ) : null}`) hemen altına, `</dl>`'den önce:

```tsx
              {attributionLines(lead).length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Web kaynağı
                  </dt>
                  <dd className="mt-1 space-y-1 rounded-2xl bg-muted px-3 py-2 text-sm text-slate-700">
                    {attributionLines(lead).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </dd>
                </div>
              ) : null}
```

- [ ] **Step 4: Testleri ve tip kontrolünü çalıştır**

Run:
```bash
pnpm --filter @seker/panel exec vitest run tests/unit
pnpm --filter @seker/panel exec tsc --noEmit
```
Expected: tüm birim testleri PASS; `tsc` hatasız. `tsc` bir `Record<LeadSource, …>` eksik anahtar hatası verirse (aday dosyalar: `app/(app)/pipeline/page.tsx`, `lib/queries/dashboard.ts`, `app/(app)/leads/new/page.tsx`, `components/lead-edit-form.tsx`) o kayda `web_sitesi: "Web Sitesi"` ekle.

- [ ] **Step 5: Elle kontrol**

Run: `pnpm --filter @seker/panel dev`, `yonetici@test.local / sifre123` ile gir. Task 1 testinin bıraktığı kayıtlar temizlendiği için bir tane üret:
```bash
pnpm --filter @seker/panel exec tsx -e "import('./tests/rls/helpers.ts').then(async ({admin}) => console.log(await admin.rpc('create_web_lead', {p_parent_name:'Deneme Veli', p_phone:'+905009998877', p_gclid:'Cj0X', p_utm:{utm_campaign:'deneme'}, p_landing_path:'/lp/kres-2-yas', p_consent_at:new Date().toISOString()})))"
```
Expected: zil ikonunda "Yeni web başvurusu: Deneme Veli (/lp/kres-2-yas)"; tıklayınca lead detayında "Kaynak: Reklam" ve "Web kaynağı" bloğunda kampanya, sayfa ve Google Ads satırı. Sonra bu lead'i panelden sil.

- [ ] **Step 6: Commit**

```bash
git add apps/panel/lib/constants.ts apps/panel/actions/notifications.ts apps/panel/lib/notification-text.ts apps/panel/components/notification-bell.tsx apps/panel/lib/lead-attribution.ts "apps/panel/app/(app)/leads/[id]/page.tsx" apps/panel/tests/unit/notification-text.test.ts apps/panel/tests/unit/lead-attribution.test.ts
git commit -m "feat(panel): web başvurusu kaynağı, bildirimi ve lead atıf bilgisi"
```

---

### Task 3: Site: UTM'yi ilk dokunuşla yakala

**Files:**
- Modify: `apps/web/lib/attribution.ts`
- Modify: `apps/web/app/components/AttributionFields.tsx`
- Test: `apps/web/lib/__tests__/attribution.test.ts`, `apps/web/app/components/__tests__/AttributionFields.test.tsx`

**Interfaces:**
- Produces:
  - `UTM_KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'] as const`, `type UtmKey`, `type Utm = Partial<Record<UtmKey, string>>`
  - `type Attribution = { gclid: string; landingPath: string; utm: Utm }`
  - `parseAttribution(search: string, pathname: string): Attribution`
  - `persistAttribution(storage, next: Attribution): Attribution` (sinyal = gclid veya en az bir utm; sinyalli ilk kayıt korunur)
  - Gizli input adları: `gclid`, `landingPath`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`

- [ ] **Step 1: Testleri güncelle (önce başarısız olacak)**

`apps/web/lib/__tests__/attribution.test.ts` tamamını şu hale getir:

```ts
import { describe, it, expect } from 'vitest';
import { ATTRIBUTION_KEY, parseAttribution, persistAttribution, type Attribution } from '../attribution';

describe('parseAttribution', () => {
  it('gclid ve landing path çıkarır', () => {
    expect(parseAttribution('?gclid=Cj0ABC123', '/lp/az-mevcutlu-anaokulu')).toEqual({
      gclid: 'Cj0ABC123',
      landingPath: '/lp/az-mevcutlu-anaokulu',
      utm: {},
    });
  });

  it('gclid yoksa boş bırakır ama yolu tutar', () => {
    expect(parseAttribution('', '/kayit')).toEqual({ gclid: '', landingPath: '/kayit', utm: {} });
  });

  it('diğer parametreler arasından gclid ve utm değerlerini bulur', () => {
    const a = parseAttribution('?utm_source=google&gclid=XYZ&utm_medium=cpc&utm_campaign=kres&foo=1', '/');
    expect(a.gclid).toBe('XYZ');
    expect(a.utm).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'kres' });
  });

  it('aşırı uzun gclid ve utm değerlerini 200 karaktere kırpar', () => {
    const a = parseAttribution(`?gclid=${'a'.repeat(300)}&utm_campaign=${'c'.repeat(1000)}`, '/');
    expect(a.gclid.length).toBe(200);
    expect(a.utm.utm_campaign?.length).toBe(200);
  });

  it('boş utm parametrelerini almaz', () => {
    expect(parseAttribution('?utm_source=&utm_medium=%20', '/').utm).toEqual({});
  });
});

describe('persistAttribution', () => {
  function makeStorage(initial: string | null) {
    let value = initial;
    return {
      getItem: (key: string) => (key === ATTRIBUTION_KEY ? value : null),
      setItem: (key: string, next: string) => { if (key === ATTRIBUTION_KEY) value = next; },
      read: () => value,
    };
  }

  it('kayıt yoksa yeni değeri yazar', () => {
    const storage = makeStorage(null);
    const next: Attribution = { gclid: 'A1', landingPath: '/lp/kres-2-yas', utm: {} };
    expect(persistAttribution(storage, next)).toEqual(next);
    expect(storage.read()).toBe(JSON.stringify(next));
  });

  it('ilk dokunuşu korur — sonraki sayfa gclid\'i ezmez', () => {
    const first: Attribution = { gclid: 'FIRST', landingPath: '/lp/kres-2-yas', utm: {} };
    const storage = makeStorage(JSON.stringify(first));
    expect(persistAttribution(storage, { gclid: '', landingPath: '/kayit', utm: {} })).toEqual(first);
  });

  it('utm ile gelen ilk dokunuş da korunur', () => {
    const first: Attribution = { gclid: '', landingPath: '/', utm: { utm_source: 'instagram' } };
    const storage = makeStorage(JSON.stringify(first));
    expect(persistAttribution(storage, { gclid: '', landingPath: '/kayit', utm: {} })).toEqual(first);
  });

  it('kayıtlı değerde sinyal yoksa yeni gclid günceller', () => {
    const storage = makeStorage(JSON.stringify({ gclid: '', landingPath: '/', utm: {} }));
    expect(persistAttribution(storage, { gclid: 'NEW', landingPath: '/lp/kres-2-yas', utm: {} }).gclid).toBe('NEW');
  });

  it('utm alanı olmayan eski biçimli kaydı okur', () => {
    const storage = makeStorage(JSON.stringify({ gclid: 'OLD', landingPath: '/lp/x' }));
    expect(persistAttribution(storage, { gclid: '', landingPath: '/kayit', utm: {} })).toEqual({
      gclid: 'OLD', landingPath: '/lp/x', utm: {},
    });
  });

  it('bozuk kayıtta çökmeden yeni değeri kullanır', () => {
    const storage = makeStorage('{bozuk');
    const next: Attribution = { gclid: 'B2', landingPath: '/', utm: {} };
    expect(persistAttribution(storage, next)).toEqual(next);
  });
});
```

`apps/web/app/components/__tests__/AttributionFields.test.tsx`: ilk testteki beklenen `sessionStorage` JSON'unu güncelle ve UTM kontrolünü ekle:

```tsx
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).toBe(
      JSON.stringify({ gclid: 'Cj0ABC123', landingPath: '/lp/az-mevcutlu-anaokulu', utm: {} }),
    );
```

ve `describe` bloğunun sonuna yeni test:

```tsx
  it('utm parametreleri gizli alanlara yazılır ve sonraki sayfada korunur', async () => {
    window.happyDOM.setURL('https://example.com/lp/kres-2-yas?utm_source=google&utm_campaign=kres');
    const first = render(<AttributionFields />);
    await waitFor(() => {
      expect(hiddenValue(first.container, 'utm_campaign')).toBe('kres');
    });
    expect(hiddenValue(first.container, 'utm_source')).toBe('google');
    expect(hiddenValue(first.container, 'utm_medium')).toBe('');
    first.unmount();

    window.happyDOM.setURL('https://example.com/kayit');
    const second = render(<AttributionFields />);
    await waitFor(() => {
      expect(hiddenValue(second.container, 'utm_campaign')).toBe('kres');
    });
  });
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/web exec vitest run lib/__tests__/attribution.test.ts app/components/__tests__/AttributionFields.test.tsx`
Expected: FAIL (`utm` alanı yok; `utm_campaign input bulunamadı`).

- [ ] **Step 3: Uygula**

`apps/web/lib/attribution.ts`:

```ts
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

export type Attribution = {
  gclid: string;
  landingPath: string;
  utm: Utm;
};

export const ATTRIBUTION_KEY = 'seker_attr';

const MAX_VALUE = 200;

export function parseAttribution(search: string, pathname: string): Attribution {
  const params = new URLSearchParams(search);
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = (params.get(key) ?? '').trim().slice(0, MAX_VALUE);
    if (value) utm[key] = value;
  }
  return {
    gclid: (params.get('gclid') ?? '').trim().slice(0, MAX_VALUE),
    landingPath: pathname.slice(0, MAX_VALUE),
    utm,
  };
}

function hasSignal(a: Attribution): boolean {
  return Boolean(a.gclid) || Object.keys(a.utm).length > 0;
}

function readStored(raw: string | null): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    if (typeof parsed.gclid !== 'string' || typeof parsed.landingPath !== 'string') return null;
    const utm: Utm = {};
    if (parsed.utm && typeof parsed.utm === 'object') {
      for (const key of UTM_KEYS) {
        const value = (parsed.utm as Record<string, unknown>)[key];
        if (typeof value === 'string' && value) utm[key] = value;
      }
    }
    return { gclid: parsed.gclid, landingPath: parsed.landingPath, utm };
  } catch {
    return null;
  }
}

/**
 * İlk dokunuşu korur: veli reklamdan /lp/... sayfasına indi, sonra /kayit'e
 * gitti — gclid/utm ilk inişten gelir, ikinci sayfa onu ezmemelidir.
 */
export function persistAttribution(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  next: Attribution,
): Attribution {
  const stored = readStored(storage.getItem(ATTRIBUTION_KEY));
  if (stored && hasSignal(stored)) return stored;

  const resolved = stored && !hasSignal(next) ? stored : next;
  storage.setItem(ATTRIBUTION_KEY, JSON.stringify(resolved));
  return resolved;
}
```

`apps/web/app/components/AttributionFields.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { UTM_KEYS, parseAttribution, persistAttribution, type Attribution } from '@/lib/attribution';

export default function AttributionFields() {
  const [attribution, setAttribution] = useState<Attribution>({ gclid: '', landingPath: '', utm: {} });

  useEffect(() => {
    try {
      const parsed = parseAttribution(window.location.search, window.location.pathname);
      setAttribution(persistAttribution(window.sessionStorage, parsed));
    } catch {
      // sessionStorage erişilemiyor olabilir (gizli mod, devre dışı depolama).
      // Kaybedilen tek şey attribution — lead kaybedilmemeli.
    }
  }, []);

  return (
    <>
      <input type="hidden" name="gclid" value={attribution.gclid} readOnly />
      <input type="hidden" name="landingPath" value={attribution.landingPath} readOnly />
      {UTM_KEYS.map((key) => (
        <input key={key} type="hidden" name={key} value={attribution.utm[key] ?? ''} readOnly />
      ))}
    </>
  );
}
```

- [ ] **Step 4: Testleri geçir**

Run: `pnpm --filter @seker/web exec vitest run lib/__tests__/attribution.test.ts app/components/__tests__/AttributionFields.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/attribution.ts apps/web/app/components/AttributionFields.tsx apps/web/lib/__tests__/attribution.test.ts apps/web/app/components/__tests__/AttributionFields.test.tsx
git commit -m "feat(web): UTM parametrelerini ilk dokunuşla yakala"
```

---

### Task 4: Site: form şeması (telefon, utm, honeypot) ve LeadForm

**Files:**
- Modify: `apps/web/lib/leadSchema.ts`
- Modify: `apps/web/app/components/LeadForm.tsx` (payload ve honeypot alanı)
- Modify: `apps/web/package.json` (`@seker/shared` bağımlılığı yoksa)
- Test: `apps/web/lib/__tests__/leadSchema.test.ts`

**Interfaces:**
- Consumes: `normalizeTurkishPhone` (`@seker/shared`), `UTM_KEYS` (Task 3).
- Produces: `leadSchema` çıktısı `Lead = { parentName: string; phone: string /* +905… */; gclid: string; landingPath: string; utm: Utm; website: string; kvkkConsent: true }`. `PHONE_ERROR` sabiti.

- [ ] **Step 1: Bağımlılığı kontrol et**

Run: `grep -n "@seker/shared\|@seker/auth" apps/web/package.json`
Eksikse: `pnpm --filter @seker/web add @seker/shared@workspace:* @seker/auth@workspace:*`

- [ ] **Step 2: Testleri güncelle**

`apps/web/lib/__tests__/leadSchema.test.ts` tamamı:

```ts
import { describe, it, expect } from 'vitest';
import { leadSchema, PHONE_ERROR } from '../leadSchema';

const valid = {
  parentName: 'Ayşe Yılmaz',
  phone: '05301018875',
  kvkkConsent: true,
};

describe('leadSchema', () => {
  it('yalnızca ad, telefon ve KVKK onayıyla geçerli bir lead kabul eder', () => {
    const r = leadSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe('+905301018875');
      expect(r.data.utm).toEqual({});
      expect(r.data.website).toBe('');
    }
  });

  it('KVKK onayı olmadan reddeder', () => {
    expect(leadSchema.safeParse({ ...valid, kvkkConsent: false }).success).toBe(false);
  });

  it.each([
    ['(0530) 101 88 75'],
    ['+90 530 101 88 75'],
    ['0090 530 101 88 75'],
    ['530-101-88-75'],
  ])('%s biçimini E.164 cep numarasına çevirir', (phone) => {
    const r = leadSchema.safeParse({ ...valid, phone });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe('+905301018875');
  });

  it.each([['123'], ['0212 222 33 44'], ['']])('%s numarasını Türkçe mesajla reddeder', (phone) => {
    const r = leadSchema.safeParse({ ...valid, phone });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.phone?.[0]).toBe(PHONE_ERROR);
  });

  it('tek harflik adı reddeder', () => {
    expect(leadSchema.safeParse({ ...valid, parentName: 'A' }).success).toBe(false);
  });

  it('kaldırılan alanlar artık sorulmuyor — şema çıktısında yer almaz', () => {
    const r = leadSchema.safeParse({
      ...valid,
      email: 'ayse@example.com',
      childAge: '3-4',
      program: 'tam-gun',
      startTerm: '2026-2027',
      message: 'Bilgi almak istiyorum',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      for (const key of ['email', 'childAge', 'program', 'startTerm', 'message']) {
        expect(r.data).not.toHaveProperty(key);
      }
    }
  });

  it('gclid, landingPath ve utm gizli alanları taşınır; bilinmeyen utm anahtarı düşer', () => {
    const r = leadSchema.safeParse({
      ...valid, gclid: 'Cj0ABC', landingPath: '/lp/x',
      utm: { utm_source: 'google', utm_campaign: 'kres', utm_evil: 'x' },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.gclid).toBe('Cj0ABC');
      expect(r.data.landingPath).toBe('/lp/x');
      expect(r.data.utm).toEqual({ utm_source: 'google', utm_campaign: 'kres' });
    }
  });

  it('çok uzun gizli alanlar başvuruyu reddettirmez, kırpılır', () => {
    const r = leadSchema.safeParse({
      ...valid, gclid: 'g'.repeat(300), landingPath: '/'.repeat(500),
      utm: { utm_campaign: 'c'.repeat(1000) },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.gclid).toHaveLength(200);
      expect(r.data.landingPath).toHaveLength(200);
      expect(r.data.utm.utm_campaign).toHaveLength(200);
    }
  });

  it('honeypot alanını taşır (route bot olarak ele alır)', () => {
    const r = leadSchema.safeParse({ ...valid, website: 'http://spam.example' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.website).toBe('http://spam.example');
  });
});
```

- [ ] **Step 3: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/web exec vitest run lib/__tests__/leadSchema.test.ts`
Expected: FAIL (`PHONE_ERROR` export edilmiyor; telefon `05301018875` olarak kalıyor).

- [ ] **Step 4: Şemayı yaz**

`apps/web/lib/leadSchema.ts`:

```ts
import { z } from 'zod';
import { normalizeTurkishPhone } from '@seker/shared';

/**
 * Ön görüşme formu yalnızca ad ve telefon ister. Yaş grubu, program,
 * başlangıç dönemi, e-posta ve serbest mesaj alanları kaldırıldı — bu
 * bilgiler formda değil, geri aramada konuşuluyor.
 *
 * gclid, landingPath ve utm gizli alanlardır (bkz. AttributionFields);
 * kullanıcı doldurmaz. Çok uzun gelirlerse reddedilmez, kırpılır: bir
 * reklam parametresi yüzünden başvuru kaybedilmemeli.
 *
 * website bir honeypot alanıdır: insan görmez, bot doldurur.
 */
export const PHONE_ERROR = 'Lütfen 05 ile başlayan cep telefonu numaranızı girin';

const MAX_HIDDEN = 200;
const hidden = z.string().trim().transform((v) => v.slice(0, MAX_HIDDEN));

export const leadSchema = z.object({
  parentName: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı').max(80),
  phone: z.string({ message: PHONE_ERROR }).transform((value, ctx) => {
    const normalized = normalizeTurkishPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: PHONE_ERROR });
      return z.NEVER;
    }
    return normalized;
  }),
  gclid: hidden.optional().default(''),
  landingPath: hidden.optional().default(''),
  utm: z
    .object({
      utm_source: hidden.optional(),
      utm_medium: hidden.optional(),
      utm_campaign: hidden.optional(),
      utm_term: hidden.optional(),
      utm_content: hidden.optional(),
    })
    .optional()
    .default({}),
  website: z.string().optional().default(''),
  kvkkConsent: z.literal(true, { message: 'Devam etmek için aydınlatma metnini onaylayın' }),
});

export type Lead = z.infer<typeof leadSchema>;
```

- [ ] **Step 5: LeadForm'u güncelle**

`apps/web/app/components/LeadForm.tsx`:
1. Import: `import { UTM_KEYS } from '@/lib/attribution';`
2. `payload` nesnesini şöyle yap:

```tsx
    const utm = Object.fromEntries(
      UTM_KEYS.map((key) => [key, String(data.get(key) ?? '')]).filter(([, value]) => value),
    );
    const payload = {
      parentName: String(data.get('parentName') ?? ''),
      phone: String(data.get('phone') ?? ''),
      gclid: String(data.get('gclid') ?? ''),
      landingPath: String(data.get('landingPath') ?? ''),
      utm,
      website: String(data.get('website') ?? ''),
      kvkkConsent: data.get('kvkkConsent') === 'on',
    };
```

3. `<AttributionFields />` satırının hemen altına honeypot (ekran okuyucudan ve klavyeden gizli):

```tsx
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Web siteniz</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
```

- [ ] **Step 6: Testleri ve tipleri çalıştır**

Run:
```bash
pnpm --filter @seker/web exec vitest run lib/__tests__/leadSchema.test.ts
pnpm --filter @seker/web exec tsc --noEmit
```
Expected: PASS. `tsc` route dosyasında `insertWebsiteLead` kaynaklı hata verebilir; Task 6'da düzelir, bu görevde yalnızca `leadSchema.ts` ve `LeadForm.tsx` hatasız olmalı.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/leadSchema.ts apps/web/lib/__tests__/leadSchema.test.ts apps/web/app/components/LeadForm.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): form şemasında E.164 telefon, utm ve honeypot"
```

---

### Task 5: Site: IP başına başvuru sınırı

**Files:**
- Create: `apps/web/lib/rateLimit.ts`
- Test: `apps/web/lib/__tests__/rateLimit.test.ts`

**Interfaces:**
- Produces:
  - `createRateLimiter(opts: { limit: number; windowMs: number }): { allow(key: string, now?: number): boolean }`
  - `clientIp(headers: Headers): string`

- [ ] **Step 1: Failing test**

`apps/web/lib/__tests__/rateLimit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clientIp, createRateLimiter } from '../rateLimit';

describe('createRateLimiter', () => {
  it('pencere içinde limit kadar izin verir, sonrakini reddeder', () => {
    const rl = createRateLimiter({ limit: 5, windowMs: 600_000 });
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rl.allow('1.1.1.1', t + i)).toBe(true);
    expect(rl.allow('1.1.1.1', t + 10)).toBe(false);
  });

  it('farklı IP birbirini etkilemez', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 600_000 });
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('b', 0)).toBe(true);
    expect(rl.allow('a', 1)).toBe(false);
  });

  it('pencere geçince tekrar izin verir', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('a', 999)).toBe(false);
    expect(rl.allow('a', 1000)).toBe(true);
  });
});

describe('clientIp', () => {
  it('X-Forwarded-For listesinin ilk değerini alır (Caddy gerçek istemci IP\'sini yazar)', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.2' }))).toBe('203.0.113.5');
  });

  it('başlık yoksa unknown döner', () => {
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/web exec vitest run lib/__tests__/rateLimit.test.ts`
Expected: FAIL, `Failed to resolve import "../rateLimit"`.

- [ ] **Step 3: Uygula**

`apps/web/lib/rateLimit.ts`:

```ts
/**
 * Tek sunucu, tek süreç (Lightsail) için yeterli bellek içi sınır.
 * Süreç yeniden başlarsa sayaç sıfırlanır; bu kabul edilebilir.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return {
    allow(key: string, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);

      if (hits.size > 5000) {
        for (const [k, times] of hits) {
          if (times.every((t) => now - t >= windowMs)) hits.delete(k);
        }
      }
      return true;
    },
  };
}

/** Caddy, güvenilmeyen istemcinin gönderdiği X-Forwarded-For'u yok sayıp gerçek IP'yi yazar. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}
```

- [ ] **Step 4: Testleri geçir**

Run: `pnpm --filter @seker/web exec vitest run lib/__tests__/rateLimit.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/rateLimit.ts apps/web/lib/__tests__/rateLimit.test.ts
git commit -m "feat(web): başvuru formu için IP başına sınır"
```

---

### Task 6: Site: başvuruyu CRM'e yaz, e-postayı sonra gönder

**Files:**
- Rewrite: `apps/web/lib/websiteLeads.ts`
- Create: `apps/web/lib/leadEmail.ts`
- Rewrite: `apps/web/app/api/lead/route.ts`
- Rewrite: `apps/web/app/api/lead/__tests__/route.test.ts`
- Modify: `apps/web/app/api/lead/__tests__/attribution.test.ts`
- Create: `apps/web/lib/__tests__/websiteLeads.test.ts`

**Interfaces:**
- Consumes: `createAdminSupabase()` (`@seker/auth/admin`), `leadSchema`/`Lead` (Task 4), `createRateLimiter`/`clientIp` (Task 5), `create_web_lead` RPC (Task 1).
- Produces:
  - `type CreateWebLeadResult = { status: 'saved'; leadId: string; duplicate: boolean } | { status: 'failed' }`
  - `createWebLead(lead: Lead, consentAt?: Date): Promise<CreateWebLeadResult>`
  - `sendLeadEmail(lead: Lead, result: CreateWebLeadResult): Promise<boolean>` (asla throw etmez)
  - `POST /api/lead`: 200 `{ ok: true }` | 400 `{ ok: false, errors, message? }` | 429 `{ ok: false, message }` | 500 `{ ok: false, message }`

- [ ] **Step 1: `websiteLeads` için failing test**

`apps/web/lib/__tests__/websiteLeads.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@seker/auth/admin', () => ({ createAdminSupabase: () => ({ rpc }) }));

import { createWebLead } from '../websiteLeads';
import type { Lead } from '../leadSchema';

const lead: Lead = {
  parentName: 'Ayşe Yılmaz',
  phone: '+905301018875',
  gclid: 'Cj0ABC',
  landingPath: '/lp/kres-2-yas',
  utm: { utm_campaign: 'kres' },
  website: '',
  kvkkConsent: true,
};

describe('createWebLead', () => {
  beforeEach(() => rpc.mockReset());

  it('create_web_lead fonksiyonunu doğru argümanlarla çağırır', async () => {
    rpc.mockResolvedValue({ data: { lead_id: 'L1', duplicate: false }, error: null });
    const consentAt = new Date('2026-10-20T09:00:00Z');
    const result = await createWebLead(lead, consentAt);
    expect(rpc).toHaveBeenCalledWith('create_web_lead', {
      p_parent_name: 'Ayşe Yılmaz',
      p_phone: '+905301018875',
      p_gclid: 'Cj0ABC',
      p_utm: { utm_campaign: 'kres' },
      p_landing_path: '/lp/kres-2-yas',
      p_consent_at: '2026-10-20T09:00:00.000Z',
    });
    expect(result).toEqual({ status: 'saved', leadId: 'L1', duplicate: false });
  });

  it('RPC hata dönerse failed döner ve telefonu loglamaz', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST301', message: 'x' } });
    expect(await createWebLead(lead)).toEqual({ status: 'failed' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('5301018875');
    log.mockRestore();
  });

  it('istemci throw ederse (ağ hatası) failed döner', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockRejectedValue(new Error('fetch failed'));
    expect(await createWebLead(lead)).toEqual({ status: 'failed' });
  });
});
```

- [ ] **Step 2: Route için failing testler**

`apps/web/app/api/lead/__tests__/route.test.ts` tamamı:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createWebLead } from '@/lib/websiteLeads';
import { POST } from '../route';

vi.mock('@/lib/websiteLeads', () => ({
  createWebLead: vi.fn().mockResolvedValue({ status: 'saved', leadId: 'L1', duplicate: false }),
}));

const send = vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null });
vi.mock('resend', () => ({ Resend: class { emails = { send }; } }));

const valid = { parentName: 'Ayşe Yılmaz', phone: '05301018875', kvkkConsent: true };

let ipSeq = 0;
function makeRequest(body: string, ip = `198.51.100.${++ipSeq}`) {
  return new Request('http://localhost/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body,
  });
}

describe('POST /api/lead', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    send.mockClear();
    vi.mocked(createWebLead).mockReset();
    vi.mocked(createWebLead).mockResolvedValue({ status: 'saved', leadId: 'L1', duplicate: false });
  });

  it('bozuk JSON gövdesinde 400 döner ve hem errors hem message alanı bulunur', async () => {
    const res = await POST(makeRequest('{not valid json'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, errors: {}, message: 'Geçersiz istek' });
  });

  it('sabit hat numarasında 400 ve Türkçe telefon hatası döner', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...valid, phone: '0212 222 33 44' })));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors.phone[0]).toContain('cep telefonu');
    expect(createWebLead).not.toHaveBeenCalled();
  });

  it('kayıt başarılıysa RESEND olmadan da 200 döner', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(vi.mocked(createWebLead).mock.calls[0][0].phone).toBe('+905301018875');
  });

  it('kayıt başarısız ve e-posta yoksa 500 döner', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    vi.mocked(createWebLead).mockResolvedValue({ status: 'failed' });
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(500);
    expect((await res.json()).message).toBe('Talebiniz alınamadı, lütfen telefonla ulaşın.');
  });

  it('kayıt başarısız ama e-posta gittiyse veli başarı görür, e-postada uyarı vardır', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.mocked(createWebLead).mockResolvedValue({ status: 'failed' });
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(200);
    expect(send.mock.calls[0][0].text).toContain('Panele kaydedilemedi');
  });

  it('kayıt başarılı, e-posta hata verirse yine 200 döner', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    send.mockRejectedValueOnce(new Error('resend down'));
    const res = await POST(makeRequest(JSON.stringify(valid)));
    expect(res.status).toBe(200);
  });

  it('honeypot doluysa kaydetmeden 200 döner', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...valid, website: 'http://spam.example' })));
    expect(res.status).toBe(200);
    expect(createWebLead).not.toHaveBeenCalled();
  });

  it('aynı IP\'den 10 dakikada 6. istek 429 döner', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    const ip = '192.0.2.77';
    for (let i = 0; i < 5; i++) {
      expect((await POST(makeRequest(JSON.stringify(valid), ip))).status).toBe(200);
    }
    const res = await POST(makeRequest(JSON.stringify(valid), ip));
    expect(res.status).toBe(429);
    expect((await res.json()).ok).toBe(false);
  });

  it('tekrar başvuruda e-posta konusu bunu belirtir', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.mocked(createWebLead).mockResolvedValue({ status: 'saved', leadId: 'L9', duplicate: true });
    await POST(makeRequest(JSON.stringify(valid)));
    expect(send.mock.calls[0][0].subject).toContain('Tekrar başvuru');
  });
});
```

`apps/web/app/api/lead/__tests__/attribution.test.ts`: mock bloğunu şu hale getir (testlerin kalanı aynı kalır; her `makeRequest`'e benzersiz `x-forwarded-for` başlığı ekle):

```ts
vi.mock('@/lib/websiteLeads', () => ({
  createWebLead: vi.fn().mockResolvedValue({ status: 'saved', leadId: 'L1', duplicate: false }),
}));
```

```ts
let ipSeq = 0;
function makeRequest(body: unknown) {
  return new Request('http://localhost/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `203.0.113.${++ipSeq}` },
    body: JSON.stringify(body),
  });
}
```

ve ilk teste kampanya beklentisi ekle: gövdeye `utm: { utm_campaign: 'az-mevcut' }` ekle, `expect(text).toContain('Kampanya: az-mevcut');`.

- [ ] **Step 3: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/web exec vitest run lib/__tests__/websiteLeads.test.ts app/api/lead`
Expected: FAIL (`createWebLead` export edilmiyor; 429 ve honeypot davranışı yok).

- [ ] **Step 4: `websiteLeads.ts`**

```ts
import { createAdminSupabase } from '@seker/auth/admin';
import type { Lead } from './leadSchema';

export type CreateWebLeadResult =
  | { status: 'saved'; leadId: string; duplicate: boolean }
  | { status: 'failed' };

export async function createWebLead(
  lead: Lead,
  consentAt: Date = new Date(),
): Promise<CreateWebLeadResult> {
  try {
    const db = createAdminSupabase();
    const { data, error } = await db.rpc('create_web_lead', {
      p_parent_name: lead.parentName,
      p_phone: lead.phone,
      p_gclid: lead.gclid,
      p_utm: lead.utm,
      p_landing_path: lead.landingPath,
      p_consent_at: consentAt.toISOString(),
    });
    if (error || !data) {
      console.error('[lead] create_web_lead failed:', error?.code ?? 'no-data');
      return { status: 'failed' };
    }
    const result = data as { lead_id: string; duplicate: boolean };
    return { status: 'saved', leadId: result.lead_id, duplicate: result.duplicate };
  } catch (error) {
    console.error('[lead] create_web_lead threw:', error instanceof Error ? error.message : 'unknown');
    return { status: 'failed' };
  }
}
```

- [ ] **Step 5: `leadEmail.ts`**

```ts
import { Resend } from 'resend';
import { SITE } from './site';
import type { Lead } from './leadSchema';
import type { CreateWebLeadResult } from './websiteLeads';

const FALLBACK_FROM = 'Şeker Anaokulu Web <onboarding@resend.dev>';

/** Asla throw etmez: e-posta hatası başvuruyu kaybettirmemeli. */
export async function sendLeadEmail(lead: Lead, result: CreateWebLeadResult): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const to = process.env.LEAD_NOTIFICATION_EMAIL ?? SITE.email;
  const from = process.env.LEAD_FROM_EMAIL || FALLBACK_FROM;
  const panelUrl = process.env.PANEL_URL ?? 'https://panel.sekeranaokulu.com';
  const saved = result.status === 'saved';
  const subject = saved && result.duplicate
    ? `Tekrar başvuru — ${lead.parentName}`
    : `Yeni geri arama talebi — ${lead.parentName}`;

  const text = [
    ...(saved ? [] : ['⚠ Panele kaydedilemedi. Lütfen bu başvuruyu panele elle girin.', '']),
    `Veli: ${lead.parentName}`,
    `Telefon: ${lead.phone}`,
    '',
    `Kaynak sayfa: ${lead.landingPath || '—'}`,
    `Kampanya: ${lead.utm.utm_campaign || '—'}`,
    `GCLID: ${lead.gclid || '—'}`,
    ...(saved ? [`Panelde aç: ${panelUrl}/leads/${result.leadId}`] : []),
    '',
    '⏱ Hedef yanıt süresi: 15 dakika',
  ].join('\n');

  try {
    await new Resend(apiKey).emails.send({ from, to, subject, text });
    return true;
  } catch (error) {
    console.error('[lead] e-posta gönderilemedi:', error instanceof Error ? error.message : 'unknown');
    return false;
  }
}
```

- [ ] **Step 6: Route**

`apps/web/app/api/lead/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { leadSchema } from '@/lib/leadSchema';
import { createWebLead } from '@/lib/websiteLeads';
import { sendLeadEmail } from '@/lib/leadEmail';
import { clientIp, createRateLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });
const FAILED = 'Talebiniz alınamadı, lütfen telefonla ulaşın.';

export async function POST(request: Request) {
  if (!limiter.allow(clientIp(request.headers))) {
    return NextResponse.json(
      { ok: false, message: 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin veya bizi arayın.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: {}, message: 'Geçersiz istek' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const lead = parsed.data;
  if (lead.website) {
    // Honeypot: bot'a başarı gibi görün, hiçbir şey kaydetme.
    return NextResponse.json({ ok: true });
  }

  // Kayıt önce, e-posta sonra.
  const saved = await createWebLead(lead);
  const emailed = await sendLeadEmail(lead, saved);

  if (saved.status === 'saved' || emailed) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, message: FAILED }, { status: 500 });
}
```

- [ ] **Step 7: Testleri ve tipleri çalıştır**

Run:
```bash
pnpm --filter @seker/web exec vitest run lib/__tests__/websiteLeads.test.ts app/api/lead
pnpm --filter @seker/web exec tsc --noEmit
```
Expected: PASS; `tsc` yalnızca henüz silinmemiş `app/admin/page.tsx`'in `listWebsiteLeads` import'u için hata verebilir (Task 7'de silinir). Başka hata olmamalı.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/websiteLeads.ts apps/web/lib/leadEmail.ts apps/web/app/api/lead/route.ts apps/web/app/api/lead/__tests__ apps/web/lib/__tests__/websiteLeads.test.ts
git commit -m "feat(web): başvuruyu create_web_lead ile CRM'e yaz, e-postayı sonra gönder"
```

---

### Task 6a: Site: KVKK aydınlatma metni ve onay kutusu (Google reklam ölçümü dahil)

Bugün `/gizlilik` sayfası "Bu sayfa şu anda hazırlanmaktadır" yazan bir yer tutucu; formdaki onay kutusu bu boş sayfaya bağlanıyor ve yalnızca "aranmama onay veriyorum" diyor. Faz 3, formdan gelen her aday için Google'a `CONSENT_GRANTED` gönderecek (sahip kararı, 2026-10-14). Bu beyanın doğru olması için veli, başvuru bilgisinin reklam ölçümü amacıyla Google ile paylaşılacağını formda onaylamış olmalı. Bu görev aydınlatma metnini yazar ve onay kutusunun metnini genişletir.

Metin, Faz 2'de düzenlenebilir hale gelebilmesi için sayfa içine gömülmez; `content/kvkk.ts` dosyasında yapılandırılmış veri olarak durur. Okuldan teyit edilmesi gereken her bilgi `[OKULDAN TEYİT ALINACAK: …]` ile işaretlidir; Task 9'daki yayın kontrolü bu işaret kaldıkça yayını durdurur.

**Files:**
- Create: `apps/web/content/kvkk.ts`
- Modify: `apps/web/app/(site)/gizlilik/page.tsx` (tamamen yeniden yazılır; `"use client"` kalkar)
- Modify: `apps/web/app/components/LeadForm.tsx:90-96` (onay kutusu metni)
- Test: `apps/web/app/__tests__/gizlilik.test.tsx`, `apps/web/app/components/__tests__/LeadForm.consent.test.tsx`

**Interfaces:**
- Consumes: `SITE` (`apps/web/lib/site.ts`), `buildMetadata` (`apps/web/lib/metadata.ts`, mevcut).
- Produces: `KVKK_TEXT: { updatedOn: string; sections: { id: string; title: string; paragraphs: string[]; items?: string[] }[] }`, `KVKK_CONSENT_LABEL: string`, `TEYIT_MARKER = '[OKULDAN TEYİT ALINACAK'`. Faz 2 bu yapıyı `gizlilik.*` slotlarının varsayılanı olarak kullanır.

- [ ] **Step 1: Başarısız testleri yaz**

`apps/web/app/__tests__/gizlilik.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GizlilikPage from '../(site)/gizlilik/page';
import { KVKK_TEXT, KVKK_CONSENT_LABEL } from '@/content/kvkk';

const allText = () => JSON.stringify(KVKK_TEXT);

describe('KVKK aydınlatma metni', () => {
  it('yer tutucu metin kalmadı', () => {
    render(<GizlilikPage />);
    expect(screen.queryByText(/hazırlanmaktadır/)).toBeNull();
  });

  it('veri sorumlusunu ve iletişim bilgisini gösterir', () => {
    render(<GizlilikPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('KVKK Aydınlatma Metni');
    expect(screen.getAllByText(/Özel Şeker Anaokulu/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sekerakademi@gmail\.com/).length).toBeGreaterThan(0);
  });

  it('Google ile reklam ölçümü paylaşımını ve yurt dışı aktarımı açıkça söyler', () => {
    expect(allText()).toMatch(/Google/);
    expect(allText()).toMatch(/reklam/);
    expect(allText()).toMatch(/yurt dışı/i);
  });

  it('KVKK md. 11 haklarını listeler', () => {
    const rights = KVKK_TEXT.sections.find((s) => s.id === 'haklar');
    expect(rights?.items?.length).toBeGreaterThanOrEqual(8);
  });

  it('onay kutusu metni aramayı ve Google paylaşımını kapsar', () => {
    expect(KVKK_CONSENT_LABEL).toMatch(/aranma/);
    expect(KVKK_CONSENT_LABEL).toMatch(/Google/);
  });
});
```

`apps/web/app/components/__tests__/LeadForm.consent.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import LeadForm from '../LeadForm';
import { KVKK_CONSENT_LABEL } from '@/content/kvkk';

describe('LeadForm onay kutusu', () => {
  it('zorunlu ve yeni onay metnini gösterir', () => {
    render(<LeadForm />);
    const box = screen.getByRole('checkbox', { name: /Google/ });
    expect(box).toBeRequired();
    expect(screen.getByRole('link', { name: 'KVKK Aydınlatma Metni' })).toHaveAttribute('href', '/gizlilik');
    expect(document.body.textContent).toContain(KVKK_CONSENT_LABEL);
  });
});
```

(`LeadForm` bugün default export mu, named export mu: `grep -n "export" apps/web/app/components/LeadForm.tsx` ile kontrol et; named ise importu `import { LeadForm } from '../LeadForm'` yap. Bileşen zorunlu prop alıyorsa mevcut `homepage.test.tsx`'teki kullanımla aynı prop'ları geç.)

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/web exec vitest run app/__tests__/gizlilik.test.tsx app/components/__tests__/LeadForm.consent.test.tsx`
Expected: FAIL (`@/content/kvkk` bulunamıyor).

- [ ] **Step 3: `apps/web/content/kvkk.ts`**

```ts
import { SITE } from '@/lib/site';

export const TEYIT_MARKER = '[OKULDAN TEYİT ALINACAK';

const address = `${SITE.address.street}, ${SITE.address.district}, ${SITE.address.city}`;

export const KVKK_CONSENT_LABEL =
  'Aydınlatma Metni\'ni okudum. Başvurum için aranmama ve başvuru bilgilerimin reklamlarımızın etkinliğini ölçmek amacıyla Google ile paylaşılmasına onay veriyorum.';

export type KvkkSection = { id: string; title: string; paragraphs: string[]; items?: string[] };

export const KVKK_TEXT: { updatedOn: string; sections: KvkkSection[] } = {
  updatedOn: '[OKULDAN TEYİT ALINACAK: yayın tarihi, ör. 1 Kasım 2026]',
  sections: [
    {
      id: 'veri-sorumlusu',
      title: 'Veri sorumlusu',
      paragraphs: [
        `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu ${SITE.legalName}'dur ([OKULDAN TEYİT ALINACAK: tam ticari unvan / işleten gerçek veya tüzel kişi, MERSİS veya vergi no]). Adres: ${address}. E-posta: ${SITE.email}. Telefon: ${SITE.phone.display}.`,
      ],
    },
    {
      id: 'veriler',
      title: 'Hangi kişisel verileri işliyoruz',
      paragraphs: ['Web sitemizdeki ön görüşme formu ve reklam sayfalarımız aracılığıyla şu verileri işliyoruz:'],
      items: [
        'Kimlik ve iletişim: velinin adı soyadı ve telefon numarası.',
        'Başvuru bilgisi: formun doldurulduğu sayfa, tarih ve saat, onay kaydı.',
        'Reklam ve pazarlama bilgisi: bir Google reklamına tıklayarak geldiyseniz reklam tıklama kimliği (gclid) ve kampanya bilgisi (UTM parametreleri).',
        'Görüşme süreci: sizinle yaptığımız görüşme, randevu ve kayıt aşamalarına ilişkin notlar.',
      ],
    },
    {
      id: 'amaclar',
      title: 'Verilerinizi hangi amaçlarla işliyoruz',
      paragraphs: [],
      items: [
        'Başvurunuza dönüş yapmak, sizi aramak, WhatsApp üzerinden yazmak ve okul ziyareti randevusu oluşturmak.',
        'Kayıt sürecini yürütmek ve kayıt olmanız halinde sözleşme ilişkisini kurmak.',
        'Hangi reklam ve sayfaların başvuru ve kayıt getirdiğini ölçmek; bu amaçla başvurunuzun bir randevuya veya kayda dönüştüğü bilgisini, reklam tıklama kimliğiyle birlikte Google\'a bildirmek.',
        'Yasal yükümlülüklerimizi yerine getirmek ve olası uyuşmazlıklarda hakkımızı korumak.',
      ],
    },
    {
      id: 'hukuki-sebep',
      title: 'Hukuki sebepler',
      paragraphs: [
        'Başvurunuza dönüş yapılması ve kayıt süreci, KVKK md. 5/2-(c) uyarınca bir sözleşmenin kurulmasıyla doğrudan ilgili olması ve md. 5/2-(f) uyarınca meşru menfaatimiz hukuki sebeplerine dayanır.',
        'Başvuru ve kayıt bilgisinin reklam ölçümü amacıyla Google ile paylaşılması ve bu kapsamda yurt dışına aktarılması, formda verdiğiniz açık rızaya (KVKK md. 5/1 ve md. 9) dayanır.',
      ],
    },
    {
      id: 'aktarim',
      title: 'Verilerinizi kimlerle paylaşıyoruz',
      paragraphs: [
        'Verilerinizi satmıyoruz. Yalnızca hizmeti yürütmek için aşağıdaki hizmet sağlayıcılarla, bu amaçla sınırlı olarak paylaşıyoruz. Bu sağlayıcıların sunucuları yurt dışındadır; aktarım KVKK md. 9 kapsamında açık rızanıza ve/veya Kurul\'un öngördüğü standart sözleşmelere dayanır.',
      ],
      items: [
        'Google (Google Ads, Google Tag Manager): reklam ölçümü; başvurunuzun randevu veya kayda dönüştüğü bilgisi reklam tıklama kimliğiyle birlikte bildirilir. Ad ve telefon numaranız Google\'a gönderilmez.',
        'Supabase: başvuru ve kayıt bilgilerinin saklandığı veritabanı (Avrupa Birliği, Frankfurt [OKULDAN TEYİT ALINACAK: Supabase proje bölgesi]).',
        'Amazon Web Services: web sitesi ve okul yönetim panelinin çalıştığı sunucu ve yedekler (Avrupa Birliği, Frankfurt).',
        'Resend: yeni başvuru bildiriminin okul yönetimine e-posta ile iletilmesi (ABD).',
        'Yetkili kamu kurum ve kuruluşları: yalnızca hukuken zorunlu olduğunda.',
      ],
    },
    {
      id: 'toplama',
      title: 'Toplama yöntemi',
      paragraphs: [
        'Verileriniz web sitemizdeki form aracılığıyla elektronik ortamda, otomatik yollarla toplanır. Reklam tıklama kimliği, Google reklamına tıkladığınızda adres satırında sitemize iletilir.',
      ],
    },
    {
      id: 'saklama',
      title: 'Saklama süresi',
      paragraphs: [
        'Kayıtla sonuçlanmayan başvurular [OKULDAN TEYİT ALINACAK: süre, ör. 2 yıl] sonra silinir veya anonim hale getirilir. Kayıt olan öğrencilere ilişkin veriler sözleşme süresi ve ilgili mevzuattaki saklama süreleri boyunca tutulur. Yedeklerdeki kopyalar en geç 30 gün içinde kendiliğinden silinir.',
      ],
    },
    {
      id: 'haklar',
      title: 'KVKK md. 11 kapsamındaki haklarınız',
      paragraphs: ['Bize başvurarak:'],
      items: [
        'Kişisel verinizin işlenip işlenmediğini öğrenme,',
        'İşlenmişse buna ilişkin bilgi talep etme,',
        'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,',
        'Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,',
        'Eksik veya yanlış işlenmişse düzeltilmesini isteme,',
        'KVKK md. 7 şartları çerçevesinde silinmesini veya yok edilmesini isteme,',
        'Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,',
        'Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme,',
        'Kanuna aykırı işleme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme',
      ],
    },
    {
      id: 'basvuru',
      title: 'Başvuru ve rızanın geri alınması',
      paragraphs: [
        `Haklarınıza ilişkin taleplerinizi ${SITE.email} adresine e-posta ile veya ${address} adresine yazılı olarak iletebilirsiniz. Talebiniz en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.`,
        'Google ile reklam ölçümü paylaşımına verdiğiniz açık rızayı aynı yollarla dilediğiniz zaman geri alabilirsiniz; geri alma, o tarihten sonraki paylaşımları durdurur.',
      ],
    },
  ],
};
```

- [ ] **Step 4: `apps/web/app/(site)/gizlilik/page.tsx`**

Önce mevcut `buildMetadata` imzasını kontrol et: `grep -n "export function buildMetadata" -A8 apps/web/lib/metadata.ts`. Aşağıdaki çağrı `{ title, description, path }` alan imzaya göredir; farklıysa aynı üç bilgiyi mevcut imzaya uyarla.

```tsx
import type { Metadata } from 'next';
import { KVKK_TEXT } from '@/content/kvkk';
import { buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'KVKK Aydınlatma Metni',
  description: 'Özel Şeker Anaokulu kişisel verilerin korunması aydınlatma metni.',
  path: '/gizlilik',
});

export default function GizlilikPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <article className="mx-auto max-w-3xl">
            <h1 className="mb-2 font-display text-3xl text-ink md:text-4xl">KVKK Aydınlatma Metni</h1>
            <p className="mb-10 text-sm text-ink-soft">Son güncelleme: {KVKK_TEXT.updatedOn}</p>
            <div className="space-y-10">
              {KVKK_TEXT.sections.map((section) => (
                <section key={section.id} id={section.id} className="space-y-3">
                  <h2 className="font-display text-xl text-ink md:text-2xl">{section.title}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="leading-relaxed text-ink-soft">
                      {paragraph}
                    </p>
                  ))}
                  {section.items && (
                    <ul className="list-disc space-y-2 pl-6 text-ink-soft">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Onay kutusu metni**

`apps/web/app/components/LeadForm.tsx` içinde importlara `import { KVKK_CONSENT_LABEL } from '@/content/kvkk';` ekle ve onay kutusunun `<span>` içeriğini şununla değiştir (bağlantı "KVKK Aydınlatma Metni" kalır, cümlenin geri kalanı `KVKK_CONSENT_LABEL`'dan gelir):

```tsx
        <span>
          <a href="/gizlilik" className="underline">KVKK Aydınlatma Metni</a>&apos;ni okudum.{' '}
          {KVKK_CONSENT_LABEL.slice("Aydınlatma Metni'ni okudum. ".length)}
        </span>
```

Step 1'deki `LeadForm.consent.test.tsx` içindeki son beklentiyi, görünen metinle birebir eşleşecek şekilde şu hale getir:

```tsx
    expect(document.body.textContent).toContain(
      "KVKK Aydınlatma Metni'ni okudum. " + KVKK_CONSENT_LABEL.slice("Aydınlatma Metni'ni okudum. ".length),
    );
```

- [ ] **Step 6: Testleri çalıştır**

Run: `pnpm --filter @seker/web exec vitest run`
Expected: PASS (tüm web testleri; `routes.test.ts` ve `sitemap.test.ts` `/gizlilik`'i zaten içeriyor ve değişmeden geçer).

- [ ] **Step 7: Teyit listesini sahibe ilet**

Run: `grep -n "OKULDAN TEYİT ALINACAK" apps/web/content/kvkk.ts`
Expected: 4 satır (yayın tarihi, unvan/MERSİS, Supabase bölgesi, saklama süresi). Bu dört bilgiyi okul sahibinden al ve dosyada işaretleri gerçek değerlerle değiştir. Supabase bölgesi: Supabase panelinde Project Settings → General → Region. Metnin bir hukukçu tarafından bir kez okunması önerilir (özellikle açık rızanın zorunlu kutuya bağlanması konusunda).

- [ ] **Step 8: Commit**

```bash
git add apps/web/content/kvkk.ts "apps/web/app/(site)/gizlilik/page.tsx" apps/web/app/components/LeadForm.tsx apps/web/app/__tests__/gizlilik.test.tsx apps/web/app/components/__tests__/LeadForm.consent.test.tsx
git commit -m "feat(web): KVKK aydinlatma metni ve Google reklam olcumu onayi"
```

### Task 7: Site: eski `/admin` ve ayrı veritabanı istemcisini kaldır

**Files:**
- Delete: `apps/web/app/admin/layout.tsx`, `apps/web/app/admin/page.tsx`, `apps/web/app/api/admin/login/route.ts`, `apps/web/app/api/admin/logout/route.ts`, `apps/web/lib/adminAuth.ts`, `apps/web/lib/__tests__/adminAuth.test.ts`, `apps/web/lib/supabase.ts`
- Modify: `apps/web/next.config.ts` (`redirects`)
- Modify: `apps/web/.env.example`
- Test: `apps/web/app/__tests__/routes.test.ts` (yeni test)

**Interfaces:**
- Produces: `/admin` → `PANEL_URL` (geçici, 307) yönlendirmesi. `robots.ts`'teki `/admin` disallow kalır (zararsız).

- [ ] **Step 1: Failing test**

`apps/web/app/__tests__/routes.test.ts` dosyasının sonuna ekle:

```ts
import nextConfig from '../../next.config';

describe('eski admin', () => {
  it('/admin panele yönlendirilir', async () => {
    const redirects = await nextConfig.redirects!();
    const admin = redirects.find((r) => r.source === '/admin/:path*');
    expect(admin?.destination).toMatch(/^https:\/\/panel\./);
    expect(admin?.permanent).toBe(false);
  });
});
```

(Dosyanın başında `describe`, `it`, `expect` zaten `vitest`'ten import ediliyor; değilse `import { describe, it, expect } from 'vitest';` ekle.)

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/web exec vitest run app/__tests__/routes.test.ts`
Expected: FAIL, `admin` undefined.

- [ ] **Step 3: Sil ve yönlendir**

```bash
git rm -r apps/web/app/admin apps/web/app/api/admin apps/web/lib/adminAuth.ts apps/web/lib/__tests__/adminAuth.test.ts apps/web/lib/supabase.ts
```

`apps/web/next.config.ts` içindeki `redirects()` dönüş dizisine ekle:

```ts
      {
        source: '/admin/:path*',
        destination: process.env.PANEL_URL ?? 'https://panel.sekeranaokulu.com',
        permanent: false,
      },
```

`apps/web/.env.example` tamamı:

```bash
# Lead e-postaları (https://resend.com) — gönderen adres doğrulanmış alan adından olmalı
RESEND_API_KEY=
LEAD_NOTIFICATION_EMAIL=sekerakademi@gmail.com
LEAD_FROM_EMAIL="Şeker Anaokulu <web@sekeranaokulu.com>"

# Supabase (CRM ile aynı proje). SECRET yalnızca sunucuda; tarayıcıya gitmez.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# Panel adresi (e-postadaki bağlantı ve /admin yönlendirmesi)
PANEL_URL=https://panel.sekeranaokulu.com

# Google Tag Manager konteyner kimliği
NEXT_PUBLIC_GTM_ID=
```

Kalan referans kontrolü:
```bash
grep -rn "ADMIN_PASSWORD\|adminAuth\|supabaseRest\|insert_seker_website_lead\|list_seker_website_leads\|SUPABASE_ANON_KEY" apps/web infra .github
```
Expected: çıktı yok. `infra/` veya `.github/` içinde `ADMIN_PASSWORD` geçiyorsa o satırı sil.

- [ ] **Step 3b: Compose ve env şablonunu yeni anahtarlara geçir**

`infra/docker-compose.yml` → `web` servisinin `environment:` bölümünde `SUPABASE_URL`, `SUPABASE_ANON_KEY` ve `ADMIN_PASSWORD` satırlarını sil, yerine ekle:
```yaml
      SUPABASE_SECRET_KEY: ${SUPABASE_SECRET_KEY}
```
`infra/env.example`'da aynı üç anahtarı kaldır; `SUPABASE_SECRET_KEY` yorumunu "web ve panel kullanır, yalnızca sunucu" olarak güncelle. Sunucudaki `.env`'e değer Task 9 Step 1'de girilir.
Doğrula: `grep -n "ADMIN_PASSWORD\|SUPABASE_ANON_KEY\|SUPABASE_URL:" infra/docker-compose.yml infra/env.example` → çıktı yok.

- [ ] **Step 4: Tüm site testleri, tip ve build**

Run:
```bash
pnpm --filter @seker/web test
pnpm --filter @seker/web exec tsc --noEmit
pnpm --filter @seker/web build
```
Expected: tüm testler PASS, `tsc` hatasız, build başarılı ve route listesinde `/admin` yok.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web infra/docker-compose.yml infra/env.example
git commit -m "chore(web): eski /admin, ADMIN_PASSWORD ve ayrı Supabase istemcisini kaldır"
```

---

### Task 8: Eski başvuruların tek seferlik aktarımı

**Files:**
- Create: `apps/panel/scripts/seed/import-old-web-leads.ts`
- Create: `apps/panel/scripts/seed/lib/old-web-leads.ts`
- Test: `apps/panel/tests/seed/import-old-web-leads.test.ts`

**Interfaces:**
- Consumes: `parseCsv` (`apps/panel/scripts/seed/lib/csv.ts`), `normalizeTurkishPhone` (`@seker/shared`), `create_web_lead` RPC ve `p_meta` (`{ silent: true, old_web_lead_id }`).
- Produces:
  - `type OldWebLead = { id: string; parentName: string; phone: string; landingPath: string; gclid: string; createdAt: string }`
  - `parseOldWebLeads(csvText: string): { rows: OldWebLead[]; rejected: { line: number; reason: string }[] }`
  - CLI: `pnpm --filter @seker/panel exec tsx scripts/seed/import-old-web-leads.ts --csv <yol> [--dry-run]`

Eski veriyi dışa aktarma (sahip yapar, bir kez): eski Supabase projesinin panelinde **SQL Editor** → `select id, parent_name, phone, landing_path, gclid, created_at from <tablo> order by created_at;` (tablo adı `insert_seker_website_lead` fonksiyonunun gövdesinde yazar: **Database → Functions → insert_seker_website_lead**) → sonuç tablosunda **Download CSV**. Dosyayı `apps/panel/out/old-web-leads.csv` olarak kaydet (`out/` gitignore'da).

- [ ] **Step 1: Failing test**

`apps/panel/tests/seed/import-old-web-leads.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseOldWebLeads } from "../../scripts/seed/lib/old-web-leads";

const header = "id,parent_name,phone,landing_path,gclid,created_at";

describe("parseOldWebLeads", () => {
  it("geçerli satırı E.164 telefonla döndürür", () => {
    const csv = `${header}\r\nabc-1,Ayşe Yılmaz,05301018875,/lp/kres-2-yas,Cj0X,2026-09-01 10:00:00+00\r\n`;
    expect(parseOldWebLeads(csv)).toEqual({
      rows: [{
        id: "abc-1", parentName: "Ayşe Yılmaz", phone: "+905301018875",
        landingPath: "/lp/kres-2-yas", gclid: "Cj0X", createdAt: "2026-09-01T10:00:00.000Z",
      }],
      rejected: [],
    });
  });

  it("geçersiz telefonu ve eksik adı satır numarasıyla reddeder", () => {
    const csv = `${header}\nx1,Ali Veli,02122223344,/,,2026-09-01T10:00:00Z\nx2,,05301018875,/,,2026-09-01T10:00:00Z\n`;
    const { rows, rejected } = parseOldWebLeads(csv);
    expect(rows).toHaveLength(0);
    expect(rejected).toEqual([
      { line: 2, reason: "geçersiz telefon" },
      { line: 3, reason: "ad eksik" },
    ]);
  });

  it("başlık eksikse anlaşılır hata fırlatır", () => {
    expect(() => parseOldWebLeads("id,name\n1,a\n")).toThrow(/phone/);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/seed/import-old-web-leads.test.ts`
Expected: FAIL, modül bulunamadı.

- [ ] **Step 3: Ayrıştırıcıyı yaz**

`apps/panel/scripts/seed/lib/old-web-leads.ts`:

```ts
import { normalizeTurkishPhone } from "@seker/shared";
import { parseCsv } from "./csv";

export type OldWebLead = {
  id: string;
  parentName: string;
  phone: string;
  landingPath: string;
  gclid: string;
  createdAt: string;
};

const REQUIRED = ["id", "parent_name", "phone", "landing_path", "gclid", "created_at"] as const;

export function parseOldWebLeads(csvText: string): {
  rows: OldWebLead[];
  rejected: { line: number; reason: string }[];
} {
  const [header, ...lines] = parseCsv(csvText).filter((r) => r.some((c) => c.trim() !== ""));
  const index = Object.fromEntries((header ?? []).map((h, i) => [h.trim(), i]));
  const missing = REQUIRED.filter((k) => index[k] === undefined);
  if (missing.length) throw new Error(`CSV başlığında eksik kolon: ${missing.join(", ")}`);

  const rows: OldWebLead[] = [];
  const rejected: { line: number; reason: string }[] = [];
  lines.forEach((cells, i) => {
    const line = i + 2;
    const get = (k: (typeof REQUIRED)[number]) => (cells[index[k]] ?? "").trim();
    const parentName = get("parent_name");
    if (parentName.length < 2) return rejected.push({ line, reason: "ad eksik" });
    const phone = normalizeTurkishPhone(get("phone"));
    if (!phone) return rejected.push({ line, reason: "geçersiz telefon" });
    const created = new Date(get("created_at").replace(" ", "T").replace(/\+00$/, "Z"));
    if (Number.isNaN(created.getTime())) return rejected.push({ line, reason: "geçersiz tarih" });
    rows.push({
      id: get("id"),
      parentName,
      phone,
      landingPath: get("landing_path"),
      gclid: get("gclid"),
      createdAt: created.toISOString(),
    });
  });
  return { rows, rejected };
}
```

- [ ] **Step 4: Testi geçir**

Run: `pnpm --filter @seker/panel exec vitest run tests/seed/import-old-web-leads.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: CLI betiğini yaz**

`apps/panel/scripts/seed/import-old-web-leads.ts`:

```ts
/**
 * Eski site veritabanındaki web başvurularını CRM'e bir kez aktarır.
 *
 * Kullanım:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SECRET_KEY=<sb_secret_…> \
 *   pnpm --filter @seker/panel exec tsx scripts/seed/import-old-web-leads.ts --csv out/old-web-leads.csv [--dry-run]
 *
 * Idempotent: daha önce aktarılmış satır (leads.web_payload veya events.payload
 * içinde old_web_lead_id) atlanır. Bildirim üretmez (p_meta.silent). KVKK onay
 * zamanı olarak başvurunun orijinal tarihi yazılır. Kişisel veri loglanmaz.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { parseOldWebLeads } from "./lib/old-web-leads";

(globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;
dotenv.config({ path: ".env.local" });

const argv = process.argv.slice(2);
const csvPath = argv[argv.indexOf("--csv") + 1];
const dryRun = argv.includes("--dry-run");
if (!argv.includes("--csv") || !csvPath) {
  console.error("Kullanım: … import-old-web-leads.ts --csv <dosya> [--dry-run]");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

async function alreadyImported(): Promise<Set<string>> {
  const done = new Set<string>();
  const { data: leads, error: e1 } = await db
    .from("leads").select("web_payload").not("web_payload->>old_web_lead_id", "is", null);
  if (e1) throw e1;
  const { data: events, error: e2 } = await db
    .from("events").select("payload").eq("event_type", "web_tekrar_basvuru")
    .not("payload->>old_web_lead_id", "is", null);
  if (e2) throw e2;
  for (const r of leads ?? []) done.add(String((r.web_payload as Record<string, unknown>).old_web_lead_id));
  for (const r of events ?? []) done.add(String((r.payload as Record<string, unknown>).old_web_lead_id));
  return done;
}

async function main() {
  const { rows, rejected } = parseOldWebLeads(fs.readFileSync(path.resolve(csvPath), "utf8"));
  const done = await alreadyImported();
  const todo = rows.filter((r) => !done.has(r.id));

  console.log(`CSV: ${rows.length} geçerli, ${rejected.length} reddedildi, ${rows.length - todo.length} zaten aktarılmış, ${todo.length} aktarılacak.`);
  for (const r of rejected) console.log(`  satır ${r.line}: ${r.reason}`);
  if (dryRun) {
    console.log("--dry-run: hiçbir şey yazılmadı.");
    return;
  }

  let created = 0, merged = 0, failed = 0;
  for (const row of todo) {
    const { data, error } = await db.rpc("create_web_lead", {
      p_parent_name: row.parentName,
      p_phone: row.phone,
      p_gclid: row.gclid,
      p_utm: {},
      p_landing_path: row.landingPath,
      p_consent_at: row.createdAt,
      p_meta: { silent: true, old_web_lead_id: row.id, old_created_at: row.createdAt },
    });
    if (error || !data) {
      failed++;
      console.error(`  ${row.id}: ${error?.code ?? "veri yok"}`);
      continue;
    }
    if ((data as { duplicate: boolean }).duplicate) merged++; else created++;
  }
  console.log(`Bitti: ${created} yeni lead, ${merged} mevcut karta eklendi, ${failed} hata.`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 6: Lokalde dene**

```bash
mkdir -p apps/panel/out
printf 'id,parent_name,phone,landing_path,gclid,created_at\nold-1,Deneme Aktarım,05009991111,/kayit,,2026-08-01T09:00:00Z\nold-2,Sabit Hat,02122223344,/,,2026-08-02T09:00:00Z\n' > apps/panel/out/old-web-leads-test.csv
pnpm --filter @seker/panel exec tsx scripts/seed/import-old-web-leads.ts --csv out/old-web-leads-test.csv --dry-run
pnpm --filter @seker/panel exec tsx scripts/seed/import-old-web-leads.ts --csv out/old-web-leads-test.csv
pnpm --filter @seker/panel exec tsx scripts/seed/import-old-web-leads.ts --csv out/old-web-leads-test.csv
```
Expected sırasıyla:
- `CSV: 1 geçerli, 1 reddedildi, 0 zaten aktarılmış, 1 aktarılacak.` + `satır 3: geçersiz telefon` + `--dry-run: hiçbir şey yazılmadı.`
- `Bitti: 1 yeni lead, 0 mevcut karta eklendi, 0 hata.`
- `CSV: 1 geçerli, 1 reddedildi, 1 zaten aktarılmış, 0 aktarılacak.` ve `Bitti: 0 yeni lead, 0 mevcut karta eklendi, 0 hata.`

Sonra test kaydını sil: `cd packages/db && npx supabase db reset && cd ../..`

- [ ] **Step 7: Commit**

```bash
git add apps/panel/scripts/seed/import-old-web-leads.ts apps/panel/scripts/seed/lib/old-web-leads.ts apps/panel/tests/seed/import-old-web-leads.test.ts
git commit -m "feat(panel): eski site başvurularını CRM'e aktaran tek seferlik betik"
```

---

### Task 9: Yayın, uçtan uca kontrol ve eski projenin kapatılması

**Files:**
- Modify (sunucuda): `/opt/seker/.env`
- Modify (GitHub): repository secrets
- Kod değişikliği yok; bu görev Task 1–8'in yayına alınmasıdır.

**Interfaces:**
- Consumes: Faz 0'ın `deploy.yml` akışı (push → GHCR → `docker compose pull && up -d`), `packages/db` Supabase bağlantısı (`npx supabase link` Faz 0'da yapıldı).

- [ ] **Step 1: Resend alan adı doğrulaması (sahip)**

Resend panelinde **Domains → Add Domain → sekeranaokulu.com**; verilen SPF/DKIM TXT kayıtlarını DNS'e ekle; durum "Verified" olana kadar bekle. Sonra sunucuda:
```bash
ssh seker 'grep -q LEAD_FROM_EMAIL /opt/seker/.env || echo "LEAD_FROM_EMAIL=\"Şeker Anaokulu <web@sekeranaokulu.com>\"" >> /opt/seker/.env'
ssh seker 'grep -q PANEL_URL /opt/seker/.env || echo "PANEL_URL=https://panel.sekeranaokulu.com" >> /opt/seker/.env'
ssh seker 'sed -i "/^ADMIN_PASSWORD=/d;/^SUPABASE_ANON_KEY=/d;/^SUPABASE_URL=/d" /opt/seker/.env'
gh secret delete ADMIN_PASSWORD 2>/dev/null || true
```
(`seker`, Faz 0'da `~/.ssh/config`'e eklenen sunucu takma adıdır.)

- [ ] **Step 2: Migration'ı üretim veritabanına uygula (web dağıtımından ÖNCE)**

```bash
cd packages/db
npx supabase db push --dry-run
npx supabase db push
cd ../..
```
Expected: dry-run yalnızca `0006_web_leads.sql`'i listeler; push "Finished supabase db push." der. Migration yalnızca ekleme yaptığı için çalışan eski site kodunu bozmaz.

- [ ] **Step 3: Varsayılan danışmanı ayarla (isteğe bağlı, sahip karar verir)**

Supabase SQL Editor'da (kayıt sorumlusunun profil id'siyle):
```sql
update public.app_settings set value = to_jsonb('<danisman-profil-uuid>'::text) where key = 'web_lead_assignee';
```
Atanmamış kalması da geçerlidir; o zaman yalnız yöneticiler bildirim alır.

- [ ] **Step 3b: KVKK metni teyit kapısı (dağıtımdan ÖNCE)**

Run: `grep -c "OKULDAN TEYİT ALINACAK" apps/web/content/kvkk.ts`
Expected: `0`. Sıfır değilse DURMA: Task 6a Step 7'deki dört bilgi okul sahibinden alınmadan dağıtım yapılmaz. Aydınlatma metni boş veya yer tutuculu yayına çıkarsa, formdaki onay Google'a gönderilen `CONSENT_GRANTED` beyanını desteklemez.

- [ ] **Step 4: Dağıt**

```bash
pnpm turbo run test lint
git push origin main
gh run watch
```
Expected: CI yeşil, deploy işi biter; `curl -fsS https://sekeranaokulu.com/api/health` → `{"ok":true}`.

- [ ] **Step 5: Uçtan uca kontrol**

Faz 0'dan staging yığını (`yeni.sekeranaokulu.com`) hâlâ ayaktaysa önce orada, değilse canlıda yap (iki ortam da aynı Supabase projesine yazar):
1. Telefonun tarayıcısında `https://sekeranaokulu.com/lp/beylikduzu-anaokulu?gclid=TEST&utm_campaign=test` aç.
2. Sayfadaki formu "E2E Test Veli" adı ve kendi cep numaranla doldur, gönder → `/tesekkurler`.
3. Bir dakika içinde: panelde zil ikonunda "Yeni web başvurusu: E2E Test Veli (/lp/beylikduzu-anaokulu)"; pipeline'da "Yeni" sütununda kart, kaynak etiketi "Reklam", kaynak detayı "test"; detayda "Web kaynağı" bloğunda "Kampanya: test", "İniş sayfası: /lp/beylikduzu-anaokulu", Google Ads satırı.
4. `LEAD_NOTIFICATION_EMAIL` kutusunda "Yeni geri arama talebi — E2E Test Veli" e-postası, gönderen `web@sekeranaokulu.com`, içinde "Panelde aç" bağlantısı çalışıyor.
5. Formu aynı numarayla hemen tekrar gönder → yeni kart açılmamalı, ikinci bildirim gelmemeli, lead aktivitesinde "Web sitesinden tekrar başvurdu" olayı görünmeli.
6. `https://sekeranaokulu.com/admin` → panel giriş ekranına yönlenmeli.
7. Test lead'ini panelden sil.

- [ ] **Step 6: Eski başvuruları aktar**

Sahip eski projeden CSV'yi indirir (Task 8 başındaki talimat) ve `apps/panel/out/old-web-leads.csv` olarak kaydeder.
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=<sb_secret_…> \
  pnpm --filter @seker/panel exec tsx scripts/seed/import-old-web-leads.ts --csv out/old-web-leads.csv --dry-run
```
Reddedilen satırları sahiple birlikte gözden geçir (çoğu sabit hat veya hatalı numara olur; gerekirse panelden elle girilir). Sonra `--dry-run` olmadan çalıştır. Expected: `… 0 hata.`

- [ ] **Step 7: Eski projeyi kapat (aktarımdan 7 gün sonra)**

Sahip, eski site Supabase projesini panelden önce **Pause**, bir hafta sorun çıkmazsa **Delete** eder. Takvime not: aktarım tarihi + 7 gün. Bu, KVKK gereği verinin iki yerde durmamasını sağlar ve Free plandaki 2 aktif proje sınırında yer açar.

- [ ] **Step 8: Faz kapanış commit'i**

Kök `README.md`'deki "Başvuru akışı" bölümünü (yoksa ekle) şu üç satırla güncelle: form → `create_web_lead` → panel; tekrar başvuru kuralı (açık lead + aynı telefon, 10 dk bildirim susturma); varsayılan danışman `app_settings.web_lead_assignee`.

```bash
git add README.md
git commit -m "docs: başvuru akışı ve web_lead_assignee ayarı"
git push origin main
```

---

## Self-Review notları

- **Spec kapsamı:** "Bir veli formu doldurduğunda" adımları 1–4 ve 6'nın kaynak kısmı → Task 1, 2, 6, 9; "Başvuru akışı" diyagramı (zod, honeypot, IP sınırı, rpc, tekrar başvuru, bildirim, e-posta hatası loglanır) → Task 1, 4, 5, 6; eski başvuruların aktarımı ve eski projenin silinmesi (KVKK) → Task 8, 9; `/admin` ve `ADMIN_PASSWORD` kaldırma → Task 7, 9; `consent_at` kaydı → Task 1, 6. Google'a dönüşüm bildirimi (adım 6'nın ikinci yarısı) Faz 3'tedir.
- **Tip tutarlılığı:** `CreateWebLeadResult`, `Lead`, `Utm`, `UTM_KEYS`, `createRateLimiter`, `clientIp`, `notificationText`, `attributionLines`, `parseOldWebLeads` her kullanıldıkları görevde aynı imzayla tanımlı.
- **Review Focus:** beş maddenin her biri Task 1, 4 veya 6'daki bir testle bağlı.
