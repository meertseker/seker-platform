"use client";

// Aylık sütun grafiği: tek eksen, en çok iki seri. "grouped" yan yana iki sütun; "overlay" açık mavi iz (beklenen)
// üstüne koyu mavi dolgu (gerçekleşen). Üzerine gelince ya da klavyeyle odaklanınca o ayın bütün değerleri görünür;
// aynı sayılar altta açılabilir tabloda da var (ipucu tek yol değildir).
import { useId, useState } from "react";
import { formatInt, formatTl, formatTlCompact } from "@/lib/report/format";

export type ChartSeries = { label: string; values: number[] };

type Props = {
  title: string;
  months: string[];
  monthLabels: string[];
  shortLabels: string[];
  series: [ChartSeries, ChartSeries];
  mode: "grouped" | "overlay";
  /** "int" adet, "tl" kuruş cinsinden tutar. */
  kind: "int" | "tl";
};

const PLOT_H = 168;

/** Eksenin üst ucu: yarısı da tam sayı olsun diye çift adımlar (2, 4, 6, 8, 10 × 10ⁿ). */
export function niceMax(max: number): number {
  if (max <= 2) return 2;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 4, 6, 8, 10]) {
    if (step * pow >= max && (step * pow) % 2 === 0) return step * pow;
  }
  return 10 * pow;
}

const SERIES_COLOR = {
  grouped: ["var(--color-chart-1)", "var(--color-chart-2)"],
  overlay: ["var(--color-chart-1-soft)", "var(--color-chart-1)"],
} as const;

export function ColumnChart(props: Props) {
  const { title, months, monthLabels, shortLabels, series, mode, kind } = props;
  const format = kind === "tl" ? formatTl : formatInt;
  const formatAxis = kind === "tl" ? formatTlCompact : formatInt;
  const [active, setActive] = useState<number | null>(null);
  const id = useId();
  const top = niceMax(Math.max(0, ...series[0].values, ...series[1].values));
  const ticks = [top, top / 2, 0];
  const colors = SERIES_COLOR[mode];
  const h = (v: number) => (v > 0 ? Math.max(2, (v / top) * PLOT_H) : 0);

  return (
    <figure className="m-0 min-w-0">
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        {series.map((s, i) => (
          <li key={s.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: colors[i] }} />
            {s.label}
          </li>
        ))}
      </ul>

      <div className="relative flex gap-2">
        {/* Y ekseni */}
        <div className="relative w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground" style={{ height: PLOT_H }} aria-hidden>
          {ticks.map((t, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: (i / (ticks.length - 1)) * PLOT_H }}>
              {formatAxis(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Izgara */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: PLOT_H }} aria-hidden>
            {ticks.map((_, i) => (
              <span
                key={i}
                className={`absolute inset-x-0 h-px ${i === ticks.length - 1 ? "bg-input/60" : "bg-chart-grid"}`}
                style={{ top: (i / (ticks.length - 1)) * PLOT_H }}
              />
            ))}
          </div>

          <ol className="relative flex items-end" style={{ height: PLOT_H }}>
            {months.map((m, i) => {
              const a = series[0].values[i] ?? 0;
              const b = series[1].values[i] ?? 0;
              const label = `${monthLabels[i]}: ${series[0].label} ${format(a)}, ${series[1].label} ${format(b)}`;
              return (
                <li
                  key={m}
                  tabIndex={0}
                  aria-label={label}
                  aria-describedby={active === i ? `${id}-tip` : undefined}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((cur) => (cur === i ? null : cur))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                  className={`relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active === i ? "bg-black/[0.035]" : ""
                  }`}
                >
                  {mode === "grouped" ? (
                    <>
                      <span className="w-[38%] max-w-[18px] rounded-t-[4px]" style={{ height: h(a), background: colors[0] }} />
                      <span className="w-[38%] max-w-[18px] rounded-t-[4px]" style={{ height: h(b), background: colors[1] }} />
                    </>
                  ) : (
                    <span className="relative w-[62%] max-w-[24px]" style={{ height: h(Math.max(a, b)) }}>
                      <span className="absolute inset-x-0 bottom-0 rounded-t-[4px]" style={{ height: h(a), background: colors[0] }} />
                      <span
                        className="absolute inset-x-[3px] bottom-0 rounded-t-[3px]"
                        style={{ height: h(b), background: colors[1] }}
                      />
                    </span>
                  )}
                  {active === i ? (
                    <span
                      id={`${id}-tip`}
                      role="tooltip"
                      className={`glass-thick pointer-events-none absolute bottom-full z-10 mb-2 w-max min-w-36 rounded-xl px-3 py-2 text-left text-[13px] ${
                        i < months.length / 2 ? "left-0" : "right-0"
                      }`}
                    >
                      <span className="block font-semibold text-foreground">{monthLabels[i]}</span>
                      {series.map((s, si) => (
                        <span key={s.label} className="mt-0.5 flex items-center gap-2">
                          <span aria-hidden className="inline-block h-0.5 w-3 rounded" style={{ background: colors[si] }} />
                          <b className="tabular-nums text-foreground">{format(s.values[i] ?? 0)}</b>
                          <span className="text-muted-foreground">{s.label}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <ol className="mt-1.5 flex text-[11px] text-muted-foreground" aria-hidden>
            {months.map((m, i) => (
              <li key={m} className="flex-1 text-center">
                <span className={(months.length - 1 - i) % 2 === 1 ? "max-sm:invisible" : ""}>{shortLabels[i]}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </figure>
  );
}
