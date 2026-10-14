# Okula Tam Uyum — Plan 1: Foundation (F0 + F1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the schema + design-token foundation for the "okula tam uyum" work — migration 0003 (new enums, columns, `families` + `refunds` tables), constants, a reusable status-badge, and RLS tests — so F2–F4 can build on it.

**Architecture:** One additive Postgres migration (`0003_domain_uyum.sql`) extends existing CHECK constraints and adds nullable columns + two tables with RLS mirroring the established `is_staff()`/`is_yonetici()` pattern. TypeScript `constants.ts` gains the new enum labels. A single `StatusBadge` component centralizes status color+icon+text (color-blind safe). RLS behavior is verified in `tests/rls`.

**Tech Stack:** Next.js (custom build — see `anaokulcrm/AGENTS.md`), Supabase (Postgres + RLS), TypeScript, Tailwind CSS v4 (`@theme` tokens in `globals.css`), Vitest (unit + RLS tests).

## Global Constraints

- All schema changes are **additive**; existing rows must remain valid without backfill.
- Existing RLS policies and the two `guard_*_danisman` triggers must not be weakened.
- No raw hex in components — use semantic tokens from `globals.css` (`anaokulcrm/app/globals.css:4-6`).
- Enum label maps live in `anaokulcrm/lib/constants.ts`; every stored enum value has a Turkish label.
- Money stays `numeric(12,2)`; TL⇄kuruş handled by existing `lib/money.ts` (do not reintroduce float math).
- Run all commands from `anaokulcrm/` unless stated.

---

## File Structure

- Create: `anaokulcrm/supabase/migrations/0003_domain_uyum.sql` — all schema changes for this wave.
- Modify: `anaokulcrm/lib/constants.ts` — extend `APPOINTMENT_TYPES`, `LEAD_SOURCES`, `LEAD_STATUSES`, add `INSTALLMENT_STATUSES`, `DISCOUNT_TYPES`, new `EVENT_LABELS`.
- Create: `anaokulcrm/components/status-badge.tsx` — status → {token class, icon, label} in one place.
- Modify: `anaokulcrm/app/globals.css` — add status-token utility classes for badges (build on existing `@theme`).
- Create: `anaokulcrm/docs/a11y-checklist.md` — numeric WCAG 2.2 acceptance thresholds for reviewers.
- Modify: `anaokulcrm/tests/rls/rls.test.ts` — add cases for `families` and `refunds` write rules.

---

### Task 1: Migration 0003 — schema changes

**Files:**
- Create: `anaokulcrm/supabase/migrations/0003_domain_uyum.sql`

**Interfaces:**
- Produces (for later tasks/plans):
  - `appointments.type` accepts `demo`, `oryantasyon`.
  - `leads.source` accepts `etkinlik`; `leads.status` accepts `beklemede`.
  - `leads` new cols: `ingilizce_gerekli boolean`, `ozel_durum boolean`, `ozel_durum_note text`, `wants_summer boolean`, `beklemede_sezon text`, `family_id uuid`.
  - `students` new cols: `left_date date`, `leave_reason text`, `family_id uuid`.
  - `installments.status` accepts `iptal`.
  - `price_list_items.capacity int null`.
  - Tables `families(id, family_code, primary_parent_name, phone, discount_type, ...)` and `refunds(id, student_id, amount, method, refund_date, note, created_by, ...)`.

- [ ] **Step 1: Write the migration file**

Create `anaokulcrm/supabase/migrations/0003_domain_uyum.sql`:

