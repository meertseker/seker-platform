import type { SiteTraffic } from "@/lib/analytics/ga4";
import type { VisitSummary } from "@/lib/queries/site-visits";

function n(value: number) {
  return value.toLocaleString("tr-TR");
}

function pct(value: number) {
  return `%${Math.round(value * 100)}`;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Table({
  caption,
  headers,
  rows,
  empty,
}: {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <caption className="bg-muted px-3 py-2 text-left text-sm font-semibold text-foreground">{caption}</caption>
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((h, i) => (
              <th key={h} scope="col" className={`px-3 py-2 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-t border-border">
              <td colSpan={headers.length} className="px-3 py-3 text-muted-foreground">{empty}</td>
            </tr>
          ) : (
            rows.map(([label, ...values]) => (
              <tr key={String(label)} className="border-t border-border">
                <th scope="row" className="break-all px-3 py-2 text-left font-medium text-foreground">{label}</th>
                {values.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right tabular-nums">{typeof v === "number" ? n(v) : v}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{text}</p>;
}

/** Pazarlama ekranındaki "Site ziyaretleri": çerezsiz sayaç (herkes) + Google Analytics (onay verenler). */
export function SiteTrafficSection({
  visits,
  visitsError,
  traffic,
  error,
}: {
  visits: VisitSummary | null;
  visitsError: string | null;
  traffic: SiteTraffic | null;
  error: string | null;
}) {
  const gaCoverage =
    visits && traffic && visits.visits > 0 ? Math.min(traffic.totals.sessions / visits.visits, 1) : null;

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Site ziyaretleri</h2>
          <p className="text-sm text-muted-foreground">
            Sitenin kendi sayacı: çerez ve kişisel bilgi kullanmadan her ziyareti sayar, çerezleri reddedenler dahil.
            Aynı kişinin farklı günlerdeki ziyaretleri ayrı sayılır.
          </p>
        </div>

        {visitsError ? (
          <ErrorBox text={visitsError} />
        ) : visits ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label="Ziyaret" value={n(visits.visits)} />
              <Tile label="Sayfa görüntüleme" value={n(visits.pageViews)} />
              <Tile label="Telefondan gelen" value={visits.mobileShare == null ? "—" : pct(visits.mobileShare)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Table
                caption="Ziyaretçiler nereden geldi"
                headers={["Kaynak", "Ziyaret"]}
                rows={visits.sources.map((s) => [s.label, s.visits])}
                empty="Bu aralıkta ziyaret yok."
              />
              <Table
                caption="En çok bakılan sayfalar"
                headers={["Sayfa", "Görüntüleme", "Giriş"]}
                rows={visits.pages.map((p) => [p.path, p.views, p.entrances])}
                empty="Bu aralıkta sayfa görüntüleme yok."
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="space-y-4 border-t border-border pt-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Google Analytics ayrıntısı</h3>
          <p className="text-sm text-muted-foreground">
            Yalnızca çerezleri kabul eden ziyaretçiler. Google veriyi 24–48 saat gecikmeyle işler.
            {gaCoverage != null ? ` Bu aralıkta ziyaretlerin yaklaşık ${pct(gaCoverage)}'ini görebildi.` : ""}
          </p>
        </div>

        {error ? (
          <ErrorBox text={error} />
        ) : traffic ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label="Ziyaretçi" value={n(traffic.totals.users)} />
              <Tile label="Ziyaret" value={n(traffic.totals.sessions)} />
              <Tile label="Sayfa görüntüleme" value={n(traffic.totals.pageViews)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Table
                caption="Kaynaklar (Google Analytics)"
                headers={["Kaynak", "Ziyaret", "Ziyaretçi"]}
                rows={traffic.channels.map((c) => [c.label, c.sessions, c.users])}
                empty="Bu aralıkta veri yok."
              />
              <Table
                caption="Ziyaretçilerin yaptıkları"
                headers={["Ne yaptı", "Sayı"]}
                rows={traffic.events.map((e) => [e.label, e.count])}
                empty="Bu aralıkta veri yok."
              />
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            Google Analytics bağlantısı kurulmadı.
          </p>
        )}
      </div>
    </section>
  );
}
