import Link from "next/link";
import { AlertTriangle, Banknote, Clock } from "lucide-react";
import { ITEM_TYPES, label, type ItemType } from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface StudentJoin {
  id: string;
  full_name: string;
}

interface PlanJoin {
  id: string;
  item_type: ItemType;
  student_id: string;
  student?: StudentJoin | StudentJoin[] | null;
}

interface InstallmentRow {
  id: string;
  plan_id: string;
  due_date: string;
  amount: number;
  status: "bekliyor" | "odendi";
  paid_at: string | null;
  paid_amount: number | null;
  plan?: PlanJoin | PlanJoin[] | null;
}

interface PaymentSection {
  title: string;
  description: string;
  items: InstallmentRow[];
  emptyText: string;
  tone?: "danger";
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function ymd(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function istanbulTodayAsUtcDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

function istanbulMonthUtcIso(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1, -3)).toISOString();
}

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00+03:00`));
}

function totalKurus(rows: InstallmentRow[]) {
  return rows.reduce((sum, row) => sum + tlToKurus(Number(row.amount)), 0);
}

function paidTotalKurus(rows: InstallmentRow[]) {
  return rows.reduce((sum, row) => {
    if (row.paid_amount == null) return sum;
    return sum + tlToKurus(Number(row.paid_amount));
  }, 0);
}

function sortByDueDate(rows: InstallmentRow[]) {
  return [...rows].sort(
    (a, b) => a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
  );
}

function daysBetween(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((endTime - startTime) / 86400000));
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
  chipClass,
  danger = false,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  chipClass: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-surface p-5 shadow-sm ${
        danger ? "border-red-200" : "border-border"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex size-10 items-center justify-center rounded-xl ${chipClass}`}>
          {icon}
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p
        className={`mt-3 text-2xl font-semibold tabular-nums ${
          danger ? "text-red-700" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function PaymentRows({
  section,
  today,
}: {
  section: PaymentSection;
  today: string;
}) {
  const total = formatTRY(totalKurus(section.items));
  const danger = section.tone === "danger";

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div
        className={`flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between ${
          danger ? "border-red-100 bg-destructive-soft" : "border-border bg-muted"
        }`}
      >
        <div>
          <h2 className={`text-lg font-semibold ${danger ? "text-red-800" : "text-foreground"}`}>
            {section.title}
          </h2>
          <p className={`mt-1 text-sm ${danger ? "text-red-700" : "text-muted-foreground"}`}>
            {section.description}
          </p>
        </div>
        <p className={`text-sm font-semibold tabular-nums ${danger ? "text-red-800" : "text-foreground"}`}>
          Toplam: {total}
        </p>
      </div>

      {section.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Öğrenci</th>
                <th className="px-5 py-3">Kalem</th>
                <th className="px-5 py-3">Vade</th>
                <th className="px-5 py-3 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {section.items.map((item) => {
                const plan = first(item.plan);
                const student = first(plan?.student);
                const overdueDays = daysBetween(item.due_date, today);

                return (
                  <tr
                    key={`${section.title}-${item.id}`}
                    className={
                      danger
                        ? "bg-destructive-soft/40"
                        : "transition-colors hover:bg-muted/60"
                    }
                  >
                    <td className="px-5 py-4">
                      {student ? (
                        <Link
                          href={`/ogrenciler/${student.id}`}
                          className="font-semibold text-foreground hover:underline"
                        >
                          {student.full_name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-muted-foreground">Öğrenci bulunamadı</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {label(ITEM_TYPES, plan?.item_type ?? "diger")}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {formatDate(item.due_date)}
                      {danger ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                          {overdueDays} gün gecikti
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground">
                      {formatTRY(tlToKurus(Number(item.amount)))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-muted-foreground">{section.emptyText}</p>
      )}
    </section>
  );
}

export default async function PaymentsPage() {
  const supabase = await createServerSupabase();
  const todayDate = istanbulTodayAsUtcDate();
  const today = ymd(todayDate);
  const weekStart = addDays(todayDate, -((todayDate.getUTCDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 6);
  const monthStart = new Date(
    Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1),
  );
  const nextMonthStart = new Date(
    Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + 1, 1),
  );
  const monthStartYmd = ymd(monthStart);
  const nextMonthStartYmd = ymd(nextMonthStart);

  const [pendingResult, paidResult] = await Promise.all([
    supabase
      .from("installments")
      .select(
        "id, plan_id, due_date, amount, status, paid_at, paid_amount, plan:payment_plans(id, item_type, student_id, student:students(id, full_name))",
      )
      .eq("status", "bekliyor")
      .order("due_date", { ascending: true }),
    supabase
      .from("installments")
      .select("id, plan_id, due_date, amount, status, paid_at, paid_amount")
      .eq("status", "odendi")
      .gte(
        "paid_at",
        istanbulMonthUtcIso(todayDate.getUTCFullYear(), todayDate.getUTCMonth()),
      )
      .lt(
        "paid_at",
        istanbulMonthUtcIso(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + 1),
      ),
  ]);

  const pending = (pendingResult.data ?? []) as unknown as InstallmentRow[];
  const paidThisMonth = (paidResult.data ?? []) as unknown as InstallmentRow[];
  const overdue = sortByDueDate(pending.filter((row) => row.due_date < today));
  const dueThisWeek = sortByDueDate(
    pending.filter(
      (row) =>
        row.due_date >= today &&
        row.due_date >= ymd(weekStart) &&
        row.due_date <= ymd(weekEnd),
    ),
  );
  const dueThisMonth = sortByDueDate(
    pending.filter(
      (row) => row.due_date >= monthStartYmd && row.due_date < nextMonthStartYmd,
    ),
  );

  const sections: PaymentSection[] = [
    {
      title: "Geciken",
      description: "Vadesi geçmiş ve hâlâ bekleyen taksitler.",
      items: overdue,
      emptyText: "Harika, bugün geciken ödeme görünmüyor.",
      tone: "danger",
    },
    {
      title: "Bu hafta vadesi gelen",
      description: "Pazartesi-Pazar aralığında, gecikmemiş bekleyen taksitler.",
      items: dueThisWeek,
      emptyText: "Bu hafta vadesi gelen bekleyen taksit yok.",
    },
    {
      title: "Bu ay beklenen",
      description: "Bu takvim ayında vadesi gelen tüm bekleyen taksitler.",
      items: dueThisMonth,
      emptyText: "Bu ay için beklenen taksit görünmüyor.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Ödeme takibi</p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Ödemeler</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Geciken, bu hafta vadesi gelen ve bu ay beklenen taksitleri tek ekranda izleyin.
        </p>
      </div>

      {(pendingResult.error || paidResult.error) ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          Ödeme bilgileri yüklenirken bir sorun oluştu.
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Bu ay beklenen"
          value={formatTRY(totalKurus(dueThisMonth))}
          helper="Bu ay vadesi gelen bekleyen taksitler"
          icon={<Clock aria-hidden className="size-5" />}
          chipClass="bg-primary-soft text-primary"
        />
        <SummaryCard
          label="Bu ay tahsil edilen"
          value={formatTRY(paidTotalKurus(paidThisMonth))}
          helper="Bu ay içinde ödendi işaretlenen taksitler"
          icon={<Banknote aria-hidden className="size-5" />}
          chipClass="bg-accent-soft text-emerald-700"
        />
        <SummaryCard
          label="Toplam geciken"
          value={formatTRY(totalKurus(overdue))}
          helper="Bugünden önce vadeli bekleyen taksitler"
          icon={<AlertTriangle aria-hidden className="size-5" />}
          chipClass="bg-destructive-soft text-red-700"
          danger
        />
      </section>

      <div className="space-y-5">
        {sections.map((section) => (
          <PaymentRows key={section.title} section={section} today={today} />
        ))}
      </div>
    </div>
  );
}
