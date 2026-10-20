// Rapor ekranının yapı taşları (sunucu bileşenleri): bölüm kabuğu, indirme bağlantıları, sayı kutusu, değişim rozeti,
// tablo ve yatay çubuk. Renkler globals.css token'larından; metin hiçbir zaman seri renginde yazılmaz.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Download, Minus } from "lucide-react";
import type { Kpi } from "@/lib/report/build";
import { formatInt, formatSignedInt, formatSignedPct, formatTl } from "@/lib/report/format";
import { changeTone, type Change, type Direction } from "@/lib/report/metrics";
import { formatCell, isNumericKind, type ReportTable } from "@/lib/report/table";

// ---- Bölüm ----

export function downloadHref(base: string, section: string, format: "xlsx" | "csv"): string {
  const sep = base ? `${base}&` : "";
  return `/dashboard/indir?${sep}bolum=${section}&bicim=${format}`;
}

export function DownloadLinks({ query, section, label }: { query: string; section: string; label: string }) {
  const cls =
    "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-[13px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="flex shrink-0 gap-1.5">
      <a href={downloadHref(query, section, "xlsx")} download className={cls} aria-label={`${label} bölümünü Excel olarak indir`}>
        <Download aria-hidden className="size-4" />
        Excel
      </a>
      <a href={downloadHref(query, section, "csv")} download className={cls} aria-label={`${label} bölümünü CSV olarak indir`}>
        CSV
      </a>
    </div>
  );
}

export function Section({
  id,
  title,
  question,
  query,
  children,
  links,
}: {
  id: string;
  title: string;
  question: string;
  query: string;
  children: ReactNode;
  links?: { href: string; label: string }[];
}) {
  return (
    <section id={id} aria-labelledby={`${id}-baslik`} className="scroll-mt-20 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h2 id={`${id}-baslik`} className="text-[22px] font-bold text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{question}</p>
          {links && links.length > 0 ? (
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm font-semibold">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="inline-flex min-h-8 items-center text-primary-strong hover:underline">
                  {l.label}
                </Link>
              ))}
            </p>
          ) : null}
        </div>
        <DownloadLinks query={query} section={id} label={title} />
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-base font-semibold text-foreground">{children}</h3>
      {hint ? <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

// ---- Değişim ----

const TONE_CLASS = {
  good: "text-accent",
  bad: "text-destructive-strong",
  flat: "text-muted-foreground",
} as const;

/** Önceki döneme göre değişim: ok + yüzde (ya da fark) + önceki değer. Renk tek başına anlam taşımaz; ok ve metin var. */
export function DeltaBadge({
  change,
  goodWhen,
  money = false,
  empty = "karşılaştırma yok",
}: {
  change: Change | null;
  goodWhen: Direction;
  money?: boolean;
  empty?: string;
}) {
  if (!change) return <span className="text-[13px] text-muted-foreground">{empty}</span>;
  const tone = changeTone(change, goodWhen);
  const Icon = change.diff > 0 ? ArrowUpRight : change.diff < 0 ? ArrowDownRight : Minus;
  const signedTl = `${change.diff > 0 ? "+" : change.diff < 0 ? "−" : ""}${formatTl(Math.abs(change.diff))}`;
  const main = change.pct !== null ? formatSignedPct(change.pct) : money ? signedTl : formatSignedInt(change.diff);
  const prev = money ? formatTl(change.previous) : formatInt(change.previous);
  const toneWord = tone === "good" ? "iyi yönde" : tone === "bad" ? "kötü yönde" : change.diff === 0 ? "değişmedi" : "değişti";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-[13px]">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${TONE_CLASS[tone]}`}>
        <Icon aria-hidden className="size-4" />
        {main}
        <span className="sr-only"> ({toneWord})</span>
      </span>
      <span className="text-muted-foreground">önceki {prev}</span>
    </span>
  );
}

