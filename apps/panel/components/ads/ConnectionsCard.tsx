import type { ConnectionRow, ConnectionSnapshot, ConnectionState } from "@/lib/ads/connections";
import { formatDayTime } from "@/lib/lead-flow/business-hours";

const PILL: Record<ConnectionState, string> = {
  ok: "bg-accent-soft text-accent-strong",
  warn: "bg-warning-soft text-warning",
  bad: "bg-destructive-soft text-destructive-strong",
  off: "bg-muted text-muted-foreground",
};

/** Z6 bağlantı kartları (Paket B). Paket C "Test ve Büyütme kampanyaları" satırını `extraRows` ile ekler (spec B17). */
export function ConnectionsCard({ snapshot, extraRows = [] }: { snapshot: ConnectionSnapshot; extraRows?: ConnectionRow[] }) {
  const rows = [...snapshot.rows, ...extraRows];
  const checked = Date.parse(snapshot.checkedAt);
  return (
    <section
      id="baglantilar"
      aria-labelledby="baglantilar-baslik"
      className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <h2 id="baglantilar-baslik" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Bağlantılar · Mert kurar, siz yalnız görürsünüz
      </h2>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.key} className="flex min-h-11 items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{r.title}</p>
              <p className="break-words text-[12.5px] text-muted-foreground">{r.detail}</p>
            </div>
            <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${PILL[r.state]}`}>
              {r.label}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] text-muted-foreground">
        {Number.isNaN(checked) ? null : `Son kontrol: ${formatDayTime(new Date(checked))}. `}
        Biri kırmızıya dönerse Bu hafta ekranı uyarır, &quot;Reklam testine al&quot; kapanır. Hesap kısıtlaması gibi Meta
        tarafı sorunlar burada sebebiyle yazar.
      </p>
    </section>
  );
}
