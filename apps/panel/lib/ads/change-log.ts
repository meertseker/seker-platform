// Reklam kayıt satırı metinleri (K25, saf): ne yapıldı, durum, kim, ne zaman, gerekçe.
// Kampanyalar (Z5), Bu hafta (M1) ve Rapor kayıt defteri (M2) aynı biçimleyiciyi kullanır.
import { istanbulDateString } from "@/lib/lead-flow/business-hours";
import type { AdChangeStatus, AdLogAction, AdLogSource } from "./writes";

export type ChangeLogEntry = {
  id: string;
  createdAt: string;
  platform: string;
  level: string;
  objectId: string;
  objectName: string | null;
  action: AdLogAction;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  status: AdChangeStatus;
  source: AdLogSource;
  recommendationId: string | null;
  actorId: string;
};

const intFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const kurusFormatter = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whenFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Istanbul",
});

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function name(e: ChangeLogEntry): string {
  return str(e.objectName) ?? e.objectId;
}

/** İçerik kodu: `new_value.contentCode`, yoksa nesne adının ilk parçası ("R-2645-B · Konu" → "R-2645-B"). */
function codeOf(e: ChangeLogEntry): string {
  return str(e.newValue?.contentCode) ?? name(e).split(" · ")[0].trim();
}

/** Tutar: tam TL binlik ayraçlı ("1.200"), kuruşlu ise iki hane ("150,50"); bilinmiyorsa "?". */
function tlAmount(v: unknown): string {
  const tl = num(v);
  if (tl === null) return "?";
  return Number.isInteger(tl) ? intFormatter.format(tl) : kurusFormatter.format(tl);
}

/** Eylemin metni, ör. "S-2644-I durduruldu". */
export function actionText(e: ChangeLogEntry): string {
  switch (e.action) {
    case "pause":
      return `${name(e)} durduruldu`;
    case "resume":
      return `${name(e)} yeniden başlatıldı`;
    case "budget":
      return `${name(e)} bütçesi ${tlAmount(e.oldValue?.daily_budget_tl)} → ${tlAmount(e.newValue?.daily_budget_tl)} TL`;
    case "reklam_kur":
      return `${codeOf(e)} reklamı kuruldu · Test · Instagram`;
    case "buyutmeye_tasi":
      return `${codeOf(e)} Büyütme'ye taşındı · Test'teki reklam durdu`;
    case "kampanya_kur":
      return "Test ve Büyütme kampanyaları kuruldu";
    case "kitle_guncelle": {
      const n = num(e.newValue?.count);
      return `Mevcut veli kitlesi güncellendi (${n === null ? "?" : intFormatter.format(n)} telefon)`;
    }
    case "ig_yayin":
      return `${codeOf(e)} Instagram'da yayınlandı`;
    case "sablon":
      return "Reklam şablonu güncellendi";
    default:
      return name(e);
  }
}

export function statusText(s: AdChangeStatus): string {
  if (s === "uygulandi") return "✓ Uygulandı";
  if (s === "uygulanmadi_kapali") return "Kaydedildi · uygulanmadı";
  return "Hata";
}

/** İstanbul saatiyle: aynı takvim günüyse "bugün 08:14", değilse "10 Kasım 08:14". */
export function whenText(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const parts = whenFormatter.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const time = `${get("hour")}:${get("minute")}`;
  if (istanbulDateString(at) === istanbulDateString(now)) return `bugün ${time}`;
  return `${get("day")} ${get("month")} ${time}`;
}

/**
 * Tek satır: "✓ Uygulandı · S-2644-I durduruldu · Zehra Gürsel · 10 Kasım 08:14 · gerekçe: "…"".
 * Gerekçe yoksa son parça yok. Öneriden gelen değişiklikte en sona " · panel önerisi" eklenir
 * (Z5 tasarımında tırnağın içinde "(panel önerisi)"; gerekçe kullanıcının sözü olduğu için tırnak dışında).
 */
export function changeLine(e: ChangeLogEntry, actorName: string, now: Date): string {
  const parts = [statusText(e.status), actionText(e), actorName, whenText(e.createdAt, now)];
  const reason = str(e.reason);
  if (reason) parts.push(`gerekçe: "${reason}"`);
  if (e.source === "oneri") parts.push("panel önerisi");
  return parts.filter(Boolean).join(" · ");
}

function keysOf(e: ChangeLogEntry): string[] {
  const keys = [e.objectId, str(e.newValue?.adId), str(e.newValue?.contentCode), e.recommendationId];
  const ids = e.newValue?.ids;
  if (ids && typeof ids === "object" && !Array.isArray(ids)) {
    const rec = ids as Record<string, unknown>;
    // Kurulumda açılan reklam: reklam_kur → ids.ad, buyutmeye_tasi → ids.copy (Büyütme'deki kopya).
    keys.push(str(rec.ad), str(rec.copy));
  }
  return keys.filter((k): k is string => typeof k === "string" && k.length > 0);
}

/**
 * Her anahtarın en yeni kaydı. Anahtarlar: nesne kimliği, `new_value.adId` (ve kurulum kimlikleri `ids.ad`/`ids.copy`),
 * `new_value.contentCode`, öneri kimliği. Giriş sırasından bağımsız; eşit zamanda ilk gelen kalır.
 */
export function latestByKey(entries: ChangeLogEntry[]): Map<string, ChangeLogEntry> {
  const out = new Map<string, ChangeLogEntry>();
  for (const e of entries) {
    const t = Date.parse(e.createdAt);
    for (const k of keysOf(e)) {
      const prev = out.get(k);
      if (!prev || t > Date.parse(prev.createdAt)) out.set(k, e);
    }
  }
  return out;
}
