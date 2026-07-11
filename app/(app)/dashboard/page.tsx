import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { LEAD_SOURCES, LOST_REASONS, label } from "@/lib/constants";
import { formatTRY } from "@/lib/money";
import {
  getConsultantBreakdown,
  getFunnel,
  getLostReasons,
  getPaymentSummary,
  getSourceConversion,
  type ConsultantBreakdownRow,
  type FunnelResult,
  type LostReasonRow,
  type PaymentSummary,
  type SourceConversionRow,
} from "@/lib/queries/dashboard";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface DashboardPageProps {
  searchParams: SearchParams;
}

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function istanbulCurrentMonth(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" }).slice(0, 7);
}

function normalizeMonth(value: string | undefined): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : istanbulCurrentMonth();
}

function shiftMonth(monthIso: string, delta: number): string {
  const [year, month] = monthIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthIso: string): string {
  const [year, month] = monthIso.split("-").map(Number);
  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function MetricCard({ label: cardLabel, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{cardLabel}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{helper}</p>
    </div>
  );
}

function Bar({ widthPct, tone = "default" }: { widthPct: number; tone?: "default" | "danger" }) {
  const clamped = Math.min(100, Math.max(0, widthPct));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div
        className={`h-full rounded-full ${tone === "danger" ? "bg-red-500" : "bg-zinc-900"}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function FunnelSection({ funnel }: { funnel: FunnelResult }) {
  const stages = [
    { key: "leads", title: "Lead", value: funnel.leads },
    { key: "randevu", title: "Randevu", value: funnel.randevu },
    { key: "gorusme", title: "Görüşme", value: funnel.gorusme },
    { key: "kayit", title: "Kayıt", value: funnel.kayit },
  ];

  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Huni</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Seçili ayda oluşturulan lead&apos;lerin aşamalara göre ilerleyişi.
        </p>
      </div>
      <div className="space-y-4">
        {stages.map((stage) => (
          <div key={stage.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-zinc-700">{stage.title}</span>
              <span className="font-semibold text-zinc-950">
                {stage.value}
                {stage.key !== "leads" ? (
                  <span className="ml-2 text-xs font-medium text-zinc-500">
                    (%{pct(stage.value, funnel.leads)})
                  </span>
                ) : null}
              </span>
            </div>
            <Bar widthPct={pct(stage.value, funnel.leads)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceConversionSection({ rows }: { rows: SourceConversionRow[] }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4">
        <h2 className="text-xl font-semibold text-zinc-950">Kaynak dönüşümü</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Tüm zamanların kaynak bazında lead ve kayıt sayıları.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3">Kaynak</th>
              <th className="px-5 py-3 text-right">Lead</th>
              <th className="px-5 py-3 text-right">Kayıt</th>
              <th className="px-5 py-3 text-right">Dönüşüm %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.source} className="transition hover:bg-zinc-50">
                <td className="px-5 py-4 font-semibold text-zinc-950">
                  {label(LEAD_SOURCES, row.source)}
                </td>
                <td className="px-5 py-4 text-right text-zinc-700">{row.total}</td>
                <td className="px-5 py-4 text-right text-zinc-700">{row.won}</td>
                <td className="px-5 py-4 text-right font-semibold text-zinc-950">
                  %{pct(row.won, row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LostReasonsSection({ rows }: { rows: LostReasonRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Kayıp nedenleri</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Kaybedilen lead&apos;lerin neden dağılımı (tüm zamanlar).
        </p>
      </div>
      {rows.every((row) => row.count === 0) ? (
        <p className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Kaybedilen lead görünmüyor.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.reason} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-zinc-700">{label(LOST_REASONS, row.reason)}</span>
                <span className="font-semibold text-zinc-950">{row.count}</span>
              </div>
              <Bar widthPct={(row.count / max) * 100} tone="danger" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PaymentSummarySection({ summary }: { summary: PaymentSummary }) {
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
        helper="Seçili ay içinde ödendi işaretlenen taksitler"
      />
      <MetricCard
        label="Toplam geciken"
        value={formatTRY(summary.overdueKurus)}
        helper="Bugünden önce vadeli, hâlâ bekleyen taksitler"
      />
    </section>
  );
}

function ConsultantBreakdownSection({ rows }: { rows: ConsultantBreakdownRow[] }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4">
        <h2 className="text-xl font-semibold text-zinc-950">Danışman kırılımı</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Tüm zamanların danışman bazında lead ve kayıt sayıları.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3">Danışman</th>
              <th className="px-5 py-3 text-right">Lead</th>
              <th className="px-5 py-3 text-right">Kayıt</th>
              <th className="px-5 py-3 text-right">Dönüşüm %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.consultantId} className="transition hover:bg-zinc-50">
                <td className="px-5 py-4 font-semibold text-zinc-950">{row.consultantName}</td>
                <td className="px-5 py-4 text-right text-zinc-700">{row.leads}</td>
                <td className="px-5 py-4 text-right text-zinc-700">{row.won}</td>
                <td className="px-5 py-4 text-right font-semibold text-zinc-950">
                  %{pct(row.won, row.leads)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const month = normalizeMonth(first(params.ay));
  const profile = await getSessionProfile();
  const isYonetici = profile.role === "yonetici";

  const [funnel, sourceConversion, lostReasons, paymentSummary, consultantBreakdown] = await Promise.all([
    getFunnel(month),
    getSourceConversion(),
    getLostReasons(),
    getPaymentSummary(month),
    isYonetici ? getConsultantBreakdown() : Promise.resolve<ConsultantBreakdownRow[]>([]),
  ]);

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Analiz</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {formatMonthLabel(month)} ayı için huni, kaynak dönüşümü ve ödeme özeti.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard?ay=${prevMonth}`}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
          >
            Önceki ay
          </Link>
          <Link
            href={`/dashboard?ay=${nextMonth}`}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
          >
            Sonraki ay
          </Link>
        </div>
      </div>

      <form
        action="/dashboard"
        className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end"
      >
        <div>
          <label htmlFor="ay" className="text-sm font-medium text-zinc-700">
            Ay seç
          </label>
          <input
            id="ay"
            name="ay"
            type="month"
            defaultValue={month}
            className="mt-2 block rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Ayı Göster
        </button>
      </form>

      <FunnelSection funnel={funnel} />

      <PaymentSummarySection summary={paymentSummary} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SourceConversionSection rows={sourceConversion} />
        <LostReasonsSection rows={lostReasons} />
      </div>

      {isYonetici ? <ConsultantBreakdownSection rows={consultantBreakdown} /> : null}
    </div>
  );
}
