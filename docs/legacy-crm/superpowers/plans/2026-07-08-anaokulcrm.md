# AnaOkulCRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anaokulu için lead pipeline + kayıt + ödeme takibi yapan, 3 kullanıcılı, Türkçe, mobil öncelikli web uygulaması (spec: `docs/superpowers/specs/2026-07-07-anaokulcrm-design.md`).

**Architecture:** Next.js App Router (Server Components + Server Actions) doğrudan Supabase'e (Postgres + Auth + RLS) bağlanır; tüm yetki kuralları RLS'te, tüm iş kuralı ihlalleri DB constraint'lerinde de zorlanır. Domain olayları append-only `events` tablosuna yazılır. Günlük görev üretimi Vercel Cron endpoint'iyle çalışır.

**Tech Stack:** Next.js 15+ (TypeScript), Tailwind CSS, Supabase (@supabase/supabase-js v2 + @supabase/ssr), Vitest (birim + RLS entegrasyon testleri), Supabase CLI (lokal geliştirme + migration), xlsx (seed).

## Global Constraints

- Dil: Tüm UI metinleri Türkçe. Kod tanımlayıcıları İngilizce, domain enum değerleri Türkçe string (`'onay_bekliyor'` gibi) — spec §5.12.
- Enum'lar Postgres native enum DEĞİL; `text` + `CHECK` constraint — spec §5.12.
- Tüm enum değerleri ve Türkçe etiketleri YALNIZCA `lib/constants.ts`'te tanımlanır; başka dosyada string literal enum değeri yazılmaz.
- Para: TRY, DB'de `numeric(12,2)`; TS iş mantığında **kuruş cinsinden integer**. Taksit bölmede kuruş farkı son taksite eklenir — spec §12.
- Telefon: E.164 `+905XXXXXXXXX` formatına normalize edilir — spec §12.
- Saat dilimi: `Europe/Istanbul`; DB'de `timestamptz` — spec §12.
- `events` tablosu append-only: hiçbir rol UPDATE/DELETE yapamaz — spec §5.11.
- Kayıt (sign-up) ekranı yoktur; kullanıcılar geliştirici tarafından açılır — spec §3.
- Her migration `supabase/migrations/` altında; şema değişikliği asla elle dashboard'dan yapılmaz.
- Commit sıklığı: her task sonunda en az bir commit.

---

## Dosya Yapısı (hedef)

```
anaokulcrm/                      # Next.js projesi (repo kökünde alt klasör)
  app/
    login/page.tsx
    (app)/layout.tsx             # navigasyon kabuğu (auth korumalı)
    (app)/page.tsx               # Bugün ekranı
    (app)/pipeline/page.tsx
    (app)/leads/new/page.tsx
    (app)/leads/[id]/page.tsx
    (app)/takvim/page.tsx
    (app)/teklifler/page.tsx     # yönetici onay kuyruğu
    (app)/ogrenciler/page.tsx
    (app)/ogrenciler/[id]/page.tsx
    (app)/odemeler/page.tsx
    (app)/dashboard/page.tsx
    (app)/ayarlar/page.tsx
    api/cron/daily/route.ts
  lib/
    constants.ts                 # tüm enum değerleri + Türkçe etiketler
    money.ts                     # kuruş <-> TL, formatTRY
    phone.ts                     # normalizeTurkishPhone
    installments.ts              # taksit üretimi
    lead-state.ts                # lead durum makinesi
    offer-rules.ts               # teklif kuralları
    supabase/server.ts           # server component/action client
    supabase/middleware.ts       # session yenileme
  actions/                       # "use server" server action'ları
    leads.ts  appointments.ts  offers.ts  students.ts
    payments.ts  price-lists.ts  notes.ts
  components/                    # paylaşılan UI parçaları
  supabase/migrations/0001_schema.sql
  supabase/seed.sql              # lokal test kullanıcıları
  scripts/seed/parse-whatsapp.ts # tek seferlik, repoda kalır, veri içermez
  scripts/seed/parse-excel.ts
  scripts/seed/upload.ts
  tests/unit/*.test.ts
  tests/rls/*.test.ts
  vercel.json                    # cron tanımı
```

---

### Task 1: Proje iskeleti + constants + money/phone yardımcıları

**Files:**
- Create: `anaokulcrm/` (create-next-app ile), `anaokulcrm/lib/constants.ts`, `anaokulcrm/lib/money.ts`, `anaokulcrm/lib/phone.ts`
- Test: `anaokulcrm/tests/unit/money.test.ts`, `anaokulcrm/tests/unit/phone.test.ts`

**Interfaces:**
- Produces: `LEAD_STATUSES`, `LEAD_SOURCES`, `LOST_REASONS`, `OFFER_STATUSES`, `PROGRAMS`, `ITEM_TYPES`, `PAYMENT_METHODS`, `APPOINTMENT_TYPES`, `APPOINTMENT_OUTCOMES` sabitleri ve `label(group, value): string`
- Produces: `tlToKurus(tl: number): number`, `kurusToTl(k: number): number`, `formatTRY(kurus: number): string`
- Produces: `normalizeTurkishPhone(raw: string): string | null` (geçerliyse `+905XXXXXXXXX`, değilse null)

- [ ] **Step 1: Projeyi oluştur**

```bash
cd c:\Users\meert\Desktop\annem
npx create-next-app@latest anaokulcrm --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm
cd anaokulcrm
npm i @supabase/supabase-js @supabase/ssr
npm i -D vitest @vitest/coverage-v8 dotenv tsx
```

`package.json` scripts'e ekle: `"test": "vitest run", "test:watch": "vitest"`.

`vitest.config.ts` oluştur:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 2: Failing testleri yaz** — `tests/unit/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tlToKurus, kurusToTl, formatTRY } from "@/lib/money";

describe("money", () => {
  it("TL'yi kuruşa çevirir", () => {
    expect(tlToKurus(18000)).toBe(1800000);
    expect(tlToKurus(18000.5)).toBe(1800050);
  });
  it("kuruşu TL'ye çevirir", () => {
    expect(kurusToTl(1800050)).toBe(18000.5);
  });
  it("TRY formatlar", () => {
    expect(formatTRY(1800000)).toBe("18.000,00 ₺");
  });
});
```

`tests/unit/phone.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeTurkishPhone } from "@/lib/phone";

describe("normalizeTurkishPhone", () => {
  it.each([
    ["0536 656 33 96", "+905366563396"],
    ["+90 534 034 44 46", "+905340344446"],
    ["05315248234", "+905315248234"],
    ["90 541 977 66 21", "+905419776621"],
    ["5366563396", "+905366563396"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeTurkishPhone(raw)).toBe(expected);
  });
  it.each([["123"], ["02123456789"], [""], ["+4915112345678"]])(
    "geçersiz: %s -> null",
    (raw) => expect(normalizeTurkishPhone(raw)).toBeNull()
  );
});
```

- [ ] **Step 3: Testlerin FAIL ettiğini doğrula** — `npm test` → "Cannot find module '@/lib/money'" benzeri hata beklenir.

- [ ] **Step 4: Implement et** — `lib/constants.ts`:

```ts
export const LEAD_STATUSES = {
  yeni: "Yeni", ulasildi: "Ulaşıldı", randevu: "Randevu",
  gorusme_yapildi: "Görüşme Yapıldı", teklif: "Teklif",
  kazanildi: "Kazanıldı", kaybedildi: "Kaybedildi",
} as const;
export type LeadStatus = keyof typeof LEAD_STATUSES;

export const LEAD_SOURCES = {
  referans: "Referans", instagram: "Instagram", reklam: "Reklam",
  tabela_gecerken: "Tabela / Geçerken", telefon: "Telefon", diger: "Diğer",
} as const;
export type LeadSource = keyof typeof LEAD_SOURCES;

export const LOST_REASONS = {
  fiyat: "Fiyat", uzaklik: "Uzaklık", baska_okul: "Başka okul",
  ulasilamadi: "Ulaşılamadı", vazgecti: "Vazgeçti", diger: "Diğer",
} as const;
export type LostReason = keyof typeof LOST_REASONS;

export const OFFER_STATUSES = {
  onay_bekliyor: "Onay Bekliyor", onaylandi: "Onaylandı",
  revize_edildi: "Revize Edildi", reddedildi: "Reddedildi", gecersiz: "Geçersiz",
} as const;
export type OfferStatus = keyof typeof OFFER_STATUSES;

export const PROGRAMS = {
  tam_gun: "Tam Gün", yarim_gun: "Yarım Gün",
  uc_gun: "3 Gün", play_grup: "Play Grup",
} as const;
export type Program = keyof typeof PROGRAMS;

export const ITEM_TYPES = {
  aidat: "Aidat", kayit_ucreti: "Kayıt Ücreti",
  servis: "Servis", yemek: "Yemek", diger: "Diğer",
} as const;
export type ItemType = keyof typeof ITEM_TYPES;

export const PAYMENT_METHODS = {
  havale: "Havale/EFT", nakit: "Nakit", pos: "POS", diger: "Diğer",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const APPOINTMENT_TYPES = {
  okul_ziyareti: "Okul Ziyareti", telefon: "Telefon Görüşmesi",
} as const;
export const APPOINTMENT_OUTCOMES = {
  bekliyor: "Bekliyor", geldi: "Geldi", gelmedi: "Gelmedi",
  ertelendi: "Ertelendi", iptal: "İptal",
} as const;

export const STUDENT_STATUSES = {
  aktif: "Aktif", ayrildi: "Ayrıldı", mezun: "Mezun",
} as const;

export function label(group: Record<string, string>, value: string): string {
  return group[value] ?? value;
}
```

