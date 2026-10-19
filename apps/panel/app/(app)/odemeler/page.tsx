import { headers } from "next/headers";
import Link from "next/link";
import { AlertTriangle, Banknote, Clock, Download, PiggyBank } from "lucide-react";
import { EXCEL_FILLS, PaymentMatrixCell, PaymentRowProvider } from "@/components/payment-matrix-cell";
import { paymentContextFor } from "@/lib/payment-context";
import { fetchPaymentTraces } from "@/lib/queries/payment-traces";
import { STUDENT_STATUSES, label } from "@/lib/constants";
import { getSessionProfile } from "@/lib/auth";
import { isPhoneRequest } from "@/lib/device";
import { formatTRY, tlToKurus } from "@/lib/money";
import {
  buildPaymentMatrix,
  SIDE_COLUMNS,
  sideCellOf,
  summarizeRows,
  type SideColumn,
} from "@/lib/payment-matrix";
import { badgeClass, STUDENT_STATUS_STYLES } from "@/lib/status-styles";
import {
  filterRows,
  PAYMENT_FILTERS as FILTERS,
  PAYMENT_STUDENTS_SELECT,
  resolveScope,
  seasonsOf,
  studentsInScope,
  todayInIstanbul,
  type PaymentFilterKey as FilterKey,
  type PaymentStudent,
} from "@/lib/payments-scope";
import {
  dueThisMonthKurusOf,
  overdueKurusOf,
  seasonSummaryOf,
} from "@/lib/payments-summary";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const monthNameFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
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

/** "2026-09" -> "EYLÜL" (Excel defterindeki başlık) */
function sheetMonthLabel(monthKey: string) {
  return monthNameFormatter.format(monthDate(monthKey)).toLocaleUpperCase("tr");
}

/** Excel defterindeki yan sütun başlıkları. */
const SIDE_HEADERS: Record<SideColumn, string> = {
  kitap: "Kitap - Kırtasiye",
  aidat: "Aidat Tutarı",
  servis: "Servis Tutarı",
};
const SIDE_DIALOG_LABELS: Record<SideColumn, string> = {
  kitap: "Kitap - Kırtasiye",
  aidat: "Yıllık aidat (peşin)",
  servis: "Servis",
};

const LEGEND = [
  { fill: EXCEL_FILLS.odendi, text: "Ödendi" },
  { fill: EXCEL_FILLS.nakit, text: "Nakit ödendi" },
  { fill: EXCEL_FILLS.kismi, text: "Kısmi ödendi" },
  { fill: EXCEL_FILLS.gecikti, text: "Alınmadı" },
  { fill: "border border-border bg-surface", text: "Vadesi gelmedi" },
];

/** "2026-09" -> "Eylül 2026" */
function longMonthLabel(monthKey: string) {
  return monthLongFormatter.format(monthDate(monthKey));
}

