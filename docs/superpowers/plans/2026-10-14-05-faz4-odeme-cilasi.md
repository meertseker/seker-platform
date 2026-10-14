# Faz 4: Ödeme Cilası Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yöneticinin ve danışmanın geciken taksitleri tek listede görmesi, her öğrenci için hazır metinli WhatsApp hatırlatması göndermesi (mesaj kendi telefonlarından gider) ve aylık beklenen / tahsil edilen / geciken özetini tek bakışta okuması.

**Architecture:** `0009` migration'ı `security_invoker` bir view (`v_overdue_installments`) ekler; yetki, alttaki tabloların mevcut RLS'inden gelir. Gruplama, sıralama, hatırlatma metni ve oran hesabı saf fonksiyonlarda (`lib/overdue.ts`) yaşar ve birim testlidir. Yeni sayfa `/odemeler/gecikenler` bu view'u okur. Bugün ekranı ve Dashboard'daki mevcut tahsilat bölümleri küçük eklemelerle bu sayfaya bağlanır.

**Tech Stack:** Next.js 16 Server Components, Supabase Postgres view + RLS, Vitest 4, mevcut `lib/money.ts`, `lib/whatsapp.ts`, `components/whatsapp-button.tsx`.

**Spec:** `docs/superpowers/specs/2026-10-14-seker-platform-design.html` §"Ödeme takibi", §"Faz 4". Ortak sözleşme: `docs/superpowers/plans/2026-10-14-00-seker-platform-index.md` (view kolonları oradaki gibi).

## Bugün panelde zaten olanlar (yeniden yazılmayacak)

- **Bugün** ekranında "Bugünkü / geciken tahsilat" bölümü: vadesi bugün veya geçmiş bekleyen taksitler ve toplam (`apps/panel/app/(app)/bugun/page.tsx`).
- **Dashboard**'da ay seçicili `PaymentSummarySection`: "Bu ay vadesi gelen", "Bu ay tahsil edilen", "Toplam geciken" (`getPaymentSummary`, `lib/queries/dashboard.ts`).
- **Ödemeler** ızgarasında "Gecikeni olanlar" filtresi.

Bu faz bunları **genişletir**: gecikmeyi öğrenci bazında gruplayan ayrı bir liste, hatırlatma düğmesi, tahsil oranı ve sayfalar arası bağlantılar.

## Global Constraints

