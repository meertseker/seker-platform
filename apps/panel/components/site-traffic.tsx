import type { SiteTraffic } from "@/lib/analytics/ga4";

function n(value: number) {
  return value.toLocaleString("tr-TR");
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{n(value)}</p>
    </div>
  );
}

function SimpleTable({
  caption,
  headers,
  rows,
  empty,
}: {
  caption: string;
  headers: [string, string, string];
  rows: [string, number, number][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <caption className="bg-muted px-3 py-2 text-left text-sm font-semibold text-foreground">{caption}</caption>
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">{headers[0]}</th>
            <th scope="col" className="px-3 py-2 text-right">{headers[1]}</th>
            <th scope="col" className="px-3 py-2 text-right">{headers[2]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-t border-border">
              <td colSpan={3} className="px-3 py-3 text-muted-foreground">{empty}</td>
            </tr>
          ) : (
            rows.map(([label, a, b]) => (
              <tr key={label} className="border-t border-border">
                <th scope="row" className="break-all px-3 py-2 text-left font-medium text-foreground">{label}</th>
                <td className="px-3 py-2 text-right tabular-nums">{n(a)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(b)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Pazarlama ekranındaki "Site ziyaretleri" bölümü (Google Analytics 4). */
export function SiteTrafficSection({ traffic, error }: { traffic: SiteTraffic | null; error: string | null }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Site ziyaretleri</h2>
        <p className="text-sm text-muted-foreground">
          Google Analytics verisi. Yalnızca çerezleri kabul eden ziyaretçiler tam sayılır; gerçek ziyaretçi sayısı daha
          yüksektir. Google veriyi 24–48 saat gecikmeyle işler.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : traffic ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label="Ziyaretçi" value={traffic.totals.users} />
            <Tile label="Ziyaret" value={traffic.totals.sessions} />
            <Tile label="Sayfa görüntüleme" value={traffic.totals.pageViews} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SimpleTable
              caption="Ziyaretçiler nereden geldi"
              headers={["Kaynak", "Ziyaret", "Ziyaretçi"]}
              rows={traffic.channels.map((c) => [c.label, c.sessions, c.users])}
              empty="Bu aralıkta ziyaret yok."
            />
            <SimpleTable
              caption="En çok bakılan sayfalar"
              headers={["Sayfa", "Görüntüleme", "Ziyaretçi"]}
              rows={traffic.pages.map((p) => [p.path, p.views, p.users])}
              empty="Bu aralıkta sayfa görüntüleme yok."
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="bg-muted px-3 py-2 text-left text-sm font-semibold text-foreground">
                Ziyaretçilerin yaptıkları
              </caption>
              <tbody>
                {traffic.events.map((e) => (
                  <tr key={e.name} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">{e.label}</th>
                    <td className="px-3 py-2 text-right tabular-nums">{n(e.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
          Google Analytics bağlantısı kurulmadı.
        </p>
      )}
    </section>
  );
}