function istanbulMonthUtcIso(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1, -3)).toISOString();
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
  const phone = isPhoneRequest(await headers());
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  const today = todayInIstanbul();
  const currentMonth = today.slice(0, 7);
  const [year, month] = today.split("-").map(Number);

  const [studentsResult, paidResult, traces] = await Promise.all([
    supabase
      .from("students")
      .select(PAYMENT_STUDENTS_SELECT),
    supabase
      .from("installments")
      .select("amount, paid_amount")
      .eq("status", "odendi")
      .gte("paid_at", istanbulMonthUtcIso(year, month - 1))
      .lt("paid_at", istanbulMonthUtcIso(year, month)),
    fetchPaymentTraces(supabase),
  ]);

  const allStudents = (studentsResult.data ?? []) as unknown as PaymentStudent[];
  const seasons = seasonsOf(allStudents);
  const { season, query, filter, includePast } = resolveScope(params, seasons);
  const inScope = studentsInScope(allStudents, { season, query, filter, includePast });

  const matrix = buildPaymentMatrix(inScope, today, season);
  const phoneById = new Map(allStudents.map((student) => [student.id, student.phone]));
  const rows = filterRows(matrix.rows, filter, currentMonth);
  // Satır bağlamı telefon kartlarında ve masaüstü tablosunda aynı nesne olarak
  // verilir; React onu sayfa verisine bir kez yazar (yoksa iki kopya gider).
  const contextById = new Map(
    rows.map((row) => [
      row.studentId,
      paymentContextFor(row, { id: row.studentId, phone: phoneById.get(row.studentId) ?? null }, traces),
    ]),
  );
  const { columnTotals, sideTotals, grandTotal } = summarizeRows(matrix.months, rows);

  const dueThisMonthKurus = dueThisMonthKurusOf(matrix.rows, currentMonth);
  const seasonSummary = seasonSummaryOf(matrix.rows);
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
  const columnCount = 2 + SIDE_COLUMNS.length + matrix.months.length + 3;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Ödeme takibi</p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Ödemeler</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Aidat listesi defterinin düzeni: kitap, aidat ve servis sütunları, ardından aylar.
          Renkler defterdeki gibi. Bir hücreye dokunarak ayrıntısını ve notunu görebilir, ödeme
          alabilir ya da WhatsApp ile hatırlatabilirsiniz.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/odemeler/gecikenler"
            className="inline-flex min-h-11 items-center rounded-xl border border-red-200 bg-destructive-soft px-3 text-sm font-semibold text-red-700 hover:border-red-300"
          >
            Gecikenler ve hatırlatma →
          </Link>
          {profile.role === "yonetici" ? (
            <Link
              href="/odemeler/zam"
              className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Toplu zam
            </Link>
          ) : null}
        </div>
      </div>

      {studentsResult.error || paidResult.error ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          Ödeme bilgileri yüklenirken bir sorun oluştu.
        </p>
      ) : null}

      {seasonSummary.totalKurus > 0 ? (
        <section
          aria-label={`${season} sezonu toplamı`}
          className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <PiggyBank aria-hidden className="size-5" />
            </span>
            <p className="text-sm font-medium text-muted-foreground">
              {season} sezonu toplamı · {seasonSummary.studentCount} öğrenci
            </p>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Toplam alacak</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {formatTRY(seasonSummary.totalKurus)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Tahsil edilen</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-accent-strong">
                {formatTRY(seasonSummary.paidKurus)}
                {seasonSummary.collectionRate != null ? (
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    %{Math.round(seasonSummary.collectionRate * 100)}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Kalan</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {formatTRY(seasonSummary.remainingKurus)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Geciken</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-red-700">
                {formatTRY(seasonSummary.overdueKurus)}
                <span className="ml-2 text-sm font-medium text-muted-foreground">
                  {seasonSummary.overdueStudentCount} öğrenci
                </span>
              </dd>
            </div>
          </dl>
          {seasonSummary.totalKurus > 0 ? (
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Tahsilat oranı %${Math.round((seasonSummary.collectionRate ?? 0) * 100)}`}
            >
              <div
                className="h-full rounded-full bg-accent-strong"
                style={{ width: `${Math.round((seasonSummary.collectionRate ?? 0) * 100)}%` }}
              />
            </div>
          ) : null}
        </section>
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
          value={formatTRY(overdueKurusOf(matrix.rows))}
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
        <a
          href={hrefWith(currentParams, {}).replace("/odemeler", "/odemeler/excel")}
          download
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download aria-hidden className="size-4" />
          Excel indir
        </a>
      </div>

      <ul
        className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
        aria-label="Renklerin anlamı"
      >
        {LEGEND.map((item) => (
          <li key={item.text} className="flex items-center gap-2">
            <span aria-hidden className={`inline-block size-4 rounded ${item.fill}`} />
            {item.text}
          </li>
        ))}
      </ul>

      {/* Telefon: tablo yerine öğrenci kartları; her kartta aidat listesindeki satır kutular hâlinde.
          İki düzenden yalnız cihaza uyanı çizilir: ikisi birden ~2000 hücreyi iki kez gönderiyordu. */}
      {phone ? (
        <ul className="space-y-3" aria-label={`${season} sezonu öğrenci ödemeleri`}>
          {rows.map((row) => (
            <li
              key={row.studentId}
              className={`rounded-2xl border p-4 shadow-sm ${row.hasPlan ? "border-border bg-surface" : "border-amber-200 bg-warning-soft"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/ogrenciler/${row.studentId}`} className="text-base font-semibold text-foreground hover:underline">
                    {row.fullName}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">{row.parentName || "Veli bilgisi yok"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-base font-semibold tabular-nums ${row.hasOverdue ? "text-red-700" : "text-foreground"}`}>
                    {formatTRY(row.remainingKurus)}
                  </p>
                  <p className="text-xs text-muted-foreground">kalan</p>
                </div>
              </div>
              {row.hasPlan ? (
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <PaymentRowProvider
                    value={contextById.get(row.studentId)!}
                  >
                    {SIDE_COLUMNS.map((column) => {
                      const cell = sideCellOf(row, column);
                      return cell ? (
                        <PaymentMatrixCell
                          key={column}
                          cell={cell}
                          studentName={row.fullName}
                          monthLabel={SIDE_DIALOG_LABELS[column]}
                          role={profile.role}
                          variant="tile"
                          tileLabel={column === "kitap" ? "Kitap" : column === "aidat" ? "Aidat (peşin)" : "Servis"}
                        />
                      ) : null;
                    })}
                    {matrix.months.map((monthKey) => (
                      <PaymentMatrixCell
                        key={monthKey}
                        cell={row.cells[monthKey]}
                        studentName={row.fullName}
                        monthLabel={longMonthLabel(monthKey)}
                        role={profile.role}
                        variant="tile"
                        tileLabel={sheetMonthLabel(monthKey)}
                      />
                    ))}
                  </PaymentRowProvider>
                </div>
              ) : (
                <Link
                  href={`/ogrenciler/${row.studentId}`}
                  className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary"
                >
                  Ödeme planı kur
                </Link>
              )}
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="rounded-2xl border border-border bg-surface p-6 text-center text-muted-foreground">
              Bu filtrelerle öğrenci bulunamadı.
            </li>
          ) : null}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="min-w-full text-sm">
            <caption className="sr-only">
              {season} sezonu öğrenci bazlı aylık ödeme tablosu
            </caption>
            <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-56 bg-muted px-4 py-3 text-left">
                  Öğrenci Adı ve Soyadı
                </th>
                <th scope="col" className="min-w-44 whitespace-nowrap px-3 py-3 text-left">
                  Anne &amp; Baba Adı
                </th>
                {SIDE_COLUMNS.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="whitespace-nowrap border-l border-border px-2 py-3 text-right"
                  >
                    {SIDE_HEADERS[column]}
                  </th>
                ))}
                {matrix.months.map((monthKey) => (
                  <th
                    key={monthKey}
                    scope="col"
                    title={longMonthLabel(monthKey)}
                    className={`whitespace-nowrap border-l border-border px-2 py-3 text-right ${
                      monthKey === currentMonth ? "text-primary" : ""
                    }`}
                  >
                    {sheetMonthLabel(monthKey)}
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
                    <div className="mt-1 flex flex-wrap items-center gap-2 empty:hidden">
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
                  <td className="whitespace-nowrap px-3 py-2 text-left text-sm text-muted-foreground">
                    {row.parentName || "—"}
                  </td>
                  <PaymentRowProvider
                    value={contextById.get(row.studentId)!}
                  >
                  {SIDE_COLUMNS.map((column) => {
                    const cell = sideCellOf(row, column);
                    return cell ? (
                      <PaymentMatrixCell
                        key={column}
                        cell={cell}
                        studentName={row.fullName}
                        monthLabel={SIDE_DIALOG_LABELS[column]}
                        role={profile.role}
                      />
                    ) : (
                      <td key={column} className="border-l border-border" />
                    );
                  })}
                  {matrix.months.map((monthKey) => (
                    <PaymentMatrixCell
                      key={monthKey}
                      cell={row.cells[monthKey]}
                      studentName={row.fullName}
                      monthLabel={longMonthLabel(monthKey)}
                      role={profile.role}
                    />
                  ))}
                  </PaymentRowProvider>
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
                  <td />
                  {SIDE_COLUMNS.map((column) => (
                    <td
                      key={column}
                      className="whitespace-nowrap border-l border-border px-2 py-3 text-right"
                    >
                      {sideTotals[column].expectedKurus > 0 ? (
                        <>
                          <span className="block tabular-nums text-foreground">
                            {formatTRY(sideTotals[column].expectedKurus)}
                          </span>
                          <span className="block text-xs font-medium tabular-nums text-accent-strong">
                            {formatTRY(sideTotals[column].paidKurus)} tahsil
                          </span>
                        </>
                      ) : null}
                    </td>
                  ))}
                  {columnTotals.map((column) => (
                    <td
                      key={column.monthKey}
                      className="whitespace-nowrap border-l border-border px-2 py-3 text-right"
                    >
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
      )}

      {matrix.months.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          {season} sezonunda henüz ödeme planı girilmemiş. Öğrenci detayından plan oluşturun.
        </p>
      ) : null}
    </div>
  );
}