`lib/money.ts`:

```ts
export function tlToKurus(tl: number): number {
  return Math.round(tl * 100);
}
export function kurusToTl(kurus: number): number {
  return kurus / 100;
}
export function formatTRY(kurus: number): string {
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kurus / 100);
  return `${formatted} ₺`;
}
```

`lib/phone.ts`:

```ts
/** Türk cep telefonunu E.164'e normalize eder. Geçersizse null. */
export function normalizeTurkishPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let rest: string;
  if (digits.startsWith("0090")) rest = digits.slice(4);
  else if (digits.startsWith("90") && digits.length === 12) rest = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) rest = digits.slice(1);
  else if (digits.length === 10) rest = digits;
  else return null;
  if (rest.length !== 10 || !rest.startsWith("5")) return null;
  return `+90${rest}`;
}
```

- [ ] **Step 5: Testlerin PASS ettiğini doğrula** — `npm test` → 2 dosya, tümü yeşil.

- [ ] **Step 6: Commit**

```bash
git add anaokulcrm
git commit -m "feat: proje iskeleti, constants, money ve phone yardimcilari"
```

---

### Task 2: Veritabanı şeması + RLS (migration)

**Files:**
- Create: `anaokulcrm/supabase/migrations/0001_schema.sql`, `anaokulcrm/supabase/seed.sql`, `anaokulcrm/supabase/config.toml` (CLI init üretir)

**Interfaces:**
- Produces: spec §5'teki tüm tablolar, `is_yonetici()` SQL fonksiyonu, tüm RLS politikaları, indeksler. Sonraki tüm task'lar bu şemaya bağımlı.

- [ ] **Step 1: Supabase CLI'yi başlat**

```bash
cd anaokulcrm
npx supabase init
npx supabase start
```

Çıktıdaki `API URL`, `anon key`, `service_role key` değerlerini `.env.local`'e yaz:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
CRON_SECRET=dev-cron-secret
```

- [ ] **Step 2: Migration'ı yaz** — `supabase/migrations/0001_schema.sql` (tamamı):

```sql
-- Yardımcı: rol kontrolü
create or replace function public.is_yonetici() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'yonetici' and p.is_active
  );
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- 5.1 profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('yonetici','danisman')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5.7 students (leads FK verdiği için önce)
create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_month int check (birth_month between 1 and 12),
  birth_year int check (birth_year between 2010 and 2035),
  parent_name text not null,
  phone text not null,
  season text not null,
  program text not null check (program in ('tam_gun','yarim_gun','uc_gun','play_grup')),
  start_date date,
  status text not null default 'aktif' check (status in ('aktif','ayrildi','mezun')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5.2 leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  phone text not null,
  child_name text,
  child_birth_month int check (child_birth_month between 1 and 12),
  child_birth_year int check (child_birth_year between 2010 and 2035),
  source text not null check (source in ('referans','instagram','reklam','tabela_gecerken','telefon','diger')),
  source_detail text,
  status text not null default 'yeni' check (status in ('yeni','ulasildi','randevu','gorusme_yapildi','teklif','kazanildi','kaybedildi')),
  lost_reason text check (lost_reason in ('fiyat','uzaklik','baska_okul','ulasilamadi','vazgecti','diger')),
  assigned_to uuid references public.profiles(id),
  converted_student_id uuid references public.students(id),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lost_reason_required check (status <> 'kaybedildi' or lost_reason is not null)
);

-- 5.3 lead_notes (yalnızca insan notu)
create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- 5.4 appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  scheduled_at timestamptz not null,
  type text not null check (type in ('okul_ziyareti','telefon')),
  outcome text not null default 'bekliyor' check (outcome in ('bekliyor','geldi','gelmedi','ertelendi','iptal')),
  outcome_note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5.5 price_lists
create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  season text not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_active_price_list on public.price_lists ((true)) where is_active;

create table public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  program text not null check (program in ('tam_gun','yarim_gun','uc_gun','play_grup')),
  monthly_fee numeric(12,2) not null check (monthly_fee > 0),
  registration_fee numeric(12,2) not null default 0 check (registration_fee >= 0),
  unique (price_list_id, program)
);

-- 5.6 offers
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  program text not null check (program in ('tam_gun','yarim_gun','uc_gun','play_grup')),
  list_price numeric(12,2) not null,
  offered_price numeric(12,2) not null check (offered_price > 0),
  installment_count int not null default 10 check (installment_count between 1 and 12),
  note text,
  status text not null check (status in ('onay_bekliyor','onaylandi','revize_edildi','reddedildi','gecersiz')),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  counter_price numeric(12,2),
  superseded_by_offer_id uuid references public.offers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- spec §6.2: lead başına tek onay_bekliyor teklif
create unique index one_pending_offer_per_lead on public.offers (lead_id) where status = 'onay_bekliyor';

-- 5.8 payment_plans + installments
create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  season text not null,
  item_type text not null check (item_type in ('aidat','kayit_ucreti','servis','yemek','diger')),
  total_amount numeric(12,2) not null check (total_amount > 0),
  installment_count int not null check (installment_count between 1 and 12),
  source_offer_id uuid references public.offers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans(id) on delete cascade,
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'bekliyor' check (status in ('bekliyor','odendi')),
  paid_at timestamptz,
  paid_amount numeric(12,2),
  payment_method text check (payment_method in ('havale','nakit','pos','diger')),
  marked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- spec §6.3: ödendi ise ödeme alanları zorunlu
  constraint paid_fields check (
    (status = 'bekliyor' and paid_at is null and paid_amount is null and payment_method is null and marked_by is null)
    or
    (status = 'odendi' and paid_at is not null and paid_amount > 0 and payment_method is not null and marked_by is not null)
  )
);

-- 5.9 tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id),
  due_date date not null,
  title text not null,
  status text not null default 'acik' check (status in ('acik','tamamlandi')),
  auto_generated boolean not null default false,
  rule_key text, -- otomatik görev tekilleştirme: örn. 'takipsiz:<lead_id>'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_open_auto_task_per_rule on public.tasks (rule_key) where status = 'acik' and rule_key is not null;

-- 5.10 notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5.11 events (append-only)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead','offer','student','installment','appointment','price_list')),
  entity_id uuid not null,
  event_type text not null,
  actor_id uuid references public.profiles(id),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- 5.12 app_settings
create table public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values
  ('takipsizlik_gun', '3'),
  ('cakisma_dakika', '45');

-- updated_at trigger'ları
do $$ declare t text;
begin
  foreach t in array array['profiles','students','leads','appointments','price_lists','offers','payment_plans','installments','tasks']
  loop
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- İndeksler (spec §11)
create index idx_leads_status on public.leads (status);
create index idx_leads_assigned_status on public.leads (assigned_to, status);
create index idx_leads_phone on public.leads (phone);
create index idx_appointments_scheduled on public.appointments (scheduled_at);
create index idx_installments_due_status on public.installments (due_date, status);
create index idx_installments_plan on public.installments (plan_id);
create index idx_events_entity on public.events (entity_type, entity_id, created_at);
create index idx_notifications_user on public.notifications (user_id, read_at);

-- ===================== RLS =====================
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.appointments enable row level security;
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;
alter table public.offers enable row level security;
alter table public.payment_plans enable row level security;
alter table public.installments enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.events enable row level security;
alter table public.app_settings enable row level security;

-- Küçük ekip: tüm aktif kullanıcılar her şeyi OKUR
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

create policy sel_profiles on public.profiles for select using (is_staff());
create policy sel_students on public.students for select using (is_staff());
create policy sel_leads on public.leads for select using (is_staff());
create policy sel_lead_notes on public.lead_notes for select using (is_staff());
create policy sel_appointments on public.appointments for select using (is_staff());
create policy sel_price_lists on public.price_lists for select using (is_staff());
create policy sel_price_list_items on public.price_list_items for select using (is_staff());
create policy sel_offers on public.offers for select using (is_staff());
create policy sel_payment_plans on public.payment_plans for select using (is_staff());
create policy sel_installments on public.installments for select using (is_staff());
create policy sel_tasks on public.tasks for select using (is_staff());
create policy sel_notifications on public.notifications for select using (user_id = auth.uid());
create policy sel_events on public.events for select using (is_staff());
create policy sel_app_settings on public.app_settings for select using (is_staff());

-- Yazma politikaları (spec §4 yetki tablosu)
create policy ins_leads on public.leads for insert with check (is_staff());
create policy upd_leads on public.leads for update using (is_staff());
create policy del_leads on public.leads for delete using (is_yonetici());

create policy ins_lead_notes on public.lead_notes for insert with check (is_staff() and author_id = auth.uid());

create policy ins_appointments on public.appointments for insert with check (is_staff());
create policy upd_appointments on public.appointments for update using (is_staff());

create policy ins_students on public.students for insert with check (is_staff());
create policy upd_students on public.students for update using (is_staff());
create policy del_students on public.students for delete using (is_yonetici());

