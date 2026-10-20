import { formatTRY } from "@/lib/money";
import type { MarketingReport, ReportRow } from "@/lib/ads/report";

function money(kurus: number | null) {
  return kurus == null ? "—" : formatTRY(kurus);
}

function Row({ row, strong = false }: { row: ReportRow; strong?: boolean }) {
  const cell = "px-3 py-3 text-right tabular-nums";
  return (
    <tr className={strong ? "border-t-2 border-border font-semibold" : "border-t border-border"}>
      <th scope="row" className="px-3 py-3 text-left font-medium text-foreground">
        {row.label}
        {row.kind === "kampanya" && !strong ? (
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{row.platform === "meta" ? "Instagram" : "Google Ads"}</span>
        ) : null}
      </th>
      <td className={cell}>{row.spendKurus > 0 ? formatTRY(row.spendKurus) : "—"}</td>
      <td className={cell}>{row.leads}</td>
      <td className={cell}>{row.randevu}</td>
      <td className={cell}>{row.kayit}</td>
      <td className={cell}>{money(row.costPerLeadKurus)}</td>
      <td className={cell}>{money(row.costPerKayitKurus)}</td>
    </tr>
  );
}

export function MarketingTable({ report }: { report: MarketingReport }) {
  if (report.rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
        Bu tarih aralığında aday veya reklam harcaması yok.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">Kampanya / kaynak</th>
            <th scope="col" className="px-3 py-2 text-right">Harcama</th>
            <th scope="col" className="px-3 py-2 text-right">Aday</th>
            <th scope="col" className="px-3 py-2 text-right">Randevu</th>
            <th scope="col" className="px-3 py-2 text-right">Kayıt</th>
            <th scope="col" className="px-3 py-2 text-right">Aday başı</th>
            <th scope="col" className="px-3 py-2 text-right">Kayıt başı</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <Row key={row.key} row={row} />
          ))}
          <Row row={report.total} strong />
        </tbody>
      </table>
    </div>
  );
}