- İndeks dosyasındaki Global Constraints'in tamamı geçerlidir.
- Migration numarası `0009`. View adı ve kolonları sözleşmedeki gibi: `public.v_overdue_installments(installment_id, student_id, student_name, family_phone, due_date, amount, days_overdue, item_type, season)`, `security_invoker = true`.
- "Geciken" tanımı her yerde aynı: `installments.status = 'bekliyor'` ve `due_date` İstanbul'un bugününden **önce** (bugün vadeli olan geciken değildir).
- Para hesabı kuruş integer: `tlToKurus(Number(amount))`, gösterim `formatTRY(kurus)`.
- WhatsApp mesajı otomatik gönderilmez; yalnızca `wa.me` bağlantısı açılır (`waMeUrl`). Geçersiz telefonda düğme gösterilmez, yerine "Telefon yok" yazar.
- Gecikenler sayfası `yonetici` ve `danisman` rollerine açıktır (ikisi de taksit işaretleyebiliyor, `installments` RLS'i `is_staff()`).
- Tüm komutlar monorepo kökünden (`C:\Users\meert\Desktop\seker-platform`).

## Review Focus

1. **Telefonu öğrencide değil ailede olan öğrenci:** `students.phone` boş, `families.phone` dolu → hatırlatma düğmesi aile telefonuyla çıkmalı. → Task 1 RLS/view testi "aile telefonu".
2. **Aynı öğrencinin birden çok geciken kalemi:** Eylül ve Ekim aidatı + servis → tek kart, tek mesaj, toplam doğru; mesaj çok uzamamalı. → Task 2 testi "üçten fazla kalem".
3. **Bugün vadeli taksit:** geciken listesine girmemeli, hatırlatma düğmesi Bugün ekranında bu satırda çıkmamalı. → Task 1 testi "bugün vadeli" ve Task 4 adımı.
4. **İptal edilmiş veya ödenmiş taksit:** listede görünmemeli. → Task 1 testi.
5. **Vadesi gelen tutarın sıfır olduğu ay:** tahsil oranı "%NaN" veya "%Infinity" değil "—" göstermeli. → Task 2 testi `collectionRatePercent`.

---

## Dosya yapısı

```
packages/db/supabase/migrations/0009_overdue_view.sql     view + yetkiler
apps/panel/lib/overdue.ts                                  saf fonksiyonlar (gruplama, sıralama, mesaj, oran)
apps/panel/app/(app)/odemeler/gecikenler/page.tsx          yeni sayfa
apps/panel/components/overdue-student-card.tsx             öğrenci kartı
apps/panel/app/(app)/odemeler/page.tsx                     (değişir) "Gecikenler" bağlantısı
apps/panel/app/(app)/bugun/page.tsx                        (değişir) geciken özeti + hatırlatma düğmesi
apps/panel/app/(app)/dashboard/page.tsx                    (değişir) tahsil oranı + bağlantı
apps/panel/tests/rls/overdue.test.ts
apps/panel/tests/unit/overdue.test.ts
```

---

### Task 1: Migration 0009 — `v_overdue_installments`

**Files:**
- Create: `packages/db/supabase/migrations/0009_overdue_view.sql`
- Create: `apps/panel/tests/rls/overdue.test.ts`
- Modify: `packages/db/src/database.types.ts` (üretilir)

**Interfaces:**
- Consumes: mevcut `installments`, `payment_plans`, `students(full_name, phone, family_id)`, `families(phone)` ve onların RLS'i.
- Produces: `public.v_overdue_installments` — her satır bir geciken taksit. `family_phone = coalesce(nullif(students.phone,''), families.phone)`, `days_overdue int` (İstanbul bugünü − `due_date`), `amount numeric(12,2)` (TL).

- [ ] **Step 1: Başarısız testi yaz**

`apps/panel/tests/rls/overdue.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const DAN_ID = "00000000-0000-0000-0000-000000000002";
let dan: SupabaseClient;
let studentWithFamilyPhone: string;
let overdueId: string;
let todayDueId: string;
let paidId: string;
let cancelledId: string;

function istanbulYmd(offsetDays: number) {
  const d = new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  dan = await clientFor("danisman@test.local");

  const { data: family } = await admin
    .from("families")
    .insert({ family_code: `OVD-${Date.now()}`, primary_parent_name: "Gecikme Ailesi", phone: "+905551112233" })
    .select("id")
    .single();

  const { data: student } = await admin
    .from("students")
    .insert({ full_name: "Gecikme Öğrenci", season: "2026-2027", family_id: family!.id, phone: null })
    .select("id")
    .single();
  studentWithFamilyPhone = student!.id;

  const { data: plan } = await admin
    .from("payment_plans")
    .insert({ student_id: student!.id, season: "2026-2027", item_type: "aidat", total_amount: 40000, installment_count: 4 })
    .select("id")
    .single();

  const rows = [
    { plan_id: plan!.id, due_date: istanbulYmd(-10), amount: 10000, status: "bekliyor" },
    { plan_id: plan!.id, due_date: istanbulYmd(0), amount: 10000, status: "bekliyor" },
    {
      plan_id: plan!.id, due_date: istanbulYmd(-40), amount: 10000, status: "odendi",
      paid_at: new Date().toISOString(), paid_amount: 10000, payment_method: "havale", marked_by: DAN_ID,
    },
    { plan_id: plan!.id, due_date: istanbulYmd(-70), amount: 10000, status: "iptal" },
  ];
  const { data: inserted, error } = await admin.from("installments").insert(rows).select("id, due_date, status");
  if (error) throw error;
  [overdueId, todayDueId, paidId, cancelledId] = inserted!.map((r) => r.id);
});

describe("v_overdue_installments", () => {
  it("yalnızca bekleyen ve vadesi geçmiş taksiti, aile telefonu ve gün sayısıyla döner", async () => {
    const { data, error } = await dan
      .from("v_overdue_installments")
      .select("installment_id, student_id, student_name, family_phone, amount, days_overdue, item_type, season")
      .eq("student_id", studentWithFamilyPhone);
    expect(error).toBeNull();
    expect(data).toEqual([
      {
        installment_id: overdueId,
        student_id: studentWithFamilyPhone,
        student_name: "Gecikme Öğrenci",
        family_phone: "+905551112233",
        amount: 10000,
        days_overdue: 10,
        item_type: "aidat",
        season: "2026-2027",
      },
    ]);
  });

  it("bugün vadeli, ödenmiş ve iptal taksitler listede yok", async () => {
    const { data } = await dan.from("v_overdue_installments").select("installment_id").eq("student_id", studentWithFamilyPhone);
    const ids = (data ?? []).map((r) => r.installment_id);
    expect(ids).not.toContain(todayDueId);
    expect(ids).not.toContain(paidId);
    expect(ids).not.toContain(cancelledId);
  });

  it("giriş yapmamış ziyaretçi hiçbir satır göremez", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await anon.from("v_overdue_installments").select("installment_id").limit(1);
    expect(data ?? []).toEqual([]);
    if (error) expect(error.code).toMatch(/42501|PGRST/);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/rls/overdue.test.ts`
Expected: FAIL — `relation "public.v_overdue_installments" does not exist` (veya PostgREST `PGRST205`).

- [ ] **Step 3: Migration'ı yaz**

`packages/db/supabase/migrations/0009_overdue_view.sql`:

```sql
-- Faz 4: geciken taksitler listesi.
-- security_invoker: view, sorguyu yapan kullanıcının yetkisiyle çalışır; installments/students/families RLS'i aynen uygulanır.

create view public.v_overdue_installments
with (security_invoker = true) as
select
  i.id as installment_id,
  s.id as student_id,
  s.full_name as student_name,
  coalesce(nullif(s.phone, ''), f.phone) as family_phone,
  i.due_date,
  i.amount,
  ((now() at time zone 'Europe/Istanbul')::date - i.due_date)::int as days_overdue,
  p.item_type,
  p.season
from public.installments i
join public.payment_plans p on p.id = i.plan_id
join public.students s on s.id = p.student_id
left join public.families f on f.id = s.family_id
where i.status = 'bekliyor'
  and i.due_date < (now() at time zone 'Europe/Istanbul')::date;

revoke all on public.v_overdue_installments from anon, public;
grant select on public.v_overdue_installments to authenticated, service_role;
```

- [ ] **Step 4: Uygula, tipleri üret**

Run: `pnpm --filter @seker/db exec supabase db reset`
Expected: `Applying migration 0009_overdue_view.sql...` ve `Finished supabase db reset`.

Run: `pnpm --filter @seker/db gen:types`
Expected: `database.types.ts` içinde `Views: { v_overdue_installments: … }`.

- [ ] **Step 5: Testin geçtiğini gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/rls/overdue.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase/migrations/0009_overdue_view.sql packages/db/src/database.types.ts apps/panel/tests/rls/overdue.test.ts
git commit -m "feat(db): geciken taksitler view'u (0009)"
```

---

### Task 2: Saf fonksiyonlar — gruplama, sıralama, hatırlatma metni, tahsil oranı

**Files:**
- Create: `apps/panel/lib/overdue.ts`
- Test: `apps/panel/tests/unit/overdue.test.ts`

**Interfaces:**
- Consumes: `formatTRY`, `tlToKurus` (`@/lib/money`), `ITEM_TYPES`, `label`, `ItemType` (`@/lib/constants`).
- Produces:
  ```ts
  export type OverdueRow = { installment_id: string; student_id: string; student_name: string; family_phone: string | null; due_date: string; amount: number | string; days_overdue: number; item_type: ItemType; season: string };
  export type OverdueItem = { installmentId: string; dueDate: string; amountKurus: number; itemType: ItemType; daysOverdue: number };
  export type OverdueStudent = { studentId: string; studentName: string; phone: string | null; totalKurus: number; maxDaysOverdue: number; items: OverdueItem[] };
  export type OverdueSort = "gun" | "tutar" | "isim";
  export function groupOverdueByStudent(rows: OverdueRow[]): OverdueStudent[];
  export function normalizeOverdueSort(value: string | undefined): OverdueSort;
  export function sortOverdue(list: OverdueStudent[], sort: OverdueSort): OverdueStudent[];
  export function overdueTotals(list: OverdueStudent[]): { students: number; installments: number; totalKurus: number };
  export function reminderMessage(input: { studentName: string; totalKurus: number; items: Pick<OverdueItem, "dueDate" | "itemType">[] }): string;
  export function collectionRatePercent(paidKurus: number, dueKurus: number): number | null;
  ```

- [ ] **Step 1: Başarısız testi yaz**

`apps/panel/tests/unit/overdue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  groupOverdueByStudent,
  sortOverdue,
  normalizeOverdueSort,
  overdueTotals,
  reminderMessage,
  collectionRatePercent,
  type OverdueRow,
} from "@/lib/overdue";

