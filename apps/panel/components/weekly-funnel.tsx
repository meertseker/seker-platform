import type { Funnel } from "@/lib/ads/weekly";

/** 3 · Veliler nerede kaldı? Haftada gelen reklam velilerinin bugünkü aşaması; en büyük düşüş kırmızı. */
export function WeeklyFunnel({ funnel }: { funnel: Funnel }) {
  const total = funnel.steps[0]?.n ?? 0;
  const { google, meta, organik } = funnel.byPlatform;
  return (
    <section id="huni" aria-labelledby="huni-baslik" className="flex scroll-mt-4 flex-col gap-2.5">
      <h2 id="huni-baslik" className="text-xl font-bold text-foreground">
        3 · Veliler nerede kaldı?
      </h2>
      <p className="text-sm text-muted-foreground">
        {total > 0
          ? `Bu hafta gelen ${total} velinin bugün hangi aşamada olduğu. En büyük düşüş kırmızı.`
          : "Bu hafta reklamdan gelen veli yok."}
      </p>
      <div className="grid grid-cols-1 gap-5 rounded-2xl border border-border bg-surface p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 text-sm">
          {funnel.steps.map((s) => (
            <div key={s.label} className="grid grid-cols-[110px_minmax(0,1fr)_44px] items-center gap-2.5">
              <span className="text-foreground">{s.label}</span>
              <span className="relative h-[18px] overflow-hidden rounded-[5px] bg-muted" aria-hidden>
                <span
                  className={`absolute inset-y-0 left-0 rounded-[5px] ${s.worst ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: total > 0 ? `${Math.round((s.n / total) * 100)}%` : "0%" }}
                />
              </span>
              <b className={`text-right tabular-nums ${s.worst ? "text-destructive-strong" : "text-foreground"}`}>
                {s.n}
                {s.worst ? <span className="sr-only"> (en büyük düşüş, %{s.dropPct})</span> : null}
              </b>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-3.5 gap-y-1 pt-1 text-[12.5px] text-muted-foreground">
            <span>Google {google} veli</span>
            <span>Instagram reklamı {meta} veli</span>
            {organik > 0 ? <span>Instagram mesajı {organik} veli</span> : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="font-bold text-foreground">Neden kaybettik? (bu hafta)</div>
          {funnel.lostReasons.length > 0 ? (
            funnel.lostReasons.map((r) => (
              <div key={r.reason} className="flex justify-between gap-3 border-b border-border pb-1.5">
                <span className="text-foreground">{r.label}</span>
                <b className="tabular-nums text-foreground">{r.n}</b>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-muted-foreground">Bu hafta kaybedilen reklam velisi yok.</p>
          )}
        </div>
      </div>
    </section>
  );
}
