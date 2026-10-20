import type { ScorecardRow } from "@/lib/ads/weekly";

const TH = "border-b border-border px-3.5 py-2.5";
const TD = "border-b border-border px-3.5 py-2.5";

/** 4 · Ekip: kişi başına ilk arama, ulaşma, randevu ve açık görev (yalnız reklam velileri). */
export function WeeklyTeam({ rows }: { rows: ScorecardRow[] }) {
  return (
    <section id="ekip" aria-labelledby="ekip-baslik" className="flex scroll-mt-4 flex-col gap-2.5">
      <h2 id="ekip-baslik" className="text-xl font-bold text-foreground">
        4 · Ekip
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Bu hafta ve geçen hafta reklam velisi atanmış kimse yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className={TH}>Kişi</th>
                <th scope="col" className={`${TH} text-right`}>İlk arama</th>
                <th scope="col" className={`${TH} text-right`}>Ulaşılan</th>
                <th scope="col" className={`${TH} text-right`}>Randevu</th>
                <th scope="col" className={`${TH} text-right`}>Açık görev</th>
              </tr>
            </thead>
            <tbody className="tabular-nums [&>tr:last-child>td]:border-b-0">
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td className={`${TD} font-semibold text-foreground`}>{r.name}</td>
                  <td className={`${TD} text-right text-foreground`}>{r.firstCallMedian}</td>
                  <td className={`${TD} text-right text-foreground`}>{r.reachPct}</td>
                  <td className={`${TD} text-right ${r.flags.apptRed ? "font-semibold text-destructive-strong" : "text-foreground"}`}>
                    {r.apptPct}
                  </td>
                  <td className={`${TD} text-right ${r.flags.tasksWarn ? "font-semibold text-warning" : "text-foreground"}`}>
                    {r.openTasks}
                    {r.overdueTasks > 0 ? <span className="font-normal"> · {r.overdueTasks} gecikmiş</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[13px] text-muted-foreground">
        Ulaşılan oranı geçen haftanın velileriyle (7 günü dolmuş). Kırmızı: randevu oranı kapının altında. Turuncu: süresi geçmiş görev var.
      </p>
    </section>
  );
}
