import type { Utm } from './attribution';

/**
 * Meta (Instagram) tıklama ve onay yardımcıları. Kaynak/platform kararını
 * veritabanı (create_web_lead) verir; burada yalnız veri üretilir ve taşınır.
 */

/**
 * fbc = fb.1.<ilk görülme ms>.<fbclid>; fbclid büyük/küçük harfe duyarlıdır, asla değiştirilmez.
 * Kaynak: docs/superpowers/plans/2026-10-19-02-meta-api-notlari.md
 */
export function buildFbc(fbclid: string, ms: number): string {
  return `fb.1.${ms}.${fbclid}`;
}

/** document.cookie benzeri dizgeden tek çerez değeri; yoksa ''. */
export function readCookie(cookie: string, name: string): string {
  for (const part of cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return '';
}

const META_SOURCES = new Set(['instagram', 'facebook', 'ig', 'fb', 'meta']);

/** Meta reklamı: utm_medium=paid_social ve utm_source Meta ailesinden. fbclid tek başına reklam sayılmaz. */
export function isMetaPaid(utm: Utm): boolean {
  return (
    (utm.utm_medium ?? '').trim().toLowerCase() === 'paid_social' &&
    META_SOURCES.has((utm.utm_source ?? '').trim().toLowerCase())
  );
}

/** Onay metni sürümü (derleme zamanı genel env); hukuk onayı gelene kadar 1. Sunucu ve form aynı değeri görür. */
export const CONSENT_VERSION: 1 | 2 = process.env.NEXT_PUBLIC_CONSENT_VERSION === '2' ? 2 : 1;

/** Form açılışı için olay kimliği; randomUUID yoksa rastgele dizge (gönderimi asla engellemez). */
export function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // aşağıdaki yedeğe düş
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