-- Fiyat listesi: yalnız yönetici
create policy all_price_lists on public.price_lists for all using (is_yonetici()) with check (is_yonetici());
create policy all_price_list_items on public.price_list_items for all using (is_yonetici()) with check (is_yonetici());

-- Teklifler: herkes oluşturur; karar (status değişimi) yönetici,
-- danışman yalnızca 'gecersiz'e çekebilir (supersede) — spec §6.2
create policy ins_offers on public.offers for insert with check (is_staff() and created_by = auth.uid());
create policy upd_offers_yonetici on public.offers for update using (is_yonetici());
create policy upd_offers_danisman on public.offers for update
  using (is_staff()) with check (status = 'gecersiz');

create policy ins_payment_plans on public.payment_plans for insert with check (is_staff());
create policy upd_payment_plans on public.payment_plans for update using (is_yonetici());

-- Taksit: danışman yalnızca ödendi işaretler; düzenleme/geri alma yönetici — spec §6.3
create policy ins_installments on public.installments for insert with check (is_staff());
create policy upd_installments_yonetici on public.installments for update using (is_yonetici());
create policy upd_installments_danisman on public.installments for update
  using (is_staff()) with check (status = 'odendi' and marked_by = auth.uid());

create policy ins_tasks on public.tasks for insert with check (is_staff());
create policy upd_tasks on public.tasks for update using (is_staff());

create policy ins_notifications on public.notifications for insert with check (is_staff());
create policy upd_notifications on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- events: INSERT var, UPDATE/DELETE politikası YOK (append-only, spec §5.11)
create policy ins_events on public.events for insert with check (is_staff() and actor_id = auth.uid());

-- app_settings yazma: yönetici
create policy write_app_settings on public.app_settings for all using (is_yonetici()) with check (is_yonetici());
```

- [ ] **Step 3: Lokal test kullanıcıları** — `supabase/seed.sql`:

```sql
-- Lokal geliştirme kullanıcıları (şifreler yalnızca lokal!)
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','yonetici@test.local', crypt('sifre123', gen_salt('bf')), now(), 'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','danisman@test.local', crypt('sifre123', gen_salt('bf')), now(), 'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','{"sub":"00000000-0000-0000-0000-000000000001","email":"yonetici@test.local"}','email',now(),now(),now()),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','{"sub":"00000000-0000-0000-0000-000000000002","email":"danisman@test.local"}','email',now(),now(),now());

insert into public.profiles (id, full_name, role) values
  ('00000000-0000-0000-0000-000000000001','Mehtap Hanım (Test)','yonetici'),
  ('00000000-0000-0000-0000-000000000002','Danışman (Test)','danisman');

insert into public.price_lists (id, season, is_active) values
  ('00000000-0000-0000-0000-00000000000a','2026-2027', true);
insert into public.price_list_items (price_list_id, program, monthly_fee, registration_fee) values
  ('00000000-0000-0000-0000-00000000000a','tam_gun', 22000, 5000),
  ('00000000-0000-0000-0000-00000000000a','yarim_gun', 17000, 5000),
  ('00000000-0000-0000-0000-00000000000a','uc_gun', 15000, 5000),
  ('00000000-0000-0000-0000-00000000000a','play_grup', 13000, 5000);
```

- [ ] **Step 4: Migration'ı uygula ve doğrula**

```bash
npx supabase db reset
```

Beklenen: hatasız tamamlanır. Doğrulama: `npx supabase db diff` boş çıkar; Studio'da (http://127.0.0.1:54323) 14 tablo görünür.

- [ ] **Step 5: Commit**

```bash
git add anaokulcrm/supabase
git commit -m "feat: veritabani semasi, RLS politikalari ve lokal seed"
```

---

### Task 3: RLS entegrasyon testleri

**Files:**
- Create: `anaokulcrm/tests/rls/helpers.ts`, `anaokulcrm/tests/rls/rls.test.ts`

**Interfaces:**
- Consumes: Task 2'nin şeması, seed kullanıcıları (`yonetici@test.local`, `danisman@test.local`, şifre `sifre123`)
- Produces: `clientFor(email): Promise<SupabaseClient>` test yardımcısı

- [ ] **Step 1: Test yardımcısı** — `tests/rls/helpers.ts`:

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function clientFor(email: string): Promise<SupabaseClient> {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: "sifre123" });
  if (error) throw error;
  return c;
}
export const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
```

- [ ] **Step 2: Failing RLS testleri** — `tests/rls/rls.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { clientFor, admin } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

let yon: SupabaseClient, dan: SupabaseClient;
let leadId: string, offerId: string, instId: string, eventId: string;
const DAN_ID = "00000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
  // Fixture'lar service key ile kurulur
  const { data: lead } = await admin.from("leads").insert({
    parent_name: "RLS Test Veli", phone: "+905000000001",
    source: "referans", assigned_to: DAN_ID,
  }).select().single();
  leadId = lead!.id;
  const { data: offer } = await admin.from("offers").insert({
    lead_id: leadId, created_by: DAN_ID, program: "tam_gun",
    list_price: 22000, offered_price: 18000, status: "onay_bekliyor",
  }).select().single();
  offerId = offer!.id;
  const { data: student } = await admin.from("students").insert({
    full_name: "RLS Öğrenci", parent_name: "RLS Test Veli",
    phone: "+905000000001", season: "2026-2027", program: "tam_gun",
  }).select().single();
  const { data: plan } = await admin.from("payment_plans").insert({
    student_id: student!.id, season: "2026-2027", item_type: "aidat",
    total_amount: 180000, installment_count: 1,
  }).select().single();
  const { data: inst } = await admin.from("installments").insert({
    plan_id: plan!.id, due_date: "2026-09-01", amount: 180000,
    status: "odendi", paid_at: new Date().toISOString(), paid_amount: 180000,
    payment_method: "havale", marked_by: DAN_ID,
  }).select().single();
  instId = inst!.id;
  const { data: ev } = await admin.from("events").insert({
    entity_type: "lead", entity_id: leadId, event_type: "durum_degisti",
  }).select().single();
  eventId = ev!.id;
});

describe("RLS", () => {
  it("danışman teklif onaylayamaz", async () => {
    const { data } = await dan.from("offers")
      .update({ status: "onaylandi" }).eq("id", offerId).select();
    expect(data).toEqual([]); // RLS: 0 satır etkilenir
  });
  it("yönetici teklif onaylayabilir", async () => {
    const { data, error } = await yon.from("offers")
      .update({ status: "onaylandi", decided_by: "00000000-0000-0000-0000-000000000001", decided_at: new Date().toISOString() })
      .eq("id", offerId).select();
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });
  it("danışman ödenmiş taksiti geri alamaz", async () => {
    const { data } = await dan.from("installments")
      .update({ status: "bekliyor", paid_at: null, paid_amount: null, payment_method: null, marked_by: null })
      .eq("id", instId).select();
    expect(data).toEqual([]);
  });
  it("danışman fiyat listesi değiştiremez", async () => {
    const { data } = await dan.from("price_list_items")
      .update({ monthly_fee: 1 }).eq("program", "tam_gun").select();
    expect(data).toEqual([]);
  });
  it("events UPDATE herkese kapalı (yönetici dahil)", async () => {
    const { data } = await yon.from("events")
      .update({ event_type: "degistirildi" }).eq("id", eventId).select();
    expect(data).toEqual([]);
  });
  it("events DELETE herkese kapalı", async () => {
    const { data } = await yon.from("events").delete().eq("id", eventId).select();
    expect(data).toEqual([]);
  });
  it("kaybedildi durumu lost_reason olmadan yazılamaz (CHECK)", async () => {
    const { error } = await yon.from("leads")
      .update({ status: "kaybedildi" }).eq("id", leadId);
    expect(error).not.toBeNull();
  });
  it("aynı lead'e ikinci onay_bekliyor teklif eklenemez (partial unique)", async () => {
    await admin.from("offers").insert({
      lead_id: leadId, created_by: DAN_ID, program: "tam_gun",
      list_price: 22000, offered_price: 19000, status: "onay_bekliyor",
    });
    const { error } = await admin.from("offers").insert({
      lead_id: leadId, created_by: DAN_ID, program: "tam_gun",
      list_price: 22000, offered_price: 20000, status: "onay_bekliyor",
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 3: Çalıştır** — `npm test -- tests/rls` → önce Supabase lokal ayakta olmalı (`npx supabase start`). Tümü PASS beklenir (şema Task 2'de kurulduğu için bu task'ta test-first değil test-after uygulanır; kırmızı görülen her test bir şema hatasıdır, migration düzeltilir ve `npx supabase db reset` ile tekrar denenir).

- [ ] **Step 4: Commit** — `git add anaokulcrm/tests; git commit -m "test: RLS entegrasyon testleri"`

---

### Task 4: İş mantığı kütüphaneleri (taksit, lead durum makinesi, teklif kuralları)

**Files:**
- Create: `anaokulcrm/lib/installments.ts`, `anaokulcrm/lib/lead-state.ts`, `anaokulcrm/lib/offer-rules.ts`
- Test: `anaokulcrm/tests/unit/installments.test.ts`, `anaokulcrm/tests/unit/lead-state.test.ts`, `anaokulcrm/tests/unit/offer-rules.test.ts`

**Interfaces:**
- Produces: `generateInstallments(totalKurus: number, count: number, firstDueDate: string): { dueDate: string; amountKurus: number }[]`
- Produces: `remainderInstallment(original: {dueDate: string; amountKurus: number}, paidKurus: number): {dueDate: string; amountKurus: number}`
- Produces: `canTransition(from: LeadStatus, to: LeadStatus, opts: { converted: boolean }): { ok: true } | { ok: false; reason: string }` ve `requiresLostReason(to: LeadStatus): boolean` ve `reopenTarget(): "ulasildi"`
- Produces: `isAutoApproved(offeredKurus: number, listKurus: number): boolean`, `initialOfferStatus(offeredKurus, listKurus): "onaylandi" | "onay_bekliyor"`

- [ ] **Step 1: Failing testler** — `tests/unit/installments.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateInstallments, remainderInstallment } from "@/lib/installments";