function row(overrides: Partial<OverdueRow>): OverdueRow {
  return {
    installment_id: crypto.randomUUID(), student_id: "s1", student_name: "Ada Yılmaz",
    family_phone: "+905551112233", due_date: "2026-09-05", amount: "18000.00",
    days_overdue: 39, item_type: "aidat", season: "2026-2027", ...overrides,
  };
}

describe("groupOverdueByStudent", () => {
  it("aynı öğrencinin kalemlerini tek kartta toplar, kuruşla toplar, en eski vadeyi öne alır", () => {
    const list = groupOverdueByStudent([
      row({ installment_id: "i2", due_date: "2026-10-05", amount: 18000, days_overdue: 9 }),
      row({ installment_id: "i1", due_date: "2026-09-05", amount: "18000.50", days_overdue: 39 }),
      row({ installment_id: "i3", student_id: "s2", student_name: "Can Demir", family_phone: null, amount: 2500, item_type: "servis", days_overdue: 3 }),
    ]);
    expect(list).toHaveLength(2);
    const ada = list.find((s) => s.studentId === "s1")!;
    expect(ada.totalKurus).toBe(3_600_050);
    expect(ada.maxDaysOverdue).toBe(39);
    expect(ada.items.map((i) => i.installmentId)).toEqual(["i1", "i2"]);
    expect(list.find((s) => s.studentId === "s2")!.phone).toBeNull();
  });
});

