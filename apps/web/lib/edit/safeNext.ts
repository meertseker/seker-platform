const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const PROBE_ORIGIN = 'http://probe.invalid';

/**
 * Açık yönlendirmeyi engeller: yalnızca aynı sitedeki göreli yollar.
 * Ham metin kontrolleri (kontrol karakterleri, ters eğik çizgi, //) tarayıcıların
 * URL ayrıştırmasındaki sapmaları yakalar; son adım URL'yi çözümleyip origin'in
 * değişmediğini doğrular.
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  if (CONTROL_OR_BACKSLASH.test(raw)) return '/';
  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return '/';
  }
  if (url.origin !== PROBE_ORIGIN) return '/';
  if (url.pathname.startsWith('/api/')) return '/';
  return url.pathname + url.search + url.hash;
}
