import type { Metadata } from "next";
import Link from "next/link";
import { CampaignTable } from "@/components/campaign-table";
import { requireRole } from "@/lib/auth";
import { budgetPace, buildCampaignRows, buildKpis, type BudgetPace } from "@/lib/ads/campaigns";
import { normalizeRange } from "@/lib/ads/report";
import { istanbulDateString } from "@/lib/cron-rules";
import { loadCampaignPage, type CampaignPageData } from "@/lib/queries/campaigns";

export const metadata: Metadata = { title: "Kampanyalar" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const tl = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dayLabel(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export default async function KampanyalarPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("yonetici");
  const params = await searchParams;
  const bas = first(params.bas);
  const bit = first(params.bit);
  const { from, to } = normalizeRange(bas, bit, istanbulDateString());
  const rangeLabel = bas && bit ? `${dayLabel(from)} – ${dayLabel(to)}` : "Son 30 gün";

  let data: CampaignPageData | null = null;
  try {
    data = await loadCampaignPage(from, to);
  } catch (e) {
    console.error("[kampanyalar] veri okunamadı:", e instanceof Error ? e.message : "bilinmeyen");
  }

  const heading = (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{rangeLabel}</p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Kampanyalar</h1>
    </div>
  );

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1180px] space-y-4">
        {heading}
        <p role="alert" className="rounded-2xl border border-destructive-soft bg-destructive-soft p-5 text-sm text-destructive-strong">
          Kampanya verileri şu an okunamadı. Lütfen sayfayı yenileyin; sorun sürerse daha sonra tekrar deneyin.
        </p>
      </div>
    );
  }

  const rows = buildCampaignRows(data.spend, data.objects, data.leads, data.settings);
  const kpis = buildKpis(rows);
  const pace = budgetPace(data.monthSpendKurus, data.settings, data.today);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <CampaignTable
        heading={heading}
        rows={rows}
        codes={data.codes}
        gate={data.gate}
        writeEnabled={data.writeEnabled}
        scaleMaxPct={data.settings.scaleMaxPct}
        targetTl={data.settings.targetTl}
      >
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-muted-foreground">Başlangıç</span>
            <input type="date" name="bas" defaultValue={from} className="min-h-11 rounded-xl border border-input bg-surface px-3" />
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">Bitiş</span>
            <input type="date" name="bit" defaultValue={to} className="min-h-11 rounded-xl border border-input bg-surface px-3" />
          </label>
          <button type="submit" className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:bg-muted">
            Göster
          </button>
          {bas && bit ? (
            <Link href="/reklam/kampanyalar" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted">
              Son 30 gün
            </Link>
          ) : null}
        </form>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
          {kpis.map((k) => (
            <div key={k.label} className="flex flex-col gap-0.5 rounded-2xl border border-border bg-surface p-3.5">
              <span className="text-sm font-semibold text-muted-foreground">{k.label}</span>
              <span className="text-[26px] font-bold tabular-nums text-foreground">{k.value}</span>
              <span className="text-[12.5px] tabular-nums text-muted-foreground">{k.sub}</span>
            </div>
          ))}
        </div>

        <BudgetBar pace={pace} month={MONTHS[Number(data.today.slice(5, 7)) - 1]} />

        <div className="rounded-xl border border-google/25 bg-google-soft px-3.5 py-2.5 text-[13.5px] leading-normal text-foreground">
          <b>Tabloyu nasıl okumalı?</b> Gri küçük sayı, Google&apos;ın ya da Instagram&apos;ın kendi saydığı başvurudur; iki platform aynı veliyi ikisi de sayabilir. Büyük sayılar paneldeki gerçek velilerdir. Kararlar büyük sayılara göre verilir.
        </div>
      </CampaignTable>
    </div>
  );
}

function BudgetBar({ pace, month }: { pace: BudgetPace; month: string }) {
  if (pace.totalTl === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-3.5 text-sm text-muted-foreground">
        Aylık bütçe girilmedi ·{" "}
        <Link href="/reklam/ayarlar" className="font-semibold text-foreground underline underline-offset-4">
          Ayarlar ve hedefler
        </Link>
      </div>
    );
  }
  const fast = pace.perPlatform.filter((p) => p.fast);
  const width = (spent: number) => `${Math.min(100, (spent / pace.totalTl) * 100)}%`;
  const [google, meta] = pace.perPlatform;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3.5">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <b className="text-foreground">{month} bütçesi: {tl.format(pace.totalTl)} TL</b>
        <span className={fast.length > 0 ? "font-semibold text-warning" : "text-muted-foreground"}>
          Harcanan {tl.format(pace.spentTl)} TL (%{pace.pctSpent}) · ayın %{pace.pctMonth}&apos;i geçti
          {fast.length > 0 ? ` · ${fast.map((p) => p.label).join(" ve ")} hızlı gidiyor` : ""}
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-md bg-muted" aria-hidden="true">
        <span className="bg-google" style={{ width: width(google.spentTl) }} />
        <span className="bg-instagram" style={{ width: width(meta.spentTl) }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
        {pace.perPlatform.map((p) => (
          <span key={p.label} className={p.fast ? "font-semibold text-warning" : undefined}>
            {p.label} {tl.format(p.spentTl)} / {tl.format(p.budgetTl)} TL{p.fast ? ` (%${p.pct})` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
