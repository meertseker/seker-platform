import { ARCHIVE_REDIRECT_PATH, LP_SLUG_RE } from '@seker/shared/landing';

/**
 * Proxy'nin `/lp/<slug>` için verdiği karar. Saf modül (proxy'de çalışır; `server-only` ve Supabase istemcisi yok).
 * 302 ve gerçek 404 burada verilir: cacheComponents kabuğu akmaya başladıktan sonra sayfadaki
 * redirect()/notFound() durum kodunu değiştiremez (bkz. proxy.ts'teki yorum).
 */
export type LpStatus = 'yayinda' | 'arsiv' | 'yok' | 'hata';

export type LpProxyDecision = { kind: 'next' } | { kind: 'notFound' } | { kind: 'redirect'; to: string };

export function lpProxyDecision(slug: string, codeSlugs: ReadonlySet<string>, status: LpStatus | null): LpProxyDecision {
  if (codeSlugs.has(slug)) return { kind: 'next' };
  if (!LP_SLUG_RE.test(slug)) return { kind: 'notFound' };
  switch (status) {
    case 'arsiv':
      return { kind: 'redirect', to: ARCHIVE_REDIRECT_PATH };
    case 'yok':
      return { kind: 'notFound' };
    default:
      // yayinda: sayfa açılır. hata: sorgu düştü, sayfa kendisi karar verir (fail-open).
      return { kind: 'next' };
  }
}

const TTL_MS = 30_000;
const TIMEOUT_MS = 1_500;
const cache = new Map<string, { status: LpStatus; at: number }>();

/**
 * `landing_pages.status`'ü PostgREST'ten okur (service_role; tablo anon'a kapalı). Taslak dışarıdan
 * görünmez (`yok`). Sonuç modül içinde 30 sn tutulur; hata tutulmaz.
 */
export async function lookupLpStatus(
  slug: string,
  deps: { fetchFn?: typeof fetch; now?: () => number } = {},
): Promise<LpStatus> {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? Date.now;
  const hit = cache.get(slug);
  if (hit && now() - hit.at <= TTL_MS) return hit.status;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) return 'hata';

  try {
    const res = await fetchFn(`${base}/rest/v1/landing_pages?slug=eq.${encodeURIComponent(slug)}&select=status`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return 'hata';
    const rows = (await res.json()) as { status?: string }[];
    const raw = Array.isArray(rows) ? rows[0]?.status : undefined;
    const status: LpStatus = raw === 'yayinda' ? 'yayinda' : raw === 'arsiv' ? 'arsiv' : 'yok';
    cache.set(slug, { status, at: now() });
    return status;
  } catch {
    return 'hata';
  }
}
