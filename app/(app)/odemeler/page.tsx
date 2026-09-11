import Link from "next/link";
import { AlertTriangle, Banknote, Clock } from "lucide-react";
import { PaymentMatrixCell } from "@/components/payment-matrix-cell";
import { STUDENT_STATUSES, label } from "@/lib/constants";
import { getSessionProfile } from "@/lib/auth";
import { formatTRY, tlToKurus } from "@/lib/money";
import {
  buildPaymentMatrix,
  summarizeRows,
  type MatrixRow,
  type MatrixStudentInput,
} from "@/lib/payment-matrix";
import { badgeClass, STUDENT_STATUS_STYLES } from "@/lib/status-styles";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS = {
  tumu: "Tümü",
  geciken: "Gecikeni olanlar",
  plansiz: "Planı olmayanlar",
} as const;
type FilterKey = keyof typeof FILTERS;

const monthShortFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  timeZone: "Europe/Istanbul",
});
const monthLongFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function monthDate(monthKey: string) {
  return new Date(`${monthKey}-01T12:00:00+03:00`);
}

/** "2026-09" -> "Eyl 26" */
function shortMonthLabel(monthKey: string) {
  return `${monthShortFormatter.format(monthDate(monthKey))} ${monthKey.slice(2, 4)}`;
}

/** "2026-09" -> "Eylül 2026" */
function longMonthLabel(monthKey: string) {
  return monthLongFormatter.format(monthDate(monthKey));
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function istanbulMonthUtcIso(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1, -3)).toISOString();
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Türkçe'ye duyarlı, aksansız arama karşılaştırması. */
function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesSearch(student: MatrixStudentInput & { phone: string | null }, query: string) {
  if (!query) return true;
  const needle = normalize(query);
  return [student.full_name, student.parent_name, student.phone].some(
    (field) => field && normalize(field).includes(needle),
  );
}

function overdueKurus(rows: MatrixRow[]) {
  return rows.reduce(
    (rowSum, row) =>
      rowSum +
      Object.values(row.cells).reduce(
        (cellSum, cell) =>
          cellSum +
          cell.items.reduce((sum, item) => (item.overdue ? sum + item.amountKurus : sum), 0),
        0,
      ),
    0,
  );
}