describe("generateInstallments", () => {
  it("eşit böler, kuruş farkını SON taksite ekler", () => {
    // 100.000,00 TL / 3 taksit = 33.333,33 + 33.333,33 + 33.333,34
    const r = generateInstallments(10000000, 3, "2026-09-05");
    expect(r.map((x) => x.amountKurus)).toEqual([3333333, 3333333, 3333334]);
    expect(r.reduce((s, x) => s + x.amountKurus, 0)).toBe(10000000);
  });
  it("vadeleri aylık artırır, günü korur", () => {
    const r = generateInstallments(3000000, 3, "2026-09-05");
    expect(r.map((x) => x.dueDate)).toEqual(["2026-09-05", "2026-10-05", "2026-11-05"]);
  });
  it("ay sonu taşmasını kırpar (31 Oca -> 28 Şub)", () => {
    const r = generateInstallments(2000000, 2, "2027-01-31");
    expect(r.map((x) => x.dueDate)).toEqual(["2027-01-31", "2027-02-28"]);
  });
  it("tek taksit", () => {
    expect(generateInstallments(500000, 1, "2026-09-01")).toEqual([
      { dueDate: "2026-09-01", amountKurus: 500000 },
    ]);
  });
});

describe("remainderInstallment", () => {
  it("kalan tutar için orijinal vadeyi devralan taksit üretir (spec §6.3)", () => {
    expect(remainderInstallment({ dueDate: "2026-09-05", amountKurus: 1800000 }, 1000000))
      .toEqual({ dueDate: "2026-09-05", amountKurus: 800000 });
  });
  it("tam ödemede hata fırlatır", () => {
    expect(() => remainderInstallment({ dueDate: "2026-09-05", amountKurus: 100 }, 100)).toThrow();
  });
});
```

`tests/unit/lead-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canTransition, requiresLostReason } from "@/lib/lead-state";

describe("lead durum makinesi (spec §6.1)", () => {
  it("ileri akış serbest", () => {
    expect(canTransition("yeni", "ulasildi", { converted: false }).ok).toBe(true);
    expect(canTransition("teklif", "kazanildi", { converted: false }).ok).toBe(true);
  });
  it("her aşamadan kaybedildi'ye geçilir ve neden zorunludur", () => {
    expect(canTransition("randevu", "kaybedildi", { converted: false }).ok).toBe(true);
    expect(requiresLostReason("kaybedildi")).toBe(true);
    expect(requiresLostReason("ulasildi")).toBe(false);
  });
  it("geri geçiş serbest", () => {
    expect(canTransition("teklif", "gorusme_yapildi", { converted: false }).ok).toBe(true);
  });
  it("kaybedildi'den yalnızca ulasildi'ya (yeniden aç)", () => {
    expect(canTransition("kaybedildi", "ulasildi", { converted: false }).ok).toBe(true);
    expect(canTransition("kaybedildi", "kazanildi", { converted: false }).ok).toBe(false);
  });
  it("dönüştürülmüş lead kilitli", () => {
    expect(canTransition("kazanildi", "teklif", { converted: true }).ok).toBe(false);
  });
});
```

`tests/unit/offer-rules.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isAutoApproved, initialOfferStatus } from "@/lib/offer-rules";

describe("teklif kuralları (spec §5.6, §6.2)", () => {
  it("liste fiyatı ve üzeri otomatik onay", () => {
    expect(isAutoApproved(2200000, 2200000)).toBe(true);
    expect(isAutoApproved(2300000, 2200000)).toBe(true);
  });
  it("indirimli teklif onay bekler", () => {
    expect(isAutoApproved(1800000, 2200000)).toBe(false);
    expect(initialOfferStatus(1800000, 2200000)).toBe("onay_bekliyor");
    expect(initialOfferStatus(2200000, 2200000)).toBe("onaylandi");
  });
});
```

- [ ] **Step 2: FAIL doğrula** — `npm test` → 3 yeni dosya modül bulunamadı hatasıyla düşer.

- [ ] **Step 3: Implement** — `lib/installments.ts`:

```ts
export interface InstallmentDraft { dueDate: string; amountKurus: number }

function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Toplamı eşit böler; kuruş farkı SON taksite eklenir (spec §12). */
export function generateInstallments(totalKurus: number, count: number, firstDueDate: string): InstallmentDraft[] {
  if (count < 1 || totalKurus <= 0) throw new Error("Geçersiz plan parametreleri");
  const base = Math.floor(totalKurus / count);
  const remainder = totalKurus - base * count;
  return Array.from({ length: count }, (_, i) => ({
    dueDate: addMonthsClamped(firstDueDate, i),
    amountKurus: i === count - 1 ? base + remainder : base,
  }));
}

/** Kısmi ödemede kalan için, orijinal vadeyi devralan taksit (spec §6.3). */
export function remainderInstallment(
  original: InstallmentDraft, paidKurus: number
): InstallmentDraft {
  const remaining = original.amountKurus - paidKurus;
  if (remaining <= 0) throw new Error("Kalan tutar yok");
  return { dueDate: original.dueDate, amountKurus: remaining };
}
```

`lib/lead-state.ts`:

```ts
import type { LeadStatus } from "./constants";

const FLOW: LeadStatus[] = ["yeni", "ulasildi", "randevu", "gorusme_yapildi", "teklif", "kazanildi"];

export function requiresLostReason(to: LeadStatus): boolean {
  return to === "kaybedildi";
}
export function reopenTarget(): "ulasildi" {
  return "ulasildi";
}

export function canTransition(
  from: LeadStatus, to: LeadStatus, opts: { converted: boolean }
): { ok: true } | { ok: false; reason: string } {
  if (opts.converted) return { ok: false, reason: "Öğrenciye dönüştürülmüş lead kilitlidir" };
  if (from === to) return { ok: false, reason: "Durum zaten bu" };
  if (to === "kaybedildi") return { ok: true };
  if (from === "kaybedildi") {
    return to === reopenTarget()
      ? { ok: true }
      : { ok: false, reason: "Kaybedilen lead yalnızca 'Ulaşıldı' olarak yeniden açılabilir" };
  }
  // ileri veya geri geçiş FLOW içinde serbest (spec §6.1)
  if (FLOW.includes(from) && FLOW.includes(to)) return { ok: true };
  return { ok: false, reason: "Geçersiz durum geçişi" };
}
```

`lib/offer-rules.ts`:

```ts
import type { OfferStatus } from "./constants";

/** spec §5.6: liste fiyatı ve üzeri otomatik onaylanır. */
export function isAutoApproved(offeredKurus: number, listKurus: number): boolean {
  return offeredKurus >= listKurus;
}
export function initialOfferStatus(offeredKurus: number, listKurus: number): Extract<OfferStatus, "onaylandi" | "onay_bekliyor"> {
  return isAutoApproved(offeredKurus, listKurus) ? "onaylandi" : "onay_bekliyor";
}
```

- [ ] **Step 4: PASS doğrula** — `npm test` → tüm birim testleri yeşil.
- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: taksit uretimi, lead durum makinesi ve teklif kurallari (TDD)"`

---

### Task 5: Supabase client'ları, auth middleware ve giriş ekranı

**Files:**
- Create: `anaokulcrm/lib/supabase/server.ts`, `anaokulcrm/lib/supabase/middleware.ts`, `anaokulcrm/middleware.ts`, `anaokulcrm/app/login/page.tsx`, `anaokulcrm/actions/auth.ts`, `anaokulcrm/lib/auth.ts`
- Modify: `anaokulcrm/app/layout.tsx` (html lang="tr")

**Interfaces:**
- Produces: `createServerSupabase(): Promise<SupabaseClient>` (cookie tabanlı, RLS'li)
- Produces: `getSessionProfile(): Promise<{ id: string; full_name: string; role: "yonetici" | "danisman" }>` — oturum yoksa `redirect("/login")`
- Produces: `signIn(formData)`, `signOut()` server action'ları

- [ ] **Step 1: Client'lar** — `lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* Server Component içinde çağrıldıysa middleware halleder */ }
        },
      },
    }
  );
}
```

`lib/auth.ts`:

```ts
import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";

export interface SessionProfile { id: string; full_name: string; role: "yonetici" | "danisman" }

export async function getSessionProfile(): Promise<SessionProfile> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("id, full_name, role, is_active").eq("id", user.id).single();
  if (!profile || !profile.is_active) redirect("/login");
  return profile as SessionProfile;
}
```

`lib/supabase/middleware.ts` — @supabase/ssr dokümanındaki standart `updateSession` deseni; `middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
```

`lib/supabase/middleware.ts` içeriği:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}
```

