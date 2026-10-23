// Web sitesine "bu sayfayı yenile" isteği. Sır yalnız Authorization başlığında gider, günlüğe yazılmaz.
import { siteBaseUrl } from "./site";

const TIMEOUT_MS = 5_000;

export type RevalidateResult = { ok: true } | { ok: false; reason: "ayar-yok" | "ulasilamadi" | "reddedildi" };

export async function revalidateWebPage(
  slug: string,
  deps: { fetchFn?: typeof fetch; env?: NodeJS.ProcessEnv } = {},
): Promise<RevalidateResult> {
  const env = deps.env ?? process.env;
  const secret = (env.WEB_REVALIDATE_SECRET ?? "").trim();
  if (!secret) return { ok: false, reason: "ayar-yok" };
  const fetchFn = deps.fetchFn ?? fetch;
  let res: Response;
  try {
    res = await fetchFn(`${siteBaseUrl(env)}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    console.warn(`[pages] site yenilemesine ulaşılamadı: ${slug}`);
    return { ok: false, reason: "ulasilamadi" };
  }
  if (!res.ok) {
    console.warn(`[pages] site yenilemesi reddedildi (${res.status}): ${slug}`);
    return { ok: false, reason: "reddedildi" };
  }
  return { ok: true };
}
