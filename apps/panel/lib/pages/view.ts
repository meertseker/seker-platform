// Z3 yayın panelinin saf görünüm yardımcıları (istemci ve test ortak).
import { ARCHIVE_REDIRECT_PATH } from "@seker/shared/landing";
import type { FieldCheck } from "./preflight";
import type { LandingPageStatus } from "./store";

export type PageState = { slug: string | null; status: LandingPageStatus; publishedAt: string | null } | null;

/** "https://yeni.sekeranaokulu.com" → "yeni.sekeranaokulu.com". */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
  }
}

/** Kartta görünen tek satırlık yayın durumu. */
export function publishStateLine(page: PageState, siteBase: string): string {
  if (page?.status === "yayinda" && page.slug) return `Yayında · ${hostOf(siteBase)}/lp/${page.slug}`;
  if (page?.status === "arsiv") return `Arşivde · adres ${ARCHIVE_REDIRECT_PATH}'ya yönleniyor`;
  return "Yayınlanmadı";
}

/** Sayfa başlığı üst sınırı: "Başlık" kontrolünün "n / max" sayacından okunur. */
export function titleMaxFromChecks(checks: FieldCheck[]): number | null {
  const count = checks.find((c) => c.label === "Başlık")?.count;
  const m = count?.match(/\/\s*(\d+)/);
  return m ? Number(m[1]) : null;
}
