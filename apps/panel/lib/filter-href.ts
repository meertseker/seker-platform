/**
 * Filtre formunun değerlerinden adres üretir (Ödemeler, Öğrenciler). Boş alanlar adrese yazılmaz;
 * böylece "Filtrele"ye basılmış GET formuyla aynı adres çıkar.
 */
export function filterHref(action: string, entries: Iterable<[string, FormDataEntryValue]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (typeof value !== "string" || value.trim() === "") continue;
    params.append(key, value);
  }
  const qs = params.toString();
  return qs ? `${action}?${qs}` : action;
}