- [ ] **Step 2: Auth action'ları** — `actions/auth.ts`:

```ts
"use server";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export async function signIn(_prev: { error?: string } | null, formData: FormData) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) return { error: "E-posta veya şifre hatalı" };
  redirect("/");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 3: Giriş sayfası** — `app/login/page.tsx` (client component, `useActionState` ile `signIn`; e-posta + şifre alanı, Türkçe etiketler, hata mesajı gösterimi, mobil uyumlu ortalanmış kart). `app/layout.tsx`'te `<html lang="tr">` yap.

- [ ] **Step 4: Manuel doğrula** — `npm run dev`; `/login`'de `yonetici@test.local / sifre123` ile giriş → `/`'e yönlenir; çıkışsız `/pipeline` isteği → `/login`'e yönlenir.

- [ ] **Step 5: Commit** — `git add -A; git commit -m "feat: supabase auth, middleware ve giris ekrani"`

---

### Task 6: Events yardımcısı + lead server action'ları

**Files:**
- Create: `anaokulcrm/lib/events.ts`, `anaokulcrm/actions/leads.ts`, `anaokulcrm/actions/notes.ts`

**Interfaces:**
- Consumes: `canTransition`, `requiresLostReason` (Task 4), `normalizeTurkishPhone` (Task 1), `getSessionProfile` (Task 5)
- Produces: `logEvent(supabase, e: { entityType: string; entityId: string; eventType: string; actorId: string; payload?: object }): Promise<void>`
- Produces server actions: `createLead(input)`, `updateLeadStatus(leadId, to, lostReason?)`, `reopenLead(leadId)`, `updateLead(leadId, fields)`, `addNote(leadId, body)`
- Produces: `findLeadByPhone(phone): Promise<{ leadId?: string; studentId?: string }>` (tekrarlı kayıt uyarısı için)

- [ ] **Step 1: `lib/events.ts`:**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function logEvent(supabase: SupabaseClient, e: {
  entityType: "lead" | "offer" | "student" | "installment" | "appointment" | "price_list";
  entityId: string; eventType: string; actorId: string; payload?: object;
}): Promise<void> {
  const { error } = await supabase.from("events").insert({
    entity_type: e.entityType, entity_id: e.entityId,
    event_type: e.eventType, actor_id: e.actorId, payload: e.payload ?? {},
  });
  if (error) throw new Error(`Event yazılamadı: ${error.message}`);
}
```

- [ ] **Step 2: `actions/leads.ts`:**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { normalizeTurkishPhone } from "@/lib/phone";
import { canTransition, requiresLostReason, reopenTarget } from "@/lib/lead-state";
import { logEvent } from "@/lib/events";
import type { LeadStatus, LeadSource, LostReason } from "@/lib/constants";

export interface CreateLeadInput {
  parentName: string; phone: string; source: LeadSource; sourceDetail?: string;
  childName?: string; childBirthMonth?: number; childBirthYear?: number;
}

export async function createLead(input: CreateLeadInput) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const phone = normalizeTurkishPhone(input.phone);
  if (!phone) return { error: "Geçerli bir cep telefonu girin (05XX XXX XX XX)" };
  const { data, error } = await supabase.from("leads").insert({
    parent_name: input.parentName.trim(), phone,
    source: input.source, source_detail: input.sourceDetail || null,
    child_name: input.childName || null,
    child_birth_month: input.childBirthMonth || null,
    child_birth_year: input.childBirthYear || null,
    assigned_to: profile.id,
  }).select("id").single();
  if (error) return { error: "Lead kaydedilemedi, lütfen tekrar deneyin" };
  await logEvent(supabase, {
    entityType: "lead", entityId: data.id, eventType: "lead_olusturuldu",
    actorId: profile.id, payload: { source: input.source },
  });
  revalidatePath("/pipeline");
  return { id: data.id };
}

export async function findLeadByPhone(rawPhone: string) {
  const supabase = await createServerSupabase();
  const phone = normalizeTurkishPhone(rawPhone);
  if (!phone) return {};
  const [{ data: lead }, { data: student }] = await Promise.all([
    supabase.from("leads").select("id").eq("phone", phone).limit(1).maybeSingle(),
    supabase.from("students").select("id").eq("phone", phone).limit(1).maybeSingle(),
  ]);
  return { leadId: lead?.id, studentId: student?.id };
}

