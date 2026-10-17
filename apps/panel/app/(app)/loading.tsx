/**
 * Sayfalar sunucuda hazırlanırken anında gösterilen iskelet. Next bunu önceden
 * indirir; menüde bir sayfaya basınca beklemeden bu görünür.
 */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Sayfa yükleniyor">
      <div className="space-y-2">
        <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface" />
    </div>
  );
}