```sql
-- 0003_domain_uyum.sql — Okula tam uyum: additive domain changes.

-- === Enum genişletmeleri (CHECK constraint yeniden tanımı) ===
alter table public.appointments drop constraint appointments_type_check;
alter table public.appointments add constraint appointments_type_check
  check (type in ('okul_ziyareti','telefon','demo','oryantasyon'));

alter table public.leads drop constraint leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in ('referans','instagram','reklam','tabela_gecerken','telefon','etkinlik','diger'));

alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('yeni','ulasildi','randevu','gorusme_yapildi','teklif','beklemede','kazanildi','kaybedildi'));

alter table public.installments drop constraint installments_status_check;
alter table public.installments add constraint installments_status_check
  check (status in ('bekliyor','odendi','iptal'));

-- iptal taksitte ödeme alanları boş kalır: mevcut paid_fields kısıtını genişlet.
alter table public.installments drop constraint paid_fields;
alter table public.installments add constraint paid_fields check (
  (status = 'bekliyor' and paid_at is null and paid_amount is null and payment_method is null and marked_by is null)
  or (status = 'iptal' and paid_at is null and paid_amount is null and payment_method is null and marked_by is null)
  or (status = 'odendi' and paid_at is not null and paid_amount > 0 and payment_method is not null and marked_by is not null)
);

-- === Aile (household) tablosu ===
create table public.families (
  id uuid primary key default gen_random_uuid(),
  family_code text not null unique,
  primary_parent_name text not null,
  phone text,
  discount_type text not null default 'yok' check (discount_type in ('yok','yuzde_10','ozel')),
  discount_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === Yeni sütunlar ===
alter table public.leads
  add column ingilizce_gerekli boolean not null default false,
  add column ozel_durum boolean not null default false,
  add column ozel_durum_note text,
  add column wants_summer boolean not null default false,
  add column beklemede_sezon text,
  add column family_id uuid references public.families(id);

alter table public.students
  add column left_date date,
  add column leave_reason text,
  add column family_id uuid references public.families(id);

alter table public.price_list_items
  add column capacity int check (capacity is null or capacity >= 0);

-- === İade kaydı ===
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('havale','nakit','pos','diger')),
  refund_date date not null,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- === İndeksler ===
create index idx_leads_family on public.leads (family_id);
create index idx_students_family on public.students (family_id);
create index idx_refunds_student on public.refunds (student_id);

-- === updated_at trigger'ları (yeni tablolar) ===
create trigger touch_families before update on public.families
  for each row execute function public.touch_updated_at();

-- === RLS ===
alter table public.families enable row level security;
alter table public.refunds enable row level security;

-- events entity_type genişlet (append-only log yeni varlıkları kabul etsin)
alter table public.events drop constraint events_entity_type_check;
alter table public.events add constraint events_entity_type_check
  check (entity_type in ('lead','offer','student','installment','appointment','price_list','family','refund'));

-- families: tüm aktif personel okur; yazma personel (küçük ekip, lead ile aynı sınıf)
create policy sel_families on public.families for select using (public.is_staff());
create policy ins_families on public.families for insert with check (public.is_staff());
create policy upd_families on public.families for update using (public.is_staff());
create policy del_families on public.families for delete using (public.is_yonetici());

-- refunds: personel okur; oluşturma/güncelleme yalnız yönetici (finansal kapanış)
create policy sel_refunds on public.refunds for select using (public.is_staff());
create policy ins_refunds on public.refunds for insert with check (public.is_yonetici() and created_by = auth.uid());
create policy upd_refunds on public.refunds for update using (public.is_yonetici());
create policy del_refunds on public.refunds for delete using (public.is_yonetici());

-- PostgREST yetkileri (0001 ile aynı desen)
grant all on public.families, public.refunds to postgres, service_role;
grant select, insert, update, delete on public.families, public.refunds to authenticated;
```

- [ ] **Step 2: Apply the migration to the local DB and verify it succeeds**