export async function updateLeadStatus(leadId: string, to: LeadStatus, lostReason?: LostReason) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const { data: lead } = await supabase.from("leads")
    .select("status, converted_student_id").eq("id", leadId).single();
  if (!lead) return { error: "Lead bulunamadı" };
  const check = canTransition(lead.status as LeadStatus, to, {
    converted: lead.converted_student_id !== null,
  });
  if (!check.ok) return { error: check.reason };
  if (requiresLostReason(to) && !lostReason) return { error: "Kayıp nedeni zorunludur" };
  const { error } = await supabase.from("leads").update({
    status: to,
    lost_reason: to === "kaybedildi" ? lostReason : null,
    last_activity_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (error) return { error: "Durum güncellenemedi" };
  await logEvent(supabase, {
    entityType: "lead", entityId: leadId, eventType: "durum_degisti",
    actorId: profile.id, payload: { from: lead.status, to, lostReason: lostReason ?? null },
  });
  revalidatePath("/pipeline");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function reopenLead(leadId: string) {
  return updateLeadStatus(leadId, reopenTarget());
}
```

`actions/notes.ts` — `addNote(leadId, body)`: boş gövdeyi reddeder, `lead_notes`'a ekler, `leads.last_activity_at`'i günceller, `revalidatePath`.

- [ ] **Step 3: Doğrula** — `npx tsc --noEmit` temiz; lint temiz (`npm run lint`).
- [ ] **Step 4: Commit** — `git commit -am "feat: event log yardimcisi ve lead server actionlari"`

---

### Task 7: Uygulama kabuğu + Pipeline (kanban) + Yeni lead formu

**Files:**
- Create: `anaokulcrm/app/(app)/layout.tsx`, `anaokulcrm/components/nav.tsx`, `anaokulcrm/app/(app)/pipeline/page.tsx`, `anaokulcrm/components/lead-card.tsx`, `anaokulcrm/components/status-select.tsx`, `anaokulcrm/app/(app)/leads/new/page.tsx`

**Interfaces:**
- Consumes: `createLead`, `updateLeadStatus`, `findLeadByPhone` (Task 6); `LEAD_STATUSES`, `LEAD_SOURCES`, `LOST_REASONS` (Task 1)
- Produces: `(app)` route group — tüm sonraki ekranlar bu layout altına eklenir. Alt navigasyon (mobil) / kenar navigasyon (desktop): Bugün, Pipeline, Takvim, Öğrenciler, Ödemeler, Dashboard, (yönetici: Teklifler, Ayarlar).

- [ ] **Step 1: Kabuk** — `(app)/layout.tsx`: `getSessionProfile()` çağırır, `nav.tsx`'e `role` geçer; mobilde alt tab bar (5 ana sekme + "…" menüsü), desktop'ta sol kenar çubuğu; sağ üstte kullanıcı adı ve çıkış butonu (`signOut`).

- [ ] **Step 2: Pipeline sayfası** — Server component; açık lead'leri çeker (`status not in ('kazanildi','kaybedildi')`, `order by last_activity_at desc`) ve 5 açık durum sütununda listeler. Sayfa üstünde "Kazanılan/Kaybedilen arşivi" linkiyle `?arsiv=1` görünümü (kapalı lead'ler, sayfalı 50 kayıt). Filtreler: `?danisman=`, `?kaynak=` query paramları. Kart: `components/lead-card.tsx` — veli adı, çocuk (ad + ay/yıl), kaynak rozeti, atanan danışman, son aktivite tarihi, `status-select`.

- [ ] **Step 3: Durum değiştirici** — `components/status-select.tsx` (client): mevcut duruma göre `canTransition` ile geçilebilir durumları listeler; `kaybedildi` seçilirse zorunlu neden modal'ı açar (`LOST_REASONS` seçenekleri); `updateLeadStatus` action'ını çağırır, hata dönerse Türkçe toast gösterir; istek sırasında buton disabled + "Kaydediliyor…".

- [ ] **Step 4: Yeni lead formu** — `/leads/new`: veli adı*, telefon*, kaynak* (+kaynak detayı), çocuk adı, doğum ay/yıl (select'ler). Telefon alanı blur olduğunda `findLeadByPhone` çağrılır; eşleşme varsa sarı uyarı kutusu: "Bu numara kayıtlı: [lead/öğrenci linki]" (engellemez). Başarıda `/leads/[id]`'ye yönlenir.

- [ ] **Step 5: Manuel doğrula** — dev server'da: yeni lead oluştur → pipeline'da "Yeni" sütununda görünür → durumu "Kaybedildi"ye çek → neden modalı zorunlu → arşiv görünümünde listelenir → "Yeniden Aç" → "Ulaşıldı" sütununa döner. Mobil genişlikte (375px) sütunlar yatay kaydırılır.

- [ ] **Step 6: Commit** — `git commit -am "feat: uygulama kabugu, pipeline kanban ve yeni lead formu"`

---

### Task 8: Lead detay sayfası (aktivite akışı, notlar)

**Files:**
- Create: `anaokulcrm/app/(app)/leads/[id]/page.tsx`, `anaokulcrm/components/activity-feed.tsx`, `anaokulcrm/components/note-form.tsx`

**Interfaces:**
- Consumes: `addNote` (Task 6); `events` + `lead_notes` tabloları
- Produces: Lead detay route'u — Task 9 (randevular) ve Task 10 (teklifler) bu sayfaya sekme ekler.

- [ ] **Step 1: Sayfa** — Üst özet kart: veli adı, `tel:+90…` ve `https://wa.me/905…` (başında + olmadan) ikon linkleri, çocuk bilgisi, kaynak, danışman, durum (status-select ile değiştirilebilir). `converted_student_id` doluysa durum kilitli, "Öğrenci kaydına git" linki gösterilir.

- [ ] **Step 2: Aktivite akışı** — `activity-feed.tsx`: `lead_notes` + `events` (entity_type='lead', entity_id=id) birleşimi `created_at desc`; event'ler gri sistem satırı ("Durum değişti: Yeni → Ulaşıldı — Rüya, 8 Tem 14:30"), notlar konuşma balonu. Event tiplerinin Türkçe cümleleri `lib/constants.ts`'e `EVENT_LABELS` olarak eklenir.

- [ ] **Step 3: Not formu** — `note-form.tsx` (client): textarea + "Not Ekle"; boş gönderim engellenir; gönderim sırasında disabled.

- [ ] **Step 4: Manuel doğrula** — lead detayında not ekle → akışta görünür; durum değiştir → sistem satırı düşer; wa.me linki doğru numarayla açılır.

- [ ] **Step 5: Commit** — `git commit -am "feat: lead detay sayfasi ve aktivite akisi"`

---

### Task 9: Randevular + takvim

**Files:**
- Create: `anaokulcrm/actions/appointments.ts`, `anaokulcrm/components/appointment-form.tsx`, `anaokulcrm/components/appointment-list.tsx`, `anaokulcrm/app/(app)/takvim/page.tsx`
- Modify: `anaokulcrm/app/(app)/leads/[id]/page.tsx` (Randevular sekmesi)

**Interfaces:**
- Consumes: lead detay sayfası (Task 8), `logEvent` (Task 6)
- Produces: `createAppointment(leadId, scheduledAtIso, type): Promise<{ error?: string; conflict?: { leadName: string; at: string } }>`, `setAppointmentOutcome(id, outcome, note?)`

- [ ] **Step 1: `actions/appointments.ts`** — `createAppointment`: `app_settings.cakisma_dakika` (45) penceresi içinde `outcome='bekliyor'` başka randevu var mı diye sorgular; varsa `conflict` bilgisiyle döner (UI onay ister, `force=true` ile tekrar çağrılınca kaydeder — spec §5.4 "uyarır, engellemez"). Kayıt sonrası `logEvent('appointment','randevu_olusturuldu')` + lead `last_activity_at` güncellenir; lead durumu `yeni/ulasildi` ise `randevu`ya çekilir (updateLeadStatus üzerinden). `setAppointmentOutcome`: outcome günceller, event yazar; `gelmedi` ise ertesi güne `tasks` kaydı ekler (`rule_key='noshow:<appointmentId>'`, title "Yeniden ara / randevu ver").

- [ ] **Step 2: Lead detayına Randevular sekmesi** — geçmiş + gelecek randevular listesi, `bekliyor` olanlara sonuç butonları (Geldi/Gelmedi/Ertelendi/İptal), yeni randevu formu (tarih-saat `datetime-local`, tür seçimi).

- [ ] **Step 3: Takvim sayfası** — `/takvim`: hafta seçici (`?hafta=2026-W28`), Pzt–Cum günlük gruplu liste; her satır: saat, veli adı (lead linki), tür, sonuç rozeti. Mobilde tek sütun gün listesi.

- [ ] **Step 4: Manuel doğrula** — randevu oluştur → lead durumu `randevu` olur; aynı saate ikinci randevu → çakışma uyarısı çıkar, onayla kaydolur; `gelmedi` işaretle → Bugün ekranı (Task 13) görev datası oluşur (DB'de `tasks` satırını Studio'dan doğrula).

- [ ] **Step 5: Commit** — `git commit -am "feat: randevu yonetimi ve takvim ekrani"`

---

### Task 10: Teklifler + onay kuyruğu + bildirimler

**Files:**
- Create: `anaokulcrm/actions/offers.ts`, `anaokulcrm/actions/notifications.ts`, `anaokulcrm/components/offer-form.tsx`, `anaokulcrm/components/offer-list.tsx`, `anaokulcrm/app/(app)/teklifler/page.tsx`, `anaokulcrm/components/notification-bell.tsx`
- Modify: lead detay (Teklifler sekmesi), `(app)/layout.tsx` (zil ikonu)

**Interfaces:**
- Consumes: `initialOfferStatus` (Task 4), `logEvent` (Task 6), price_list_items (Task 2)
- Produces: `createOffer(leadId, program, offeredPriceTl, installmentCount, note?)`, `decideOffer(offerId, decision: "onaylandi" | "reddedildi", counterPriceTl?)`, `createOfferFromCounter(offerId)`, `notify(userId, type, payload)`, `markNotificationsRead()`
- Produces: lead'in aktif onaylı teklifi — Task 11 dönüştürmede kullanır: `getApprovedOffer(leadId)`

- [ ] **Step 1: `actions/offers.ts`** — `createOffer`:
  1. Aktif fiyat listesinden `list_price` çeker (programa göre); bulunamazsa hata.
  2. `initialOfferStatus(tlToKurus(offered), tlToKurus(list))` ile status belirler.
  3. Statüsü `onaylandi` doğan teklif için: lead'in önceki `onaylandi` teklifi varsa `gecersiz` + `superseded_by_offer_id` set edilir (spec §6.2).
  4. `onay_bekliyor` doğduysa tüm yöneticilere `notify('teklif_onay_bekliyor', {leadId, offerId, offered})`.
  5. Event: `teklif_olusturuldu`. Partial unique ihlali (23505) yakalanır → "Bu lead için zaten onay bekleyen bir teklif var".
  `decideOffer` (yalnız yönetici — RLS zaten korur, UI'da da rol kontrolü):
  - `onaylandi`: önceki onaylı teklif varsa supersede; event `teklif_onaylandi`; danışmana `notify('teklifiniz_onaylandi')`. Lead durumu `teklif` değilse `teklif`e çekilir.
  - `reddedildi`: event + bildirim.
  - `counterPriceTl` verildiyse: status `revize_edildi`, `counter_price` yazılır; event `teklif_revize_edildi`; danışmana bildirim.
  `createOfferFromCounter(offerId)`: revize edilmiş tekliften `counter_price` ile **otomatik `onaylandi`** yeni teklif oluşturur (spec §6.2), eski aktif onaylıyı supersede eder.

- [ ] **Step 2: UI** — Lead detayı Teklifler sekmesi: teklif geçmişi (status rozetleri, fiyatlar `formatTRY`, indirim %'si), aktif teklif vurgulu; `offer-form.tsx`: program seçimi (liste fiyatını otomatik gösterir), teklif tutarı, taksit sayısı (1-12), not. Revize edilmiş teklifte "Karşı rakamla teklif oluştur (X ₺)" butonu. `/teklifler` (yönetici): `onay_bekliyor` teklifler; satırda veli/çocuk/danışman/liste fiyatı/teklif/indirim%; Onayla / Karşı Rakam (input'lu popover) / Reddet.

- [ ] **Step 3: Bildirimler** — `actions/notifications.ts`: `notify` (insert), `markNotificationsRead`. `notification-bell.tsx`: layout header'da; okunmamış sayısı rozeti; tıklayınca son 20 bildirim listesi, tıklanan ilgili sayfaya gider ve okundu işaretlenir. 30 sn'de bir `router.refresh()` ile tazelenir (polling; realtime YAGNI).

- [ ] **Step 4: Manuel doğrula** — danışman hesabıyla indirimli teklif → yönetici zilinde bildirim → `/teklifler`'de karşı rakam ver → danışman hesabında bildirim + "Karşı rakamla teklif oluştur" → yeni teklif otomatik onaylı, eski `revize_edildi`. Liste fiyatına eşit teklif → onay kuyruğuna düşmeden `onaylandi`.

- [ ] **Step 5: Commit** — `git commit -am "feat: teklif akisi, yonetici onay kuyrugu ve bildirimler"`

---

### Task 11: Öğrenciye dönüştürme + ödeme planları + taksit işlemleri

**Files:**
- Create: `anaokulcrm/actions/students.ts`, `anaokulcrm/actions/payments.ts`, `anaokulcrm/app/(app)/ogrenciler/page.tsx`, `anaokulcrm/app/(app)/ogrenciler/[id]/page.tsx`, `anaokulcrm/components/plan-wizard.tsx`, `anaokulcrm/components/installment-table.tsx`

**Interfaces:**
- Consumes: `generateInstallments`, `remainderInstallment` (Task 4), `getApprovedOffer` (Task 10), `logEvent`
- Produces: `convertLeadToStudent(leadId, startDate)`, `createPaymentPlan(studentId, itemType, totalTl, count, firstDueDate, sourceOfferId?)`, `markInstallmentPaid(id, paidTl, method, paidAtIso)`, `revertInstallment(id)` (yönetici), `updateInstallment(id, {amountTl?, dueDate?})` (yönetici, plan toplamı invariant kontrolü ile)

- [ ] **Step 1: `convertLeadToStudent`** — spec §6.2 kuralı: lead'de `onaylandi` teklif yoksa hata döner. Adımlar: students insert (lead alanlarından kopya + onaylı teklifin programı) → leads.converted_student_id set + status `kazanildi` → event `ogrenciye_donusturuldu` → dönüş `{ studentId }`. UI onaylı teklifin aidat tutarı ve taksit sayısıyla plan sihirbazına yönlendirir.

- [ ] **Step 2: `createPaymentPlan`** — `generateInstallments(tlToKurus(totalTl), count, firstDueDate)` ile taksitleri üretir; plan + taksitler tek transaction'da (Supabase rpc yerine: önce plan insert, taksit insert'i hata verirse plan silinir). Event `plan_olusturuldu`.

- [ ] **Step 3: Taksit action'ları** —
  - `markInstallmentPaid`: taksit `bekliyor` olmalı. `paidTl < amount` ise: taksitin `amount`'ı `paidTl`'ye düşürülür + `remainderInstallment` ile kalan için yeni `bekliyor` taksit eklenir (plan toplamı korunur, spec §6.3). Sonra status `odendi`, `paid_*` alanları set. Event `taksit_odendi`.
  - `revertInstallment` (yönetici): `bekliyor`a döndürür, `paid_*` temizler, event `odeme_geri_alindi`.
  - `updateInstallment` (yönetici): yeni tutarlarla plan taksitleri toplamı `total_amount`'a eşit değilse `{ error: "Taksit toplamı plan toplamına eşit olmalı (fark: X ₺)" }`.

- [ ] **Step 4: UI** — `/ogrenciler`: arama (ad/veli/telefon) + durum filtresi; satır: öğrenci, program, sezon, ödeme özeti (ödenen/toplam, geciken rozeti). `/ogrenciler/[id]`: bilgi kartı + plan listesi + `installment-table.tsx`: vade, tutar, durum (geciken = `bekliyor` ve `due_date < bugün` → kırmızı satır), "Ödendi işaretle" (tutar önddolu + yöntem + tarih modal'ı), yönetici için satır menüsünde Düzenle / Geri Al. `plan-wizard.tsx`: kalem tipi, toplam tutar, taksit sayısı, ilk vade → önizleme tablosu (üretilecek taksitler) → onayla.

- [ ] **Step 5: Manuel doğrula** — kazanılmış lead'i dönüştür (onaylı teklif yoksa hata mesajını gör) → 10 taksitli aidat planı oluştur, önizlemede son taksitin kuruş farkını gör → bir taksite kısmi ödeme işle → kalan taksit satırı oluştu ve toplam değişmedi → danışman hesabıyla geri alma butonunun görünmediğini doğrula.

- [ ] **Step 6: Commit** — `git commit -am "feat: ogrenciye donusturme, odeme planlari ve taksit islemleri"`

---

### Task 12: Ödemeler genel ekranı

**Files:**
- Create: `anaokulcrm/app/(app)/odemeler/page.tsx`

**Interfaces:**
- Consumes: installments + payment_plans + students (join)

- [ ] **Step 1: Sayfa** — Üç bölüm (server component, tek sorgu + gruplama): **Geciken** (`bekliyor` ve `due_date < bugün`, kırmızı, gün gecikmesiyle), **Bu hafta vadesi gelen**, **Bu ay beklenen**. Her satır: öğrenci (link), kalem tipi, vade, tutar; bölüm başlıklarında `formatTRY` toplam. Üstte özet kartlar: "Bu ay beklenen", "Bu ay tahsil edilen" (`paid_at` bu ay), "Toplam geciken".

- [ ] **Step 2: Manuel doğrula** — Task 11'de üretilen planla: geçmiş vadeli taksit ekle (Studio'dan due_date'i düne çek) → Geciken bölümünde görünür; ödendi işaretle → "Bu ay tahsil edilen" artar.

- [ ] **Step 3: Commit** — `git commit -am "feat: odemeler genel takip ekrani"`

---

### Task 13: Bugün ekranı + günlük cron

**Files:**
- Create: `anaokulcrm/app/(app)/page.tsx` (Bugün), `anaokulcrm/app/api/cron/daily/route.ts`, `anaokulcrm/vercel.json`, `anaokulcrm/actions/tasks.ts`

**Interfaces:**
- Consumes: tasks, appointments, leads, installments, notifications
- Produces: `completeTask(id)` action; `GET /api/cron/daily` (Authorization: `Bearer <CRON_SECRET>`)

- [ ] **Step 1: Cron route** — `app/api/cron/daily/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }); // YYYY-MM-DD

  // Kural 1 (spec §8.1): takipsiz lead görevleri
  const { data: settings } = await db.from("app_settings").select("value").eq("key", "takipsizlik_gun").single();
  const days = Number(settings?.value ?? 3);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const { data: staleLeads } = await db.from("leads")
    .select("id, parent_name, assigned_to")
    .in("status", ["yeni", "ulasildi", "gorusme_yapildi", "teklif"])
    .lt("last_activity_at", cutoff).not("assigned_to", "is", null);
  for (const l of staleLeads ?? []) {
    await db.from("tasks").upsert({
      lead_id: l.id, assigned_to: l.assigned_to, due_date: today,
      title: `Takip et: ${l.parent_name} (${days}+ gündür işlem yok)`,
      auto_generated: true, rule_key: `takipsiz:${l.id}`,
    }, { onConflict: "rule_key", ignoreDuplicates: true });
  }

  // Kural 2 (spec §8.2): bugünkü randevu bildirimleri
  const dayStart = `${today}T00:00:00+03:00`, dayEnd = `${today}T23:59:59+03:00`;
  const { data: appts } = await db.from("appointments")
    .select("id, scheduled_at, lead_id, created_by, leads(parent_name)")
    .eq("outcome", "bekliyor").gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd);
  const { data: yoneticiler } = await db.from("profiles").select("id").eq("role", "yonetici").eq("is_active", true);
  for (const a of appts ?? []) {
    const targets = new Set([a.created_by, ...(yoneticiler ?? []).map((y) => y.id)]);
    for (const uid of targets) {
      await db.from("notifications").insert({
        user_id: uid, type: "randevu_bugun",
        payload: { appointmentId: a.id, leadId: a.lead_id, at: a.scheduled_at },
      });
    }
  }

  // Kural 5 (spec §8.5): Pazartesi geciken özeti (yöneticilere)
  const isMonday = new Date().toLocaleDateString("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }) === "Mon";
  if (isMonday) {
    const { data: overdue } = await db.from("installments")
      .select("amount").eq("status", "bekliyor").lt("due_date", today);
    const total = (overdue ?? []).reduce((s, i) => s + Number(i.amount), 0);
    if (total > 0) for (const y of yoneticiler ?? []) {
      await db.from("notifications").insert({
        user_id: y.id, type: "geciken_ozet",
        payload: { count: overdue!.length, totalTl: total },
      });
    }
  }
  return NextResponse.json({ ok: true, staleLeads: staleLeads?.length ?? 0, appts: appts?.length ?? 0 });
}
```

`vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 3 * * *" }] }
```

(03:00 UTC = 06:00 TR — spec §12.)

- [ ] **Step 2: Bugün ekranı** — `(app)/page.tsx`: (a) bugünkü randevular (saat sırasıyla, lead linki, sonuç butonları), (b) açık görevler (`tasks.status='acik'`, `assigned_to=ben`; yönetici hepsini görür) + "Tamamla" butonu (`completeTask`), (c) 3+ gün işlem görmemiş lead listesi (canlı sorgu — cron beklemeden görünür), (d) yalnız yönetici: onay bekleyen teklif sayısı kartı (linkli) + geciken taksit toplamı kartı.

- [ ] **Step 3: Manuel doğrula** — `curl -H "Authorization: Bearer dev-cron-secret" http://localhost:3000/api/cron/daily` → `{ok:true,...}`; Studio'dan bir lead'in `last_activity_at`'ini 4 gün geriye çek, cron'u tekrar çağır → görev oluşur, ikinci çağrıda kopyalanmaz (rule_key unique). Yanlış secret → 401.

- [ ] **Step 4: Commit** — `git commit -am "feat: bugun ekrani ve gunluk cron gorev uretimi"`

---

### Task 14: Dashboard

**Files:**
- Create: `anaokulcrm/app/(app)/dashboard/page.tsx`, `anaokulcrm/lib/queries/dashboard.ts`

**Interfaces:**
- Consumes: leads, events, offers, installments
- Produces: `getFunnel(monthIso)`, `getSourceConversion()`, `getLostReasons()`, `getPaymentSummary(monthIso)` sorgu fonksiyonları (server-only, canlı SQL — spec §11)

- [ ] **Step 1: Sorgular** — `lib/queries/dashboard.ts`: her fonksiyon `createServerSupabase` alır.
  - `getFunnel`: seçili ayda oluşturulan lead sayısı; bu lead'lerden randevusu olanlar; `gorusme_yapildi`+ötesine geçenler (events `durum_degisti` payload'ından); `kazanildi` olanlar. Dönüş: `{ leads, randevu, gorusme, kayit }` + oranlar UI'da hesaplanır.
  - `getSourceConversion`: tüm lead'ler kaynak bazında `{ source, total, won }`.
  - `getLostReasons`: `kaybedildi` lead'lerin `lost_reason` dağılımı.
  - `getPaymentSummary`: bu ay vadesi gelen toplam, bu ay `paid_at` toplamı, tüm geciken toplamı.
  - Yalnız yönetici için `getConsultantBreakdown`: danışman bazında lead/kayıt sayısı (spec §4 — danışmana gösterilmez).

- [ ] **Step 2: Sayfa** — Ay seçici (`?ay=2026-07`); metrik kartları + basit yatay bar'lar (kütüphanesiz, Tailwind div genişlikleriyle — grafik kütüphanesi YAGNI). Funnel: 4 aşamalı sayı + dönüşüm yüzdeleri. Kaynak tablosu: kaynak, lead, kayıt, dönüşüm %. Kayıp nedenleri: bar listesi. Ödeme özeti kartları. Danışman kırılımı bölümü `role==='yonetici'` koşullu.

- [ ] **Step 3: Manuel doğrula** — seed edilmiş test verileriyle sayıların Studio'daki SQL sonuçlarıyla eşleştiğini 2 örnek sorguda karşılaştır (ör. `select count(*) from leads where status='kazanildi'`). Danışman hesabında danışman kırılımının görünmediğini doğrula.

- [ ] **Step 4: Commit** — `git commit -am "feat: dashboard funnel, kaynak donusumu ve odeme ozeti"`

---

### Task 15: Ayarlar (sezon + fiyat listesi yönetimi)

**Files:**
- Create: `anaokulcrm/app/(app)/ayarlar/page.tsx`, `anaokulcrm/actions/price-lists.ts`

**Interfaces:**
- Consumes: price_lists, price_list_items (Task 2), `logEvent`
- Produces: `createSeason(season)`, `setActiveSeason(id)`, `upsertPriceItem(priceListId, program, monthlyFeeTl, registrationFeeTl)`

- [ ] **Step 1: Action'lar** — `setActiveSeason`: önce tümünü `is_active=false`, sonra hedefi `true` (unique partial index tek aktif garantiler); event `fiyat_listesi_guncellendi`. `upsertPriceItem`: unique (price_list_id, program) üzerinden upsert; event yazar (eski/yeni fiyat payload'da).

- [ ] **Step 2: Sayfa** — Yalnız yönetici (layout nav'ında koşullu + sayfada `role` kontrolü, danışman gelirse `/`'e redirect). Sezon listesi + "Yeni sezon" + aktif işaretleme; aktif sezonun 4 program satırı düzenlenebilir tablo (aylık aidat, kayıt ücreti TL input'ları).

- [ ] **Step 3: Manuel doğrula** — fiyat değiştir → `events`'te kaydı gör; yeni teklif formunda güncel liste fiyatının geldiğini doğrula; danışman hesabıyla `/ayarlar` → redirect.

- [ ] **Step 4: Commit** — `git commit -am "feat: sezon ve fiyat listesi yonetimi"`

---

### Task 16: Tek seferlik seed script'leri (WhatsApp + Excel)

**Files:**
- Create: `anaokulcrm/scripts/seed/parse-whatsapp.ts`, `anaokulcrm/scripts/seed/parse-excel.ts`, `anaokulcrm/scripts/seed/upload.ts`, `anaokulcrm/scripts/seed/README.md`

**Interfaces:**
- Consumes: `normalizeTurkishPhone` (Task 1), üretim Supabase service key (yalnızca çalıştırma anında env'den)
- Produces: `out/leads.csv`, `out/students.csv` (kullanıcı onayı için) → `upload.ts` bunları DB'ye yükler. `out/` gitignore'dadır.

- [ ] **Step 1: `parse-whatsapp.ts`** — Girdi: `--input <path>/_chat.txt` (repo dışından verilir). Mantık:
  1. Satırları `[YYYY-MM-DD, HH:MM:SS] gönderen: mesaj` desenine göle çok satırlı mesaj bloklarına birleştir.
  2. Telefon regex'i `/(\+90|0)?\s*5\d{2}[\s\d]{7,}/` geçen blokları lead adayı say; `normalizeTurkishPhone` ile normalize et, aynı numara tekrarlarını en zengin blokta birleştir.
  3. Alan çıkarımı (heuristik): blok içinde ilk satırdaki isim → `parent_name`; `(\d{4})\s*(doğumlu|dogumlu)` veya ay adı + yıl → doğum ay/yıl; "referans" → source referans, "instagram"/"reklam" → ilgili source, yoksa `telefon`; "kayıt oldu|kayda geldi" → status `kazanildi`, "randevu|görüşme" → `gorusme_yapildi`, aksi `kaybedildi` + not "seed: durum belirsiz" (spec §9.5); blok metninin ilk 500 karakteri not olarak.
  4. Çıktı: `out/leads.csv` (kolonlar: parent_name, phone, child_name, birth_month, birth_year, source, status, lost_reason, note, first_seen_date).
  5. Konsola özet: toplam blok, benzersiz numara, statü dağılımı.
- [ ] **Step 2: `parse-excel.ts`** — `xlsx` paketiyle (`npm i -D xlsx`) DATA KAYIT dosyasını okur; kolon eşlemesi dosya açılıp görüldükten sonra bu script'te sabitlenir (öğrenci adı, veli, telefon, program, tutar kolonlarının başlık adları koda yazılır); çıktı `out/students.csv`.
- [ ] **Step 3: `upload.ts`** — CSV'leri okur, `SUPABASE_SERVICE_ROLE_KEY` ile insert eder; leads için `assigned_to` parametre olarak verilen danışman id'si; her satır için event yazmaz (tarihi veri), yalnızca `lead_olusturuldu` yerine `payload:{seed:true}` ile tek event. `--dry-run` bayrağı: yalnızca sayıları gösterir.
- [ ] **Step 4: Çalıştırma provası (lokal)** — `npx tsx scripts/seed/parse-whatsapp.ts --input "c:\Users\meert\Desktop\annem\whatsapp_export\_chat.txt"` → `out/leads.csv` üretilir; ilk 20 satır gözle kontrol edilir (isim/telefon/kaynak isabeti). CSV kullanıcıya gösterilip onay alınmadan üretime YÜKLENMEZ (spec §9.3).
- [ ] **Step 5: Commit** — `git add anaokulcrm/scripts; git commit -m "feat: tek seferlik whatsapp ve excel seed scriptleri"` (`out/` gitignore'da).

---

### Task 17: Uçtan uca doğrulama + üretim dağıtımı

**Files:**
- Create: `anaokulcrm/docs/teslim-kontrol-listesi.md`

**Interfaces:**
- Consumes: tüm önceki task'lar

- [ ] **Step 1: Tüm testler** — `npm test` (birim + RLS, Supabase lokal ayakta) → tümü yeşil; `npm run build` → hatasız.
- [ ] **Step 2: E2E senaryo (spec §13, lokalde manuel)** — kontrol listesi olarak `docs/teslim-kontrol-listesi.md`'ye yaz ve uygula: yeni lead → randevu → çakışma uyarısı → görüşme yapıldı → indirimli teklif (danışman) → bildirim → onay (yönetici) → öğrenciye dönüştür → 10 taksitli plan (kuruş farkı son taksitte) → kısmi ödeme → geciken görünümü → dashboard sayıları → cron çağrısı → Bugün ekranı görevleri. Her madde işaretlenir.
- [ ] **Step 3: Üretim kurulumu** — Supabase Cloud projesi oluştur → `npx supabase link` + `npx supabase db push` → 3 gerçek kullanıcıyı Supabase Auth'ta oluştur + `profiles` satırları (SQL editor) → Vercel projesi bağla, env değişkenleri (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` üretim değerleri) → deploy → üretimde login + smoke test (lead oluştur/sil).
- [ ] **Step 4: Seed'i üretime uygula** — Task 16 CSV'leri kullanıcı onayından geçtikten sonra `upload.ts` üretim env ile çalıştırılır; sonrası spot kontrol (lead sayısı, öğrenci sayısı, dashboard).
- [ ] **Step 5: Commit + teslim** — `git commit -am "docs: teslim kontrol listesi"`; kullanıcıya üretim URL'si, kullanıcı hesapları ve aylık CSV yedek önerisi (spec §12) iletilir.

---

## Self-Review Notları

- **Spec kapsama:** §5 tabloları → Task 2; §6 durum makineleri → Task 4 (kod) + Task 2 (DB constraint) + Task 6/10/11 (action'lar); §7 ekranlar 1-11 → Task 5, 13, 7, 8, 7, 9, 10, 11, 12, 14, 15; §8 kurallar 1-5 → kural 3 Task 9'da (anında), 1-2-5 Task 13 cron'da, kural 4 Task 10'da (anında); §9 seed → Task 16; §11 indeksler → Task 2; §12 → Global Constraints + Task 13 (cron saati/secret); §13 testler → Task 1, 3, 4, 17.
- **Bilinçli sadeleştirmeler:** realtime yerine 30 sn polling (3 kullanıcı, YAGNI); grafik kütüphanesi yok; UI e2e otomasyonu yok (manuel kontrol listesi — spec §13 ile uyumlu).
