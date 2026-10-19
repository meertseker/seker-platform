import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { LEAD_SOURCES, LOST_REASONS, label } from "@/lib/constants";
import { formatTRY } from "@/lib/money";
import { collectionRatePercent } from "@/lib/overdue";
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
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rapor" };

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
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{cardLabel}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function Bar({ widthPct, fillClass = "bg-primary" }: { widthPct: number; fillClass?: string }) {
  const clamped = Math.min(100, Math.max(0, widthPct));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${fillClass}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function FunnelSection({ funnel }: { funnel: FunnelResult }) {
  const stages = [
    { key: "leads", title: "Veli adayı", value: funnel.leads, fillClass: "bg-primary" },
    { key: "randevu", title: "Randevu", value: funnel.randevu, fillClass: "bg-blue-500" },
    { key: "gorusme", title: "Görüşme", value: funnel.gorusme, fillClass: "bg-violet-500" },
    { key: "kayit", title: "Kayıt", value: funnel.kayit, fillClass: "bg-emerald-500" },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Huni</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seçili ayda gelen velilerin aşamalara göre ilerleyişi.
        </p>
      </div>
      <div className="space-y-4">
        {stages.map((stage) => (
          <div key={stage.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">{stage.title}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {stage.value}
                {stage.key !== "leads" ? (
                  <span className="ml-2 text-xs font-medium tabular-nums text-muted-foreground">
                    (%{pct(stage.value, funnel.leads)})
                  </span>
                ) : null}
              </span>
            </div>
            <Bar widthPct={pct(stage.value, funnel.leads)} fillClass={stage.fillClass} />
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceConversionSection({ rows }: { rows: SourceConversionRow[] }) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border bg-muted px-5 py-4">
        <h2 className="text-xl font-semibold text-foreground">Kaynak dönüşümü</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tüm zamanların kaynak bazında veli ve kayıt sayıları.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Kaynak</th>
              <th className="px-5 py-3 text-right">Veli</th>
              <th className="px-5 py-3 text-right">Kayıt</th>
              <th className="px-5 py-3 text-right">Dönüşüm %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.source} className="transition-colors hover:bg-muted/60">
                <td className="px-5 py-4 font-semibold text-foreground">
                  {label(LEAD_SOURCES, row.source)}
                </td>
                <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{row.total}</td>
                <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{row.won}</td>
                <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground">
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
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Kayıp nedenleri</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kaybedilen velilerin neden dağılımı (tüm zamanlar).
        </p>
      </div>
      {rows.every((row) => row.count === 0) ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Kaybedilen lead görünmüyor.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.reason} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{label(LOST_REASONS, row.reason)}</span>
                <span className="font-semibold tabular-nums text-foreground">{row.count}</span>
              </div>
              <Bar widthPct={(row.count / max) * 100} fillClass="bg-destructive" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

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
        helper={`Seçili ay içinde ödendi işaretlenen taksitler · tahsil oranı ${rate == null ? "—" : `%${rate}`}`}
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

function ConsultantBreakdownSection({ rows }: { rows: ConsultantBreakdownRow[] }) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border bg-muted px-5 py-4">
        <h2 className="text-xl font-semibold text-foreground">Danışman kırılımı</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tüm zamanların danışman bazında lead ve kayıt sayıları.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Danışman</th>
              <th className="px-5 py-3 text-right">Veli</th>
              <th className="px-5 py-3 text-right">Kayıt</th>
              <th className="px-5 py-3 text-right">Dönüşüm %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.consultantId} className="transition-colors hover:bg-muted/60">
                <td className="px-5 py-4 font-semibold text-foreground">{row.consultantName}</td>
                <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{row.leads}</td>
                <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{row.won}</td>
                <td className="px-5 py-4 text-right font-semibold tabular-nums text-foreground">
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
  const currentMonth = istanbulCurrentMonth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Analiz</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">Rapor</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatMonthLabel(month)} ayı için huni, kaynak dönüşümü ve ödeme özeti.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard?ay=${prevMonth}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft aria-hidden className="size-4" />
            Önceki ay
          </Link>
          <Link
            href={`/dashboard?ay=${nextMonth}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sonraki ay
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>

      {/* type="month" masaüstü Safari ve Firefox'ta çalışmıyor; önceki/sonraki ve "Bu ay" yeterli. */}
      {month !== currentMonth ? (
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center rounded-xl px-1 text-sm font-semibold text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Bu aya dön
        </Link>
      ) : null}

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
