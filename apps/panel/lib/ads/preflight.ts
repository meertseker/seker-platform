// "Hiçbir şey kaçmasın": reklam kurulmadan önceki 9 kontrol (spec §10, B1). Saf modül; "şimdi" girdi olarak gelir.
import { checkText } from "@/lib/content/checks";
import { parseContentCode } from "./content-code";
import { templateGaps, type AdTemplate, type CapCheck } from "./ad-template";
import type { AdSetup } from "./ad-setup";
import type { AccountHealth } from "./meta/setup";
import type { ContentForAd, LandingForAd } from "./preflight-sources";

export type PreflightKey = "onay" | "yayin" | "ad" | "utm" | "piksel" | "butce" | "metin" | "bicim" | "hesap";
export type PreflightItem = { key: PreflightKey; ok: boolean; label: string; fix: string | null };
export type PreflightResult = { ok: boolean; items: PreflightItem[] };

export type PreflightInput = {
  content: ContentForAd;
  landing: LandingForAd | null;
  adName: string;
  link: string;
  urlTags: string;
  pixelId: string | null;
  capiEnabled: boolean;
  template: AdTemplate;
  cap: CapCheck;
  banned: string[];
  /** Aktif öğrencilerin ad soyadları; yalnız ilk ad kullanılır. */
  studentNames: string[];
  account: AccountHealth | null;
  setup: AdSetup | null;
  testCampaignStatus: string | null;
  pageId: string | null;
  igUserId: string | null;
  now: Date;
  /** "72 saati bekleme" gerekçesi (B1); en az MIN_REASON karakter olmalı. */
  skip72hReason: string | null;
};

/** B1: Reels reklamı Instagram yayınından en az bu kadar saat sonra. */
export const REELS_MIN_HOURS = 72;
/** Reels reklamı için en uzun video süresi (sn). */
export const REELS_AD_MAX_S = 60;
/** Gerekçe gerektiren geçişlerde en az karakter. */
export const MIN_REASON = 10;

const HOUR_MS = 3_600_000;
const STUDENT_NAME_MIN = 3;
const PANEL_BUG_FIX = "Panel hatası · Mert'e haber verin";
const TELL_MERT = "Mert'e haber verin";
const FIX_TEXT = "Düzeltme iste";

const ok = (key: PreflightKey, label: string): PreflightItem => ({ key, ok: true, label, fix: null });
const red = (key: PreflightKey, label: string, fix: string): PreflightItem => ({ key, ok: false, label, fix });

function reasonOk(reason: string | null): boolean {
  return (reason ?? "").trim().length >= MIN_REASON;
}

function checkApproval(c: ContentForAd): PreflightItem {
  return c.status === "onaylandi" && c.approverFaceCheck
    ? ok("onay", "Onaylı, MEB kutusu işaretli")
    : red("onay", "Onaylı değil ya da MEB kutusu işaretsiz", "Onaya dön");
}

function checkPublished(i: PreflightInput): PreflightItem {
  if (i.content.kind === "sayfa") {
    return i.landing?.status === "yayinda"
      ? ok("yayin", `Sayfa yayında · /lp/${i.landing.slug}`)
      : red("yayin", "Sayfa henüz yayında değil: önce Sayfayı yayınla.", "Yayınla");
  }
  const publishedMs = i.content.igPublishedAt ? Date.parse(i.content.igPublishedAt) : Number.NaN;
  if (i.content.igPublishStatus !== "yayinda" || !Number.isFinite(publishedMs)) {
    return red("yayin", "Instagram'da yayında değil", "Önce Instagram'da yayınla");
  }
  const hours = Math.max(0, (i.now.getTime() - publishedMs) / HOUR_MS);
  if (hours >= REELS_MIN_HOURS) return ok("yayin", `Instagram'da yayında ${Math.floor(hours)} saat`);
  if (reasonOk(i.skip72hReason)) return ok("yayin", "72 saat beklenmedi · gerekçe yazıldı");
  const left = Math.ceil(REELS_MIN_HOURS - hours);
  return red("yayin", `72 saatten önce teste alınamaz · kalan ${left} saat`, "Bekle");
}

function checkAdName(i: PreflightInput): PreflightItem {
  return parseContentCode(i.adName) === i.content.code
    ? ok("ad", "Ad içerik koduyla başlıyor")
    : red("ad", "Reklam adı içerik koduyla başlamıyor", PANEL_BUG_FIX);
}

function checkUtm(i: PreflightInput): PreflightItem {
  let params: URLSearchParams | null = null;
  try {
    params = new URL(i.link).searchParams;
  } catch {
    params = null;
  }
  const good =
    params !== null &&
    params.get("utm_source") === "instagram" &&
    params.get("utm_medium") === "paid_social" &&
    params.get("utm_content") === i.content.code &&
    i.urlTags.includes("utm_campaign=");
  return good ? ok("utm", "Bağlantıda utm ve kod") : red("utm", "Bağlantıda utm ya da kod eksik", PANEL_BUG_FIX);
}

function checkPixel(i: PreflightInput): PreflightItem {
  return i.pixelId && i.capiEnabled
    ? ok("piksel", "Piksel bağlı, CAPI açık")
    : red("piksel", "Piksel ya da Conversions API kapalı", "Mert açar");
}

