export function siteEditUrl(siteUrl: string | undefined, path = "/"): string | null {
  if (!siteUrl) return null;
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/api/edit/enable?next=${encodeURIComponent(path)}`;
}