describe("sıralama", () => {
  const list = groupOverdueByStudent([
    row({ student_id: "a", student_name: "Zeynep", amount: 100, days_overdue: 50 }),
    row({ student_id: "b", student_name: "Ali", amount: 9000, days_overdue: 5 }),
    row({ student_id: "c", student_name: "Çağla", amount: 500, days_overdue: 20 }),
  ]);

  it("gun: en çok geciken önce", () => {
    expect(sortOverdue(list, "gun").map((s) => s.studentId)).toEqual(["a", "c", "b"]);
  });
  it("tutar: en yüksek borç önce", () => {
    expect(sortOverdue(list, "tutar").map((s) => s.studentId)).toEqual(["b", "c", "a"]);
  });
  it("isim: Türkçe alfabe sırası (Ç, C'den sonra)", () => {
    expect(sortOverdue(list, "isim").map((s) => s.studentName)).toEqual(["Ali", "Çağla", "Zeynep"]);
  });
  it("bilinmeyen sıralama değeri gun'a döner", () => {
    expect(normalizeOverdueSort("hack")).toBe("gun");
    expect(normalizeOverdueSort("tutar")).toBe("tutar");
    expect(normalizeOverdueSort(undefined)).toBe("gun");
  });
});

describe("overdueTotals", () => {
  it("öğrenci, taksit ve tutar toplamı", () => {
    const list = groupOverdueByStudent([row({ amount: 100 }), row({ amount: 50 }), row({ student_id: "s2", amount: 25 })]);
    expect(overdueTotals(list)).toEqual({ students: 2, installments: 3, totalKurus: 17_500 });
  });
});

describe("reminderMessage", () => {
  it("ay adı ve kalem türüyle Türkçe hatırlatma üretir", () => {
    expect(
      reminderMessage({
        studentName: "Ada Yılmaz",
        totalKurus: 3_600_000,
        items: [
          { dueDate: "2026-09-05", itemType: "aidat" },
          { dueDate: "2026-10-05", itemType: "aidat" },
        ],
      }),
    ).toBe(
      "Merhaba, Ada Yılmaz için Eylül 2026 Aidat ve Ekim 2026 Aidat ödemelerinin vadesi geçmiş görünüyor. " +
        "Toplam: 36.000,00 ₺. Ödemeyi yaptıysanız bu mesajı dikkate almayın. Teşekkür ederiz, Şeker Anaokulu",
    );
  });

  it("tek kalemde tekil yazar", () => {
    expect(reminderMessage({ studentName: "Can", totalKurus: 250_000, items: [{ dueDate: "2026-10-01", itemType: "servis" }] })).toBe(
      "Merhaba, Can için Ekim 2026 Servis ödemesinin vadesi geçmiş görünüyor. " +
        "Toplam: 2.500,00 ₺. Ödemeyi yaptıysanız bu mesajı dikkate almayın. Teşekkür ederiz, Şeker Anaokulu",
    );
  });

  it("üçten fazla kalemi kısaltır", () => {
    const msg = reminderMessage({
      studentName: "Ada",
      totalKurus: 100,
      items: ["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"].map((d) => ({ dueDate: d, itemType: "aidat" as const })),
    });
    expect(msg).toContain("Haziran 2026 Aidat, Temmuz 2026 Aidat, Ağustos 2026 Aidat ve 2 ödeme daha");
  });
});

