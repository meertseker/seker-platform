import type { Funnel, Gate } from "@/lib/ads/weekly";

const TONE: Record<Gate["tone"], { label: string; badge: string; card: string }> = {
  green: { label: "yeşil", badge: "bg-accent-soft text-accent", card: "border border-border p-3.5" },
  red: { label: "kırmızı", badge: "bg-destructive-soft text-destructive-strong", card: "border-2 border-destructive p-[13px]" },
  none: { label: "veri yok", badge: "bg-muted text-muted-foreground", card: "border border-border p-3.5" },
};

/** 1 · Bütçeyi artırabilir miyiz? Dört kapı; biri kırmızıysa uyarı kutusu (kapının adı ve en sık kayıp nedeni). */
export function WeeklyGates({ gates, topLost }: { gates: Gate[]; topLost: Funnel["lostReasons"][number] | null }) {
  const red = gates.filter((g) => g.tone === "red");
  return (
    <section id="kapilar" aria-labelledby="kapilar-baslik" className="flex scroll-mt-4 flex-col gap-2.5">
      <h2 id="kapilar-baslik" className="text-xl font-bold text-foreground">
        1 · Bütçeyi artırabilir miyiz?
      </h2>
      <p className="text-sm text-muted-foreground">
        Dördü de yeşilse evet. Biri kırmızıysa önce o düzeltilir; reklam bütçesi artmaz.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        {gates.map((g) => {
          const t = TONE[g.tone];
          return (
            <div key={g.key} className={`flex flex-col gap-1 rounded-2xl bg-surface ${t.card}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{g.label}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${t.badge}`}>{t.label}</span>
              </div>
              <div className="text-[28px] font-bold tabular-nums text-foreground">{g.display}</div>
              <div className="text-[13px] text-muted-foreground">{g.target}</div>
            </div>
          );
        })}
      </div>
      {red.length > 0 ? (
        <div role="note" className="rounded-xl border border-destructive/30 bg-destructive-soft px-3.5 py-3 text-sm leading-relaxed text-foreground">
          <b>Bu hafta bütçe artmıyor.</b> Kırmızı {red.length > 1 ? "kapılar" : "kapı"}: {red.map((g) => g.label).join(", ")}.
          {topLost ? (
            <>
              {" "}Kayıp nedenlerinde &ldquo;{topLost.label}&rdquo; öne çıkıyor ({topLost.n} veli).
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