function checkBudget(i: PreflightInput): PreflightItem {
  const gaps = templateGaps(i.template);
  if (gaps.length > 0) return red("butce", `Reklam şablonu eksik: ${gaps.join(", ")}`, "Ayarlar'a git");
  return i.cap.ok ? ok("butce", i.cap.message) : red("butce", i.cap.message, "Ayarlar'a git");
}

/** checkText mesajından yalnız ifadeyi alır: `"en iyi" kanıt ister, kullanılamaz` → `"en iyi" kanıt ister`. */
function bannedPhrase(text: string, banned: string[]): string | null {
  const r = checkText(text, { max: Number.POSITIVE_INFINITY, min: 0, banned });
  if (r.ok) return null;
  const m = /^"(.*)" kanıt ister/.exec(r.message);
  return m ? m[1] : null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Metinde tam kelime olarak geçen ilk öğrenci ilk adı (Türkçe küçük harf; ≥3 harf). */
function studentNameIn(text: string, studentNames: string[]): string | null {
  const lower = text.toLocaleLowerCase("tr");
  for (const full of studentNames) {
    const first = full.trim().split(/\s+/)[0] ?? "";
    if (Array.from(first).length < STUDENT_NAME_MIN) continue;
    const needle = escapeRegExp(first.toLocaleLowerCase("tr"));
    // \b Türkçe harflerde çalışmaz; Unicode harf/rakam sınırı kullanılır.
    if (new RegExp(`(?<![\\p{L}\\p{N}])${needle}(?![\\p{L}\\p{N}])`, "u").test(lower)) return first;
  }
  return null;
}

function checkText7(i: PreflightInput): PreflightItem {
  const texts =
    i.content.kind === "reels" ? [i.content.caption] : [i.landing?.headline ?? null, i.landing?.primaryText ?? null];
  const present = texts.filter((t): t is string => typeof t === "string" && t.trim() !== "");
  for (const t of present) {
    const phrase = bannedPhrase(t, i.banned);
    if (phrase) return red("metin", `"${phrase}" kanıt ister`, FIX_TEXT);
  }
  for (const t of present) {
    const name = studentNameIn(t, i.studentNames);
    if (name) return red("metin", `Metinde öğrenci adı var: ${name}`, FIX_TEXT);
  }
  return ok("metin", "Yasaklı ifade / öğrenci adı yok");
}

function checkFormat(i: PreflightInput): PreflightItem {
  if (i.content.kind === "sayfa") {
    return i.landing?.imageUrl
      ? ok("bicim", "Sayfa görseli seçili")
      : red("bicim", "Sayfa görseli seçilmemiş", FIX_TEXT);
  }
  const { vertical, durationS, subtitled } = i.content.mediaMeta;
  if (vertical === null || durationS === null || subtitled === null) {
    return red("bicim", "Video biçim bilgisi yok", FIX_TEXT);
  }
  if (!vertical) return red("bicim", "Video dikey değil", FIX_TEXT);
  const sn = Math.round(durationS);
  if (durationS > REELS_AD_MAX_S) return red("bicim", `Video ${sn} sn; reklam için en çok ${REELS_AD_MAX_S} sn`, FIX_TEXT);
  if (!subtitled) return red("bicim", "Altyazı işaretli değil", FIX_TEXT);
  return ok("bicim", `Dikey, ${sn} sn, altyazılı`);
}

function checkAccount(i: PreflightInput): PreflightItem {
  if (!i.setup) return red("hesap", "Test kampanyası kurulmamış", "Kampanyaları kur");
  const a = i.account;
  if (!a || !a.readable) return red("hesap", "Reklam hesabı okunamadı", TELL_MERT);
  if (a.currency !== "TRY") return red("hesap", `Hesap para birimi TRY değil (${a.currency ?? "bilinmiyor"})`, TELL_MERT);
  if (!a.active) return red("hesap", `Reklam hesabı kısıtlı: ${a.text}`, TELL_MERT);
  if (i.testCampaignStatus !== "ACTIVE" && i.testCampaignStatus !== "PAUSED") {
    return red("hesap", "Test kampanyası silinmiş ya da arşivde", TELL_MERT);
  }
  if (!i.pageId) return red("hesap", "Facebook sayfası bağlı değil · Mert ekler", TELL_MERT);
  if (i.content.kind === "reels" && (!i.igUserId || !i.content.igMediaId)) {
    return red("hesap", "Instagram gönderi kimliği yok", TELL_MERT);
  }
  return ok("hesap", "Reklam hesabı sağlıklı, Test kampanyası var");
}

/** 9 kontrolü §10 sırasıyla çalıştırır. */
export function runPreflight(i: PreflightInput): PreflightResult {
  const items = [
    checkApproval(i.content),
    checkPublished(i),
    checkAdName(i),
    checkUtm(i),
    checkPixel(i),
    checkBudget(i),
    checkText7(i),
    checkFormat(i),
    checkAccount(i),
  ];
  return { ok: items.every((x) => x.ok), items };
}

/** İlk kırmızı maddenin metni (Z4 düğme altı); hepsi yeşilse null. */
export function preflightBlockText(r: PreflightResult): string | null {
  return r.items.find((x) => !x.ok)?.label ?? null;
}
