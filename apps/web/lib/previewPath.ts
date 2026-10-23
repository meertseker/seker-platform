/**
 * Gizli reklam sayfası önizlemesi (/lp/onizleme/<token>) ölçüm dışıdır: token'lı adres Meta pikseline,
 * Google etiketlerine (GTM / gtag page_view), tıklama olaylarına ve site_visits'e gitmez.
 * `/lp/onizleme-2` gibi benzer adlı gerçek slug'lar ölçülür.
 */
export const PREVIEW_PATH_RE = /^\/lp\/onizleme(?:\/|$)/;

export function isPreviewPath(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && PREVIEW_PATH_RE.test(pathname);
}

/** Satır içi etiket betiklerinin başındaki koruma (Analytics.tsx); aynı düzenli ifade. */
export const PREVIEW_PATH_GUARD_JS = `${PREVIEW_PATH_RE.toString()}.test(window.location.pathname)`;