function hrefWith(
  current: Record<string, string | undefined>,
  updates: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  Object.entries({ ...current, ...updates }).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/odemeler?${query}` : "/odemeler";
}

function SummaryCard({
  label: cardLabel,
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
      className={`rounded-2xl border bg-surface p-5 shadow-sm ${danger ? "border-red-200" : "border-border"}`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex size-10 items-center justify-center rounded-xl ${chipClass}`}>
          {icon}
        </span>
        <p className="text-sm font-medium text-muted-foreground">{cardLabel}</p>
      </div>
      <p
        className={`mt-3 text-2xl font-semibold tabular-nums ${danger ? "text-red-700" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function Money({ kurus, muted = false }: { kurus: number | null; muted?: boolean }) {
  if (kurus === null) return <span className="text-muted-foreground/60">—</span>;
  return (
    <span className={`tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}>
      {formatTRY(kurus)}
    </span>
  );
}

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  const today = todayInIstanbul();
  const currentMonth = today.slice(0, 7);
  const [year, month] = today.split("-").map(Number);

  const [studentsResult, paidResult] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, full_name, parent_name, phone, season, status, payment_plans(id, item_type, season, total_amount, installment_count, installments(id, due_date, amount, status, paid_at, paid_amount, payment_method))",
      ),
    supabase
      .from("installments")
      .select("amount, paid_amount")
      .eq("status", "odendi")
      .gte("paid_at", istanbulMonthUtcIso(year, month - 1))
      .lt("paid_at", istanbulMonthUtcIso(year, month)),
  ]);

  const allStudents = (studentsResult.data ?? []) as unknown as (MatrixStudentInput & {
    phone: string | null;
  })[];

  const seasons = [
    ...new Set(
      allStudents.flatMap((student) => [
        student.season,
        ...(student.payment_plans ?? []).map((plan) => plan.season),
      ]),
    ),
  ]
    .filter(Boolean)
    .sort()
    .reverse();

  const seasonParam = first(params.sezon) ?? "";
  const season = seasons.includes(seasonParam) ? seasonParam : (seasons[0] ?? "");
  const query = (first(params.q) ?? "").trim();
  const filterParam = first(params.filtre) ?? "";
  const filter: FilterKey = filterParam in FILTERS ? (filterParam as FilterKey) : "tumu";
  const includePast = first(params.gecmis) === "1";

  const inScope = allStudents.filter((student) => {
    if (!includePast && student.status !== "aktif") return false;
    if (!matchesSearch(student, query)) return false;
    return (
      student.season === season ||
      (student.payment_plans ?? []).some((plan) => plan.season === season)
    );
  });

  const matrix = buildPaymentMatrix(inScope, today, season);
  const rows = matrix.rows.filter((row) => {
    if (filter === "geciken") return row.hasOverdue;
    if (filter === "plansiz") return !row.hasPlan;
    return true;
  });
  const { columnTotals, grandTotal } = summarizeRows(matrix.months, rows);

  const dueThisMonthKurus = matrix.rows.reduce((sum, row) => {
    const cell = row.cells[currentMonth];
    return cell ? sum + (cell.totalKurus - cell.paidKurus) : sum;
  }, 0);
  const collectedThisMonthKurus = (paidResult.data ?? []).reduce(
    (sum, row: { amount: number; paid_amount: number | null }) =>
      sum + tlToKurus(Number(row.paid_amount ?? row.amount)),
    0,
  );

  const currentParams = {
    sezon: season || undefined,
    q: query || undefined,
    filtre: filter === "tumu" ? undefined : filter,
    gecmis: includePast ? "1" : undefined,
  };
  const columnCount = 4 + matrix.months.length + 3;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Ödeme takibi</p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Ödemeler</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tüm öğrencilerin aylık ödeme durumu tek tabloda. Bir hücreye tıklayarak o ayın
          kalemlerini görebilir ve ödendi işaretleyebilirsiniz.
        </p>
      </div>

      {studentsResult.error || paidResult.error ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          Ödeme bilgileri yüklenirken bir sorun oluştu.
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Bu ay beklenen"
          value={formatTRY(dueThisMonthKurus)}
          helper="Bu ay vadesi gelen, henüz tahsil edilmemiş tutar"
          icon={<Clock aria-hidden className="size-5" />}
          chipClass="bg-primary-soft text-primary"
        />
        <SummaryCard
          label="Bu ay tahsil edilen"
          value={formatTRY(collectedThisMonthKurus)}
          helper="Bu ay içinde ödendi işaretlenen taksitler"
          icon={<Banknote aria-hidden className="size-5" />}
          chipClass="bg-accent-soft text-emerald-700"
        />
        <SummaryCard
          label="Toplam geciken"
          value={formatTRY(overdueKurus(matrix.rows))}
          helper="Vadesi geçmiş, hâlâ bekleyen taksitler"
          icon={<AlertTriangle aria-hidden className="size-5" />}
          chipClass="bg-destructive-soft text-red-700"
          danger
        />
      </section>

      <form
        action="/odemeler"
        className="grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      >
        <label className="block text-sm font-medium text-foreground">
          Arama
          <input
            name="q"
            defaultValue={query}
            placeholder="Öğrenci, veli veya telefon"
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          Sezon
          <select
            name="sezon"
            defaultValue={season}
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            {seasons.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Filtrele
        </button>
        {filter !== "tumu" ? <input type="hidden" name="filtre" value={filter} /> : null}
        {includePast ? <input type="hidden" name="gecmis" value="1" /> : null}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FILTERS) as FilterKey[]).map((key) => {
          const active = key === filter;
          return (
            <Link
              key={key}
              href={hrefWith(currentParams, { filtre: key === "tumu" ? undefined : key })}
              aria-current={active ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {FILTERS[key]}
            </Link>
          );
        })}
        <Link
          href={hrefWith(currentParams, { gecmis: includePast ? undefined : "1" })}
          className={`inline-flex min-h-11 items-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            includePast
              ? "border-primary bg-primary-soft text-primary"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          }`}
        >
          Ayrılan ve mezunlar {includePast ? "dahil" : "hariç"}
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="min-w-full text-sm">
          <caption className="sr-only">
            {season} sezonu öğrenci bazlı aylık ödeme tablosu
          </caption>
          <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-56 bg-muted px-4 py-3 text-left">
                Öğrenci
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-right">
                Aidat/ay
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Kitap
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Servis
              </th>
              {matrix.months.map((monthKey) => (
                <th
                  key={monthKey}
                  scope="col"
                  title={longMonthLabel(monthKey)}
                  className={`whitespace-nowrap px-2 py-3 text-right ${
                    monthKey === currentMonth ? "text-primary" : ""
                  }`}
                >
                  {shortMonthLabel(monthKey)}
                </th>
              ))}
              <th scope="col" className="px-3 py-3 text-right">
                Toplam
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Ödenen
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Kalan
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.studentId} className={row.hasPlan ? undefined : "bg-warning-soft/50"}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 min-w-56 border-r border-border px-4 py-2 text-left font-normal ${
                    row.hasPlan ? "bg-surface" : "bg-warning-soft"
                  }`}
                >
                  <Link
                    href={`/ogrenciler/${row.studentId}`}
                    className="whitespace-nowrap font-semibold text-foreground hover:underline"
                  >
                    {row.fullName}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {row.parentName || "Veli bilgisi yok"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {row.hasPlan ? null : (
                      <>
                        <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                          Plan yok
                        </span>
                        <Link
                          href={`/ogrenciler/${row.studentId}`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Plan oluştur
                        </Link>
                      </>
                    )}
                    {row.status === "aktif" ? null : (
                      <span className={badgeClass(STUDENT_STATUS_STYLES[row.status])}>
                        {label(STUDENT_STATUSES, row.status)}
                      </span>
                    )}
                  </div>
                </th>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Money kurus={row.aidatMonthlyKurus} muted />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Money kurus={row.kitapKurus} muted />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Money kurus={row.servisMonthlyKurus} muted />
                </td>
                {matrix.months.map((monthKey) => (
                  <PaymentMatrixCell
                    key={monthKey}
                    cell={row.cells[monthKey]}
                    studentName={row.fullName}
                    monthLabel={longMonthLabel(monthKey)}
                    role={profile.role}
                  />
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                  <Money kurus={row.totalKurus} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-accent-strong tabular-nums">
                  {formatTRY(row.paidKurus)}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${
                    row.hasOverdue ? "text-red-700" : "text-foreground"
                  }`}
                >
                  {formatTRY(row.remainingKurus)}
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center text-muted-foreground">
                  Bu filtrelerle öğrenci bulunamadı.
                </td>
              </tr>
            ) : null}
          </tbody>

          {rows.length > 0 ? (
            <tfoot className="border-t-2 border-border bg-muted text-sm font-semibold">
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-56 whitespace-nowrap bg-muted px-4 py-3 text-left"
                >
                  Toplam · {rows.length} öğrenci
                </th>
                <td colSpan={3} />
                {columnTotals.map((column) => (
                  <td key={column.monthKey} className="whitespace-nowrap px-2 py-3 text-right">
                    <span className="block tabular-nums text-foreground">
                      {formatTRY(column.expectedKurus)}
                    </span>
                    <span className="block text-xs font-medium tabular-nums text-accent-strong">
                      {formatTRY(column.paidKurus)} tahsil
                    </span>
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                  {formatTRY(grandTotal.totalKurus)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-accent-strong">
                  {formatTRY(grandTotal.paidKurus)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                  {formatTRY(grandTotal.remainingKurus)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {matrix.months.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          {season} sezonunda henüz ödeme planı girilmemiş. Öğrenci detayından plan oluşturun.
        </p>
      ) : null}
    </div>
  );
}
