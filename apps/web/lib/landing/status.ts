import { ARCHIVE_REDIRECT_PATH, LP_SLUG_RE, PREVIEW_TOKEN_RE, RESERVED_LP_SLUGS } from '@seker/shared/landing';

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
  // Ayrılmış ama kodda olmayan adres (çıplak /lp/onizleme): veritabanında olamaz (0024 check'i).
  if (RESERVED_LP_SLUGS.includes(slug)) return { kind: 'notFound' };
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

/** Durum sorgusu yalnız kod dışı, kurala uyan ve ayrılmamış slug için atılır. */
export function lpNeedsLookup(slug: string, codeSlugs: ReadonlySet<string>): boolean {
  return !codeSlugs.has(slug) && LP_SLUG_RE.test(slug) && !RESERVED_LP_SLUGS.includes(slug);
}

/**
 * `/lp/onizleme/<token>`: biçimi bozuk token proxy'de gerçek 404 alır (sorgusuz). Biçimi doğru ama bilinmeyen
 * token sayfadaki notFound()'a kalır (akış başladığı için 200 + bulunamadı içeriği; kabul edildi).
 */
export function previewProxyDecision(token: string): { kind: 'next' } | { kind: 'notFound' } {
  return PREVIEW_TOKEN_RE.test(token) ? { kind: 'next' } : { kind: 'notFound' };
}

const TTL_MS = 30_000;
/** Rastgele slug tarayan istekler belleği büyütmesin: en çok 500 kayıt, dolunca en eski (ekleme sırası) düşer. */
export const LP_STATUS_CACHE_MAX = 500;
const TIMEOUT_MS = 1_500;
const cache = new Map<string, { status: LpStatus; at: number }>();

function remember(slug: string, entry: { status: LpStatus; at: number }) {
  // Süresi dolmuş ya da aynı kayıt silinip sona eklenir (ekleme sırası = yaş).
  cache.delete(slug);
  while (cache.size >= LP_STATUS_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(slug, entry);
}

/** Yalnız testler için. */
export function lpStatusCacheSize(): number {
  return cache.size;
}

/** Yalnız testler için. */
export function resetLpStatusCache(): void {
  cache.clear();
}

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
  if (hit) cache.delete(slug);

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
    remember(slug, { status, at: now() });
    return status;
  } catch {
    return 'hata';
  }
}