Run: `npx supabase migration up` (or the project's documented apply command; check `anaokulcrm/README.md`).
Expected: applies cleanly, no constraint errors on existing rows.

- [ ] **Step 3: Verify new schema objects exist**

Run:
```bash
npx supabase db execute "select column_name from information_schema.columns where table_name='leads' and column_name in ('family_id','wants_summer','beklemede_sezon');"
```
Expected: 3 rows returned. Also confirm `families` and `refunds` tables exist:
```bash
npx supabase db execute "select to_regclass('public.families'), to_regclass('public.refunds');"
```
Expected: both non-null.

- [ ] **Step 4: Verify existing rows still satisfy new CHECKs**

Run:
```bash
npx supabase db execute "select count(*) from public.leads; select count(*) from public.appointments;"
```
Expected: no error (constraints validated against existing data during ALTER).

- [ ] **Step 5: Commit**

```bash
git add anaokulcrm/supabase/migrations/0003_domain_uyum.sql
git commit -m "feat: migration 0003 - domain uyum sema (enum, aile, iade)"
```

---

### Task 2: Constants — new enum labels

**Files:**
- Modify: `anaokulcrm/lib/constants.ts`

**Interfaces:**
- Consumes: existing `label(group, value)` helper and const maps.
- Produces: `APPOINTMENT_TYPES.demo/oryantasyon`, `LEAD_SOURCES.etkinlik`, `LEAD_STATUSES.beklemede`, `INSTALLMENT_STATUSES`, `DISCOUNT_TYPES`, new `EVENT_LABELS` keys.

- [ ] **Step 1: Write the failing test**

Create/extend `anaokulcrm/tests/constants.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  APPOINTMENT_TYPES, LEAD_SOURCES, LEAD_STATUSES,
  INSTALLMENT_STATUSES, DISCOUNT_TYPES, label,
} from "@/lib/constants";

describe("0003 domain uyum sabitleri", () => {
  it("randevu tipleri demo ve oryantasyon içerir", () => {
    expect(APPOINTMENT_TYPES.demo).toBe("Demo Dersi");
    expect(APPOINTMENT_TYPES.oryantasyon).toBe("Oryantasyon");
  });
  it("kaynak etkinlik içerir", () => {
    expect(LEAD_SOURCES.etkinlik).toBe("Etkinlik");
  });
  it("lead durumu beklemede içerir", () => {
    expect(LEAD_STATUSES.beklemede).toBe("Beklemede");
  });
  it("taksit ve indirim tipleri tanımlı", () => {
    expect(INSTALLMENT_STATUSES.iptal).toBe("İptal");
    expect(DISCOUNT_TYPES.yuzde_10).toBe("%10 Kardeş");
  });
  it("label bilinmeyen değeri aynen döndürür", () => {
    expect(label(LEAD_STATUSES, "yok_boyle")).toBe("yok_boyle");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/constants.test.ts`
Expected: FAIL (`APPOINTMENT_TYPES.demo` is undefined etc.).

- [ ] **Step 3: Edit `anaokulcrm/lib/constants.ts`**

Extend the maps (keep existing entries):

```ts
export const APPOINTMENT_TYPES = {
  okul_ziyareti: "Okul Ziyareti", telefon: "Telefon Görüşmesi",
  demo: "Demo Dersi", oryantasyon: "Oryantasyon",
} as const;

export const LEAD_SOURCES = {
  referans: "Referans", instagram: "Instagram", reklam: "Reklam",
  tabela_gecerken: "Tabela / Geçerken", telefon: "Telefon",
  etkinlik: "Etkinlik", diger: "Diğer",
} as const;

export const LEAD_STATUSES = {
  yeni: "Yeni", ulasildi: "Ulaşıldı", randevu: "Randevu",
  gorusme_yapildi: "Görüşme Yapıldı", teklif: "Teklif",
  beklemede: "Beklemede",
  kazanildi: "Kazanıldı", kaybedildi: "Kaybedildi",
} as const;

export const INSTALLMENT_STATUSES = {
  bekliyor: "Bekliyor", odendi: "Ödendi", iptal: "İptal",
} as const;

export const DISCOUNT_TYPES = {
  yok: "Yok", yuzde_10: "%10 Kardeş", ozel: "Özel",
} as const;
```

Add to `EVENT_LABELS`:

```ts
  beklemeye_alindi: "Beklemeye alındı",
  ogrenci_ayrildi: "Öğrenci ayrıldı",
  iade_kaydedildi: "İade kaydedildi",
  aileye_baglandi: "Aileye bağlandı",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add anaokulcrm/lib/constants.ts anaokulcrm/tests/constants.test.ts
git commit -m "feat: 0003 enum etiketleri (demo, etkinlik, beklemede, iade)"
```

---

### Task 3: StatusBadge component + status tokens

**Files:**
- Modify: `anaokulcrm/app/globals.css`
- Create: `anaokulcrm/components/status-badge.tsx`

**Interfaces:**
- Produces: `<StatusBadge status={LeadStatus} />` rendering color+icon+Turkish label; used by F2 pipeline/list.

- [ ] **Step 1: Add status badge tokens to `globals.css`** (inside existing `@theme`, after `--color-warning-soft`)

```css
  /* Durum rozetleri — renk-körü güvenli (renk + ikon + metin) */
  --color-status-yeni: #1d4ed8;      --color-status-yeni-soft: #dbeafe;
  --color-status-randevu: #d97706;   --color-status-randevu-soft: #fef3c7;
  --color-status-teklif: #0369a1;    --color-status-teklif-soft: #e0f2fe;
  --color-status-kazanildi: #15803d; --color-status-kazanildi-soft: #dcfce7;
  --color-status-kaybedildi: #b91c1c;--color-status-kaybedildi-soft: #fee2e2;
  --color-status-notr: #4b5563;      --color-status-notr-soft: #e5e7eb;
```

- [ ] **Step 2: Write the failing test**

Create `anaokulcrm/tests/status-badge.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/status-badge";

describe("StatusBadge", () => {
  it("durum etiketini metin olarak gösterir (sadece renk değil)", () => {
    render(<StatusBadge status="beklemede" />);
    expect(screen.getByText("Beklemede")).toBeInTheDocument();
  });
  it("bilinen duruma rol atar", () => {
    render(<StatusBadge status="kazanildi" />);
    expect(screen.getByText("Kazanıldı")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/status-badge.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Create `anaokulcrm/components/status-badge.tsx`**

```tsx
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";

const STYLE: Record<LeadStatus, { bg: string; fg: string; icon: string }> = {
  yeni:            { bg: "bg-[--color-status-yeni-soft]",       fg: "text-[--color-status-yeni]",       icon: "●" },
  ulasildi:        { bg: "bg-[--color-status-yeni-soft]",       fg: "text-[--color-status-yeni]",       icon: "☎" },
  randevu:         { bg: "bg-[--color-status-randevu-soft]",    fg: "text-[--color-status-randevu]",    icon: "📅" },
  gorusme_yapildi: { bg: "bg-[--color-status-randevu-soft]",    fg: "text-[--color-status-randevu]",    icon: "💬" },
  teklif:          { bg: "bg-[--color-status-teklif-soft]",     fg: "text-[--color-status-teklif]",     icon: "📄" },
  beklemede:       { bg: "bg-[--color-status-notr-soft]",       fg: "text-[--color-status-notr]",       icon: "⏳" },
  kazanildi:       { bg: "bg-[--color-status-kazanildi-soft]",  fg: "text-[--color-status-kazanildi]",  icon: "✓" },
  kaybedildi:      { bg: "bg-[--color-status-kaybedildi-soft]", fg: "text-[--color-status-kaybedildi]", icon: "✕" },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const s = STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.fg}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {LEAD_STATUSES[status]}
    </span>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/status-badge.test.tsx`
Expected: PASS. (If `@testing-library/react` is absent, install as devDependency first: `npm i -D @testing-library/react @testing-library/jest-dom jsdom` and ensure vitest `environment: "jsdom"`.)

- [ ] **Step 6: Commit**

```bash
git add anaokulcrm/app/globals.css anaokulcrm/components/status-badge.tsx anaokulcrm/tests/status-badge.test.tsx
git commit -m "feat: durum rozeti bileseni + renk-koru guvenli token"
```

---

### Task 4: RLS tests for families & refunds

**Files:**
- Modify: `anaokulcrm/tests/rls/rls.test.ts`

**Interfaces:**
- Consumes: existing RLS test harness (dotenv + SupabaseClient helpers per `tests/rls`).

- [ ] **Step 1: Write the failing tests** (append to `rls.test.ts`, mirroring existing danışman/yönetici client setup)

```ts
describe("families & refunds RLS", () => {
  it("danışman aile oluşturabilir ve okuyabilir", async () => {
    const { data, error } = await danismanClient
      .from("families")
      .insert({ family_code: "AILE-TEST-1", primary_parent_name: "Test Veli" })
      .select("id").single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it("danışman iade kaydı OLUŞTURAMAZ (yalnız yönetici)", async () => {
    // önce bir öğrenci gerekli — mevcut fixture öğrenci id'si kullanılır
    const { error } = await danismanClient.from("refunds").insert({
      student_id: fixtureStudentId, amount: 100, method: "nakit",
      refund_date: "2026-07-14", created_by: danismanUserId,
    });
    expect(error).not.toBeNull(); // RLS reddeder
  });

  it("yönetici iade kaydı oluşturabilir", async () => {
    const { data, error } = await yoneticiClient.from("refunds").insert({
      student_id: fixtureStudentId, amount: 100, method: "nakit",
      refund_date: "2026-07-14", created_by: yoneticiUserId,
    }).select("id").single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/rls/rls.test.ts`
Expected: FAIL only if fixtures missing — wire `fixtureStudentId`, `danismanUserId`, `yoneticiUserId` from the existing fixture block at the top of the file (reuse the pattern already used for leads/students). If the migration isn't applied, apply it first (Task 1).

- [ ] **Step 3: Ensure fixtures resolve, then run to verify pass**

Run: `npx vitest run tests/rls/rls.test.ts`
Expected: PASS — danışman family insert ok, danışman refund insert rejected, yönetici refund insert ok.

- [ ] **Step 4: Commit**

```bash
git add anaokulcrm/tests/rls/rls.test.ts
git commit -m "test: families/refunds RLS yazma sinirlari"
```

---

### Task 5: A11y acceptance checklist (F0)

**Files:**
- Create: `anaokulcrm/docs/a11y-checklist.md`

- [ ] **Step 1: Create the checklist** (reviewers run this against every new screen in F2–F4)

```markdown
# Erişilebilirlik Kabul Kriterleri (WCAG 2.2)

Her yeni/değişen ekran bu listeyi geçmeli:

- [ ] Metin kontrastı ≥ 4.5:1 (büyük metin ve UI bileşen sınırları ≥ 3:1).
- [ ] Kritik gövde/hata/yardım metni ≥ 16px.
- [ ] Dokunma hedefleri ≥ 44×44px (mutlak min 24×24px, padding dahil).
- [ ] Durum yalnız renkle değil; renk + ikon + metin birlikte (bkz. StatusBadge).
- [ ] Her form alanında görünür label; hata "ne oldu + nasıl düzelir".
- [ ] Görünür odak halkası (≥2px), sticky header altında kaybolmuyor (Focus Not Obscured).
- [ ] Sürükleme gereken her yerde tek-işaretçi alternatifi (buton/menü) var (Dragging Movements).
- [ ] %200 zoom ve artırılmış metin-aralığında düzen bozulmuyor (Türkçe metin genişlemesi).
- [ ] Tüm kritik akışlar klavye ile tamamlanabiliyor; modal odağı tuzaklıyor/geri veriyor.
- [ ] Türkçe karakterler (ı/İ/ş/ğ) net; dar kolonda metin sıkıştırılmıyor.
```

- [ ] **Step 2: Commit**

```bash
git add anaokulcrm/docs/a11y-checklist.md
git commit -m "docs: WCAG 2.2 erisilebilirlik kabul kriterleri"
```

---

## Self-Review

**Spec coverage (F0+F1 portion of `2026-07-14-okula-tam-uyum-design.md`):**
- §2.1 enum extensions → Task 1 ✓ · §2.2 new columns → Task 1 ✓ · §2.3 families → Task 1 + Task 4 ✓ · §2.4 refunds → Task 1 + Task 4 ✓ · §2.5 yaz okulu (no schema) → n/a ✓ · F0 tokens/badge → Task 3 ✓ · F0 a11y standard → Task 5 ✓ · constants → Task 2 ✓.
- Deferred to later plans: capacity *display* (F3 plan), lead-flag *forms* (F2 plan), kardeş indirim *hesabı* (F3 plan), ayrılış *akışı* (F3 plan) — this plan only lays their schema.

**Placeholder scan:** none — every code step has concrete SQL/TS/TSX.

**Type consistency:** `LeadStatus` (constants) drives `StatusBadge` `STYLE` keys (all 8 statuses covered incl. new `beklemede`). `discount_type` enum values (`yok/yuzde_10/ozel`) match `DISCOUNT_TYPES`. `installments.status` `iptal` matches `INSTALLMENT_STATUSES`.

**Note for executor:** Confirm the local Supabase apply command and the RLS test fixture names against `anaokulcrm/README.md` and the current `tests/rls/rls.test.ts` header before running — reuse existing fixtures rather than inventing new ones.
```
