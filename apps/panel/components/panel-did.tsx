/** Mert'in kuralı: her işlemden sonra panel kendiliğinden yaptıklarını listeler. Boş listede hiçbir şey çizmez. */
export function PanelDid({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div role="status" className="flex flex-col gap-1.5 rounded-xl bg-accent-soft px-3.5 py-3 text-sm text-foreground">
      <p className="font-semibold text-accent">Panel şunları yaptı</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="font-bold text-accent" aria-hidden>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