describe("collectionRatePercent", () => {
  it("yuvarlanmış yüzde döner", () => {
    expect(collectionRatePercent(66_667, 100_000)).toBe(67);
  });
  it("vadesi gelen yoksa null", () => {
    expect(collectionRatePercent(5_000, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/overdue.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/overdue"`.

- [ ] **Step 3: `overdue.ts` yaz**

`apps/panel/lib/overdue.ts`:

```ts
import { ITEM_TYPES, label, type ItemType } from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";

export interface OverdueRow {
  installment_id: string;
  student_id: string;
  student_name: string;
  family_phone: string | null;
  due_date: string;
  amount: number | string;
  days_overdue: number;
  item_type: ItemType;
  season: string;
}

export interface OverdueItem {
  installmentId: string;
  dueDate: string;
  amountKurus: number;
  itemType: ItemType;
  daysOverdue: number;
}

export interface OverdueStudent {
  studentId: string;
  studentName: string;
  phone: string | null;
  totalKurus: number;
  maxDaysOverdue: number;
  items: OverdueItem[];
}

export type OverdueSort = "gun" | "tutar" | "isim";
const SORTS: OverdueSort[] = ["gun", "tutar", "isim"];
const MAX_ITEMS_IN_MESSAGE = 3;

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

/** Geciken taksit satırlarını öğrenci kartlarına dönüştürür; kalemler en eski vadeden başlar. */
export function groupOverdueByStudent(rows: OverdueRow[]): OverdueStudent[] {
  const byStudent = new Map<string, OverdueStudent>();
  for (const r of rows) {
    const student =
      byStudent.get(r.student_id) ??
      { studentId: r.student_id, studentName: r.student_name, phone: r.family_phone, totalKurus: 0, maxDaysOverdue: 0, items: [] };
    const amountKurus = tlToKurus(Number(r.amount));
    student.items.push({ installmentId: r.installment_id, dueDate: r.due_date, amountKurus, itemType: r.item_type, daysOverdue: r.days_overdue });
    student.totalKurus += amountKurus;
    student.maxDaysOverdue = Math.max(student.maxDaysOverdue, r.days_overdue);
    if (!student.phone && r.family_phone) student.phone = r.family_phone;
    byStudent.set(r.student_id, student);
  }
  for (const student of byStudent.values()) {
    student.items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }
  return [...byStudent.values()];
}

export function normalizeOverdueSort(value: string | undefined): OverdueSort {
  return SORTS.includes(value as OverdueSort) ? (value as OverdueSort) : "gun";
}

export function sortOverdue(list: OverdueStudent[], sort: OverdueSort): OverdueStudent[] {
  const byName = (a: OverdueStudent, b: OverdueStudent) => a.studentName.localeCompare(b.studentName, "tr");
  const copy = [...list];
  if (sort === "tutar") return copy.sort((a, b) => b.totalKurus - a.totalKurus || byName(a, b));
  if (sort === "isim") return copy.sort(byName);
  return copy.sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue || byName(a, b));
}

export function overdueTotals(list: OverdueStudent[]): { students: number; installments: number; totalKurus: number } {
  return list.reduce(
    (acc, s) => ({ students: acc.students + 1, installments: acc.installments + s.items.length, totalKurus: acc.totalKurus + s.totalKurus }),
    { students: 0, installments: 0, totalKurus: 0 },
  );
}

function itemLabel(item: Pick<OverdueItem, "dueDate" | "itemType">): string {
  const month = monthFormatter.format(new Date(`${item.dueDate}T12:00:00+03:00`));
  return `${month} ${label(ITEM_TYPES, item.itemType)}`;
}

/** Veliye gönderilecek hazır WhatsApp metni. Öğretmen göndermeden önce düzenleyebilir. */
export function reminderMessage(input: {
  studentName: string;
  totalKurus: number;
  items: Pick<OverdueItem, "dueDate" | "itemType">[];
}): string {
  const shown = input.items.slice(0, MAX_ITEMS_IN_MESSAGE).map(itemLabel);
  const rest = input.items.length - shown.length;
  let list: string;
  if (rest > 0) list = `${shown.join(", ")} ve ${rest} ödeme daha`;
  else if (shown.length > 1) list = `${shown.slice(0, -1).join(", ")} ve ${shown[shown.length - 1]}`;
  else list = shown[0] ?? "";
  const noun = input.items.length > 1 ? "ödemelerinin" : "ödemesinin";
  return (
    `Merhaba, ${input.studentName} için ${list} ${noun} vadesi geçmiş görünüyor. ` +
    `Toplam: ${formatTRY(input.totalKurus)}. Ödemeyi yaptıysanız bu mesajı dikkate almayın. Teşekkür ederiz, Şeker Anaokulu`
  );
}

/** Tahsil edilenin vadesi gelene oranı (%). Vadesi gelen 0 ise null ("—" gösterilir). */
export function collectionRatePercent(paidKurus: number, dueKurus: number): number | null {
  if (dueKurus <= 0) return null;
  return Math.round((paidKurus / dueKurus) * 100);
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/overdue.test.ts`
Expected: PASS — 11 test.

- [ ] **Step 5: Commit**

```bash
git add apps/panel/lib/overdue.ts apps/panel/tests/unit/overdue.test.ts
git commit -m "feat(panel): geciken taksit gruplama, sıralama ve hatırlatma metni"
```

---

### Task 3: `/odemeler/gecikenler` sayfası ve Ödemeler'den bağlantı

**Files:**
- Create: `apps/panel/app/(app)/odemeler/gecikenler/page.tsx`
- Create: `apps/panel/components/overdue-student-card.tsx`
- Modify: `apps/panel/app/(app)/odemeler/page.tsx` (başlık paragrafının altına bağlantı)

**Interfaces:**
- Consumes: `v_overdue_installments` (Task 1), `groupOverdueByStudent`, `sortOverdue`, `normalizeOverdueSort`, `overdueTotals`, `reminderMessage` (Task 2), `WhatsAppButton` (`@/components/whatsapp-button`), `getSessionProfile`, `createServerSupabase`, `formatTRY`, `ITEM_TYPES`, `label`.
- Produces: rota `/odemeler/gecikenler?sirala=gun|tutar|isim`; bileşen `OverdueStudentCard({ student }: { student: OverdueStudent })`.

- [ ] **Step 1: Kart bileşenini yaz**

`apps/panel/components/overdue-student-card.tsx`:

```tsx
import Link from "next/link";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ITEM_TYPES, label } from "@/lib/constants";
import { formatTRY } from "@/lib/money";
import { reminderMessage, type OverdueStudent } from "@/lib/overdue";
import { waMeUrl } from "@/lib/whatsapp";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

export function OverdueStudentCard({ student }: { student: OverdueStudent }) {
  const message = reminderMessage(student);
  const hasValidPhone = Boolean(student.phone && waMeUrl(student.phone));

  return (
    <li className="rounded-2xl border border-red-200 bg-destructive-soft p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={`/ogrenciler/${student.studentId}`} className="font-semibold text-foreground hover:underline">
            {student.studentName}
          </Link>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {student.items.map((item) => (
              <li key={item.installmentId} className="flex flex-wrap gap-x-2">
                <span>{label(ITEM_TYPES, item.itemType)}</span>
                <span>· vade {dateFormatter.format(new Date(`${item.dueDate}T12:00:00+03:00`))}</span>
                <span className="font-semibold text-red-700">· {item.daysOverdue} gün</span>
                <span className="tabular-nums">· {formatTRY(item.amountKurus)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-lg font-semibold tabular-nums text-foreground">{formatTRY(student.totalKurus)}</span>
          {hasValidPhone ? (
            <WhatsAppButton phone={student.phone!} message={message} />
          ) : (
            <Link href={`/ogrenciler/${student.studentId}`} className="text-sm font-medium text-muted-foreground underline">
              Telefon yok · öğrenci kartına ekle
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Sayfayı yaz**

`apps/panel/app/(app)/odemeler/gecikenler/page.tsx`:

```tsx
import Link from "next/link";
import { OverdueStudentCard } from "@/components/overdue-student-card";
import { getSessionProfile } from "@/lib/auth";
import { formatTRY } from "@/lib/money";
import {
  groupOverdueByStudent,
  normalizeOverdueSort,
  overdueTotals,
  sortOverdue,
  type OverdueRow,
  type OverdueSort,
} from "@/lib/overdue";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SORT_LABELS: Record<OverdueSort, string> = { gun: "En çok geciken", tutar: "En yüksek tutar", isim: "İsim" };

export default async function GecikenlerPage({ searchParams }: { searchParams: SearchParams }) {
  await getSessionProfile();
  const params = await searchParams;
  const sortParam = Array.isArray(params.sirala) ? params.sirala[0] : params.sirala;
  const sort = normalizeOverdueSort(sortParam);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("v_overdue_installments")
    .select("installment_id, student_id, student_name, family_phone, due_date, amount, days_overdue, item_type, season")
    .order("due_date", { ascending: true });

  const students = sortOverdue(groupOverdueByStudent((data ?? []) as OverdueRow[]), sort);
  const totals = overdueTotals(students);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/odemeler" className="text-sm font-medium text-muted-foreground hover:underline">← Ödemeler</Link>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Gecikenler</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vadesi geçmiş, hâlâ bekleyen taksitler. WhatsApp düğmesi hazır bir hatırlatma metniyle kendi telefonunuzda açılır; göndermeden önce düzenleyebilirsiniz.
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          Geciken taksitler yüklenemedi. Sayfayı yenileyin; sorun sürerse yöneticiye haber verin.
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Toplam geciken</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatTRY(totals.totalKurus)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Öğrenci</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{totals.students}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Taksit</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{totals.installments}</p>
            </div>
          </section>

          <nav aria-label="Sıralama" className="flex flex-wrap gap-2">
            {(Object.keys(SORT_LABELS) as OverdueSort[]).map((key) => (
              <Link
                key={key}
                href={`/odemeler/gecikenler?sirala=${key}`}
                aria-current={key === sort ? "page" : undefined}
                className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  key === sort ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground hover:bg-muted"
                }`}
              >
                {SORT_LABELS[key]}
              </Link>
            ))}
          </nav>

          {students.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
              Geciken taksit yok.
            </p>
          ) : (
            <ul className="space-y-3">
              {students.map((student) => (
                <OverdueStudentCard key={student.studentId} student={student} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Ödemeler'e bağlantı ekle**

`apps/panel/app/(app)/odemeler/page.tsx` içinde, `<h1 …>Ödemeler</h1>`'in altındaki açıklama `</p>`'sinden hemen sonra (aynı `<div>` içinde):

```tsx
        <Link
          href="/odemeler/gecikenler"
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-red-200 bg-destructive-soft px-3 text-sm font-semibold text-red-700 hover:border-red-300"
        >
          Gecikenler ve hatırlatma →
        </Link>
```

(`Link` dosyada zaten import edili.)

- [ ] **Step 4: Elle doğrula**

Run: `pnpm --filter @seker/panel exec tsc --noEmit` → hata yok.
Run: `pnpm --filter @seker/panel dev`, danışman hesabıyla `/odemeler` → "Gecikenler ve hatırlatma" → `/odemeler/gecikenler`.
Expected:
- Task 1'deki "Gecikme Öğrenci" kartı: tek kalem "Aidat · vade … · 10 gün · 10.000,00 ₺", toplam 10.000,00 ₺.
- WhatsApp düğmesinin bağlantısı `https://wa.me/905551112233?text=Merhaba%2C%20Gecikme%20%C3%96%C4%9Frenci%20i%C3%A7in…` ile başlar (tarayıcıda "Bağlantıyı kopyala" ile kontrol et).
- `?sirala=tutar` ve `?sirala=isim` sırayı değiştirir; seçili düğme koyu görünür.
- Telefon genişliğinde (390 px) kartlar tek sütun, yatay kayma yok.

- [ ] **Step 5: Commit**

```bash
git add "apps/panel/app/(app)/odemeler/gecikenler/page.tsx" apps/panel/components/overdue-student-card.tsx "apps/panel/app/(app)/odemeler/page.tsx"
git commit -m "feat(panel): gecikenler sayfası ve WhatsApp hatırlatma"
```

---

### Task 4: Bugün ekranı — geciken özeti ve satır başına hatırlatma

**Files:**
- Modify: `apps/panel/app/(app)/bugun/page.tsx`

**Interfaces:**
- Consumes: `reminderMessage` (Task 2), `WhatsAppButton`, mevcut `daysLate(dueDate, today)` ve `one()` yardımcıları, mevcut `dueInstallments` sorgusu.
- Produces: Bugün'deki "Bugünkü / geciken tahsilat" bölümünde (1) "Geciken: N taksit · X ₺ → Gecikenler" satırı, (2) yalnızca `late > 0` satırlarda kompakt WhatsApp düğmesi. Bölümün `seeAllHref`'i `/odemeler/gecikenler` olur.

- [ ] **Step 1: Sorguya telefonu ekle**

`installments` sorgusundaki select'i değiştir:

```ts
      .select(
        "id, due_date, amount, plan:payment_plans(item_type, student:students(id, full_name, phone, family:families(phone)))",
      )
```

Dosyanın üstündeki tip tanımlarını güncelle:

```ts
interface FamilyJoin {
  phone: string | null;
}

interface StudentJoin {
  id: string;
  full_name: string;
  phone: string | null;
  family?: FamilyJoin | FamilyJoin[] | null;
}
```

Importlara ekle:

```ts
import { reminderMessage } from "@/lib/overdue";
```

- [ ] **Step 2: Geciken özetini hesapla**

`const tahsilatTotalKurus = …` satırının altına:

```ts
  const overdueOnly = dueInstallments.filter((row) => daysLate(row.due_date, today) > 0);
  const overdueOnlyKurus = overdueTotalKurus(overdueOnly.map((row) => ({ amount: row.amount })));
```

- [ ] **Step 3: Bölümü güncelle**

"Bugünkü / geciken tahsilat" `SectionBlock`'unda `seeAllHref="/odemeler"` → `seeAllHref="/odemeler/gecikenler"`.

"Toplam bekleyen" kutusunun (`<div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">…</div>`) hemen altına:

```tsx
            {overdueOnly.length > 0 ? (
              <Link
                href="/odemeler/gecikenler"
                className="flex items-center justify-between rounded-2xl border border-red-200 bg-destructive-soft px-4 py-3 text-sm font-semibold text-red-700 hover:border-red-300"
              >
                <span>Geciken: {overdueOnly.length} taksit</span>
                <span className="tabular-nums">{formatTRY(overdueOnlyKurus)} →</span>
              </Link>
            ) : null}
```

Taksit satırında, tutarı gösteren `<span className="text-base font-semibold tabular-nums text-foreground">` öğesini şu blokla değiştir:

```tsx
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold tabular-nums text-foreground">
                        {formatTRY(tlToKurus(Number(row.amount)))}
                      </span>
                      {late > 0 && student ? (() => {
                        const family = one(student.family);
                        const phone = student.phone || family?.phone || null;
                        return phone ? (
                          <WhatsAppButton
                            phone={phone}
                            compact
                            message={reminderMessage({
                              studentName: student.full_name,
                              totalKurus: tlToKurus(Number(row.amount)),
                              items: [{ dueDate: row.due_date, itemType: plan?.item_type ?? "diger" }],
                            })}
                          />
                        ) : null;
                      })() : null}
                    </div>
```

- [ ] **Step 4: Elle doğrula**

Run: `pnpm --filter @seker/panel exec tsc --noEmit` → hata yok.
Run: `pnpm --filter @seker/panel exec vitest run tests/unit` → tüm birim testleri PASS.
`pnpm --filter @seker/panel dev` → `/bugun`:
- "Geciken: 1 taksit · 10.000,00 ₺ →" satırı görünür ve `/odemeler/gecikenler`'e gider.
- 10 gün gecikmiş satırda yeşil WhatsApp düğmesi var; "Bugün vadeli" satırında yok.
- "Tümünü gör" bağlantısı `/odemeler/gecikenler`'e gider.

- [ ] **Step 5: Commit**

```bash
git add "apps/panel/app/(app)/bugun/page.tsx"
git commit -m "feat(panel): Bugün ekranında geciken özeti ve hatırlatma düğmesi"
```

---

### Task 5: Dashboard aylık özetine tahsil oranı ve bağlantı

**Files:**
- Modify: `apps/panel/app/(app)/dashboard/page.tsx` (`PaymentSummarySection`)

**Interfaces:**
- Consumes: `collectionRatePercent` (Task 2), mevcut `PaymentSummary` (`dueThisMonthKurus`, `paidThisMonthKurus`, `overdueKurus`), mevcut `MetricCard`.
- Produces: "Bu ay tahsil edilen" kartının açıklamasında oran; "Toplam geciken" kartının altında `/odemeler/gecikenler` bağlantısı.

- [ ] **Step 1: Bölümü güncelle**

Importlara ekle:

```ts
import Link from "next/link";
import { collectionRatePercent } from "@/lib/overdue";
```

(`Link` zaten import ediliyse ikinciyi ekleme.)

`PaymentSummarySection` fonksiyonunu şu hale getir:

```tsx
function PaymentSummarySection({ summary }: { summary: PaymentSummary }) {
  const rate = collectionRatePercent(summary.paidThisMonthKurus, summary.dueThisMonthKurus);
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <MetricCard
        label="Bu ay vadesi gelen"
        value={formatTRY(summary.dueThisMonthKurus)}
        helper="Seçili ayda vadesi gelen tüm taksitlerin toplamı"
      />
      <MetricCard
        label="Bu ay tahsil edilen"
        value={formatTRY(summary.paidThisMonthKurus)}
        helper={`Seçili ay içinde ödendi işaretlenen taksitler · vadesi gelenin ${rate == null ? "—" : `%${rate}`}'i`}
      />
      <div className="space-y-2">
        <MetricCard
          label="Toplam geciken"
          value={formatTRY(summary.overdueKurus)}
          helper="Bugünden önce vadeli, hâlâ bekleyen taksitler"
        />
        {summary.overdueKurus > 0 ? (
          <Link href="/odemeler/gecikenler" className="inline-flex min-h-11 items-center text-sm font-semibold text-red-700 hover:underline">
            Gecikenleri gör ve hatırlat →
          </Link>
        ) : null}
      </div>
    </section>
  );
}
```

> Not: "tahsil edilen" ay içinde ödenen her taksiti sayar (eski aylarınkiler dahil), bu yüzden oran %100'ü geçebilir. Bu bilinçli; geç ödemeleri tahsilat olarak gösterir.

- [ ] **Step 2: Elle doğrula**

Run: `pnpm --filter @seker/panel exec tsc --noEmit` → hata yok.
`/dashboard?ay=2026-10` → "Bu ay tahsil edilen" kartında "… · vadesi gelenin %NN'i"; vadesi gelen olmayan bir ayda (`?ay=2030-01`) "… · vadesi gelenin —'i". Geciken varsa "Gecikenleri gör ve hatırlat →" bağlantısı var.

- [ ] **Step 3: Tüm panel testlerini çalıştır ve commit**

Run: `pnpm --filter @seker/panel test`
Expected: tüm birim ve RLS testleri PASS.

```bash
git add "apps/panel/app/(app)/dashboard/page.tsx"
git commit -m "feat(panel): aylık özette tahsil oranı ve gecikenler bağlantısı"
```

---

## Self-review notları

- **Spec kapsamı:** gecikenler listesi (Task 1, 3), WhatsApp hatırlatma, otomatik gönderim yok (Task 2–4), aylık özet beklenen/tahsil/geciken (mevcut Dashboard + Task 5'te oran), Bugün kartı (Task 4).
- **Tip tutarlılığı:** `OverdueRow` alanları view kolonlarıyla birebir; `reminderMessage` hem `OverdueStudent` (Task 3, yapısal olarak uyumlu) hem tek satır (Task 4) ile çağrılıyor.
- **Bağımlılık:** Faz 0 sonrası RLS test yardımcıları `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` kullanır (Task 1 Step 1'deki anonim istemci buna dayanır).