export function KpiTile({ kpi }: { kpi: Kpi }) {
  const value = kpi.kind === "tl" ? formatTl(kpi.value) : formatInt(kpi.value);
  const body = (
    <>
      <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
      <span className="text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-[30px]">{value}</span>
      <DeltaBadge
        change={kpi.change}
        goodWhen={kpi.goodWhen}
        money={kpi.kind === "tl"}
        empty={kpi.key === "ogrenci" ? "bugünkü sayı" : "önceki dönemde hesaplanamadı"}
      />
      <span className="mt-auto pt-1 text-xs text-muted-foreground">{kpi.helper}</span>
    </>
  );
  const cls = "flex h-full min-w-0 flex-col gap-1 rounded-2xl border border-border bg-surface p-3.5 shadow-sm sm:p-4";
  return kpi.href ? (
    <Link href={kpi.href} className={`${cls} hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Basit sayı kutusu (değişimsiz). */
export function StatTile({ label, value, helper, tone = "neutral" }: { label: string; value: string; helper?: string; tone?: "neutral" | "bad" }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 rounded-xl p-3.5 ${tone === "bad" ? "bg-destructive-soft" : "bg-muted"}`}>
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <span className={`text-2xl font-semibold tracking-tight ${tone === "bad" ? "text-destructive-strong" : "text-foreground"}`}>{value}</span>
      {helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
    </div>
  );
}

// ---- Tablo ----

/**
 * ReportTable'ı ekranda gösterir; dosyalar da aynı satırlardan üretilir. `barKey` verilirse o kolonun değeri satırda
 * ince bir çubukla da gösterilir (en büyüğe göre).
 */
export function DataTable({ table, barKey, caption = true }: { table: ReportTable; barKey?: string; caption?: boolean }) {
  if (table.rows.length === 0) return <EmptyState>{table.emptyText ?? "Bu dönemde veri yok."}</EmptyState>;
  const max = barKey ? Math.max(1, ...table.rows.map((r) => (typeof r[barKey] === "number" ? (r[barKey] as number) : 0))) : 1;
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full border-collapse text-sm" style={{ minWidth: `${Math.min(42, 6 + table.columns.length * 6)}rem` }}>
        {caption ? <caption className="sr-only">{table.title}</caption> : null}
        <thead>
          <tr className="border-b border-border text-left text-[12.5px] font-semibold text-muted-foreground">
            {table.columns.map((c, i) => (
              <th
                key={c.key}
                scope="col"
                className={`px-2 py-2 font-semibold first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${isNumericKind(c.kind) ? "text-right" : ""} ${i === 0 ? "min-w-[9rem]" : "whitespace-nowrap"}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/70 last:border-0">
              {table.columns.map((c, i) => {
                const text = formatCell(row[c.key], c.kind);
                const bar = barKey === c.key && typeof row[c.key] === "number" ? ((row[c.key] as number) / max) * 100 : null;
                const Tag = i === 0 ? "th" : "td";
                return (
                  <Tag
                    key={c.key}
                    scope={i === 0 ? "row" : undefined}
                    className={`px-2 py-2.5 align-middle first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${
                      isNumericKind(c.kind) ? "text-right tabular-nums" : "text-left"
                    } ${i === 0 ? "font-medium text-foreground" : "text-foreground"}`}
                  >
                    {bar !== null ? (
                      <span className="flex items-center justify-end gap-2">
                        <span aria-hidden className="hidden h-2 w-20 overflow-hidden rounded-full bg-chart-grid sm:block">
                          <span className="block h-full rounded-full bg-chart-1" style={{ width: `${Math.max(bar, row[c.key] ? 4 : 0)}%` }} />
                        </span>
                        <span className="min-w-[2.5ch]">{text}</span>
                      </span>
                    ) : (
                      text
                    )}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
        {table.total ? (
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              {table.columns.map((c, i) => {
                const Tag = i === 0 ? "th" : "td";
                return (
                  <Tag
                    key={c.key}
                    scope={i === 0 ? "row" : undefined}
                    className={`px-2 py-2.5 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${isNumericKind(c.kind) ? "text-right tabular-nums" : "text-left"}`}
                  >
                    {formatCell(table.total?.[c.key], c.kind)}
                  </Tag>
                );
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

// ---- Yatay çubuk ----

/**
 * Etiket · çubuk · değer satırı. `marker` önceki dönemi çubuğun üstünde ince bir çizgiyle gösterir.
 * `tone` yalnız durum için (ör. en büyük düşüş); seri rengi mavi.
 */
export function BarRow({
  label,
  value,
  max,
  display,
  marker,
  markerLabel,
  tone = "series",
  sub,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  marker?: number;
  markerLabel?: string;
  tone?: "series" | "bad" | "soft";
  sub?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const markerPct = marker !== undefined && marker > 0 && max > 0 ? Math.min(100, (marker / max) * 100) : null;
  const fill = tone === "bad" ? "bg-destructive" : tone === "soft" ? "bg-chart-1-soft" : "bg-chart-1";
  return (
    <div className="grid grid-cols-[minmax(6.5rem,9rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-sm">
      <span className="text-foreground">{label}</span>
      <span
        className="relative h-3.5 rounded-[4px] bg-chart-grid"
        title={`${label}: ${display}${markerLabel ? ` · ${markerLabel}` : ""}`}
        aria-hidden
      >
        <span className={`absolute inset-y-0 left-0 rounded-r-[4px] ${fill}`} style={{ width: `${value > 0 ? Math.max(pct, 1.5) : 0}%` }} />
        {markerPct !== null ? (
          <span className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground/70" style={{ left: `calc(${markerPct}% - 1px)` }} />
        ) : null}
      </span>
      <span className="text-right font-semibold tabular-nums text-foreground">{display}</span>
      {sub ? <span className="col-start-2 col-end-4 text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`inline-block ${i.swatch}`} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
