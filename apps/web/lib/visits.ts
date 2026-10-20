/**
 * Çerezsiz anonim ziyaret sayacı: tarayıcıda kaynak/cihaz sınıflandırması ve sunucuda doğrulama.
 * Hiçbir kimlik, çerez veya tarayıcı depolaması kullanılmaz; yalnızca toplam sayı tutulur (bkz. 0011_site_visits.sql).
 */

import { isMetaPaid } from './metaClick';

export const VISIT_SOURCES = ['google_ads', 'meta_ads', 'arama', 'sosyal', 'kampanya', 'diger_site', 'dogrudan', 'site_ici'] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];

export const VISIT_DEVICES = ['mobil', 'masaustu'] as const;
export type VisitDevice = (typeof VISIT_DEVICES)[number];

export interface VisitPayload {
  p: string; // sayfa yolu
  s: VisitSource;
  d: VisitDevice;
  e: boolean; // siteye bu sayfadan mı girildi
}

const SEARCH_HOSTS = /(^|\.)(google\.[a-z.]+|bing\.com|yandex\.[a-z.]+|duckduckgo\.com|yahoo\.com|ecosia\.org)$/i;
const SOCIAL_HOSTS =
  /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|m\.facebook\.com|l\.facebook\.com|t\.co|twitter\.com|x\.com|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|lnkd\.in|whatsapp\.com|wa\.me|pinterest\.[a-z.]+|threads\.net)$/i;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Siteye giriş kaynağı. Reklam tıklama kimliği her şeyin önündedir; sonra UTM, sonra yönlendiren site. */
export function classifyEntrySource(search: URLSearchParams, referrer: string, ownHost: string): VisitSource {
  if (search.get('gclid') || search.get('gbraid') || search.get('wbraid')) return 'google_ads';
  if (isMetaPaid({ utm_source: search.get('utm_source') ?? '', utm_medium: search.get('utm_medium') ?? '' })) return 'meta_ads';
  const refHost = referrer ? hostOf(referrer) : null;
  const external = refHost && refHost !== ownHost.toLowerCase() ? refHost : null;
  if (search.get('utm_source') || search.get('utm_campaign')) return 'kampanya';
  if (!external) return 'dogrudan';
  if (SEARCH_HOSTS.test(external)) return 'arama';
  if (SOCIAL_HOSTS.test(external)) return 'sosyal';
  return 'diger_site';
}

/** Yönlendiren adres başka bir siteyse (veya yoksa) bu sayfa siteye giriş sayılır. */
export function isEntrance(referrer: string, ownHost: string): boolean {
  const refHost = referrer ? hostOf(referrer) : null;
  return !refHost || refHost !== ownHost.toLowerCase();
}

export function deviceFromUserAgent(ua: string): VisitDevice {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobil' : 'masaustu';
}

const PATH_OK = /^\/[A-Za-z0-9\-_/çğıöşüÇĞİÖŞÜ%.]*$/;
const EXCLUDED_PREFIXES = ['/api/', '/_next/', '/_not-found'];

/** Sorgu ve sondaki eğik çizgi olmadan, en fazla 200 karakterlik yol; geçersizse null. */
export function normalizeVisitPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let path = raw.split('?')[0].split('#')[0];
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (!path || path.length > 200 || !PATH_OK.test(path)) return null;
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  return path;
}

/** Sunucuda gövde doğrulaması: beklenmeyen her alan reddedilir. */
export function parseVisitPayload(body: unknown): VisitPayload | null {
  if (!body || typeof body !== 'object') return null;
  const { p, s, d, e } = body as Record<string, unknown>;
  const path = normalizeVisitPath(p);
  if (!path) return null;
  if (!VISIT_SOURCES.includes(s as VisitSource)) return null;
  if (!VISIT_DEVICES.includes(d as VisitDevice)) return null;
  if (typeof e !== 'boolean') return null;
  // İç gezinme giriş olamaz; giriş "site_ici" kaynağı taşıyamaz.
  if (e === (s === 'site_ici')) return null;
  return { p: path, s: s as VisitSource, d: d as VisitDevice, e };
}

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|curl|wget|python|node-fetch|axios/i;

export function isBotUserAgent(ua: string | null): boolean {
  return !ua || BOT_UA.test(ua);
}
