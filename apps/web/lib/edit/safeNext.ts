/** Açık yönlendirmeyi engeller: yalnızca aynı sitedeki göreli yollar. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.startsWith('/api/')) return '/';
  return raw;
}
