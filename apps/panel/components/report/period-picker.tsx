import Link from "next/link";
import { Check } from "lucide-react";
import { PERIOD_KEYS, PERIOD_LABELS, type Period, type PeriodKey } from "@/lib/report/period";

function hrefFor(key: PeriodKey, period: Period): string {
  if (key === "bu-ay") return "/dashboard";
  if (key === "ozel") return `/dashboard?donem=ozel&bas=${period.from}&bit=${period.to}`;
  return `/dashboard?donem=${key}`;
}

/** Dönem seçimi: hazır dönemler bağlantı, özel aralık iki tarih kutusu. Bütün bölümleri birlikte değiştirir. */
export function PeriodPicker({ period, today }: { period: Period; today: string }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <nav aria-label="Dönem" className="glass inline-flex w-full max-w-full gap-1 overflow-x-auto rounded-2xl p-1 sm:w-auto">
        {PERIOD_KEYS.map((key) => {
          const active = period.key === key;
          return (
            <Link
              key={key}
              href={hrefFor(key, period)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:bg-white/50 hover:text-foreground"
              }`}
            >
              {active ? <Check aria-hidden className="size-4" strokeWidth={3} /> : null}
              {PERIOD_LABELS[key]}
            </Link>
          );
        })}
      </nav>
      <form method="get" action="/dashboard" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="donem" value="ozel" />
        <label className="text-[13px]">
          <span className="block text-muted-foreground">Başlangıç</span>
          <input
            type="date"
            name="bas"
            defaultValue={period.from}
            max={today}
            className="min-h-11 rounded-xl border border-input bg-surface px-3 text-sm"
          />
        </label>
        <label className="text-[13px]">
          <span className="block text-muted-foreground">Bitiş</span>
          <input
            type="date"
            name="bit"
            defaultValue={period.to}
            max={today}
            className="min-h-11 rounded-xl border border-input bg-surface px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Aralığı göster
        </button>
      </form>
    </div>
  );
}
