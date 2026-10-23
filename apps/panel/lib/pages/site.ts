// Web sitesinin kök adresi. Ayrı modül: revalidate/media gizli anahtarlı istemciyi (server-only) yüklemesin.
const DEFAULT_SITE_URL = "https://yeni.sekeranaokulu.com";

/** `SITE_PUBLIC_URL` (sondaki / silinir) ya da varsayılan site adresi. */
export function siteBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.SITE_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  return raw || DEFAULT_SITE_URL;
}
