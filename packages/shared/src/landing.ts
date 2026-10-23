/**
 * Reklam sayfası (landing page) ortak kuralları: slug, alan eşlemesi,
 * görsel listesi. Web (yayın + önizleme) ve panel (eylemler) aynı kuralı
 * buradan okur. Saf modül: I/O ya da saat yok.
 */

/** Sitede kodla tanımlı reklam sayfaları (apps/web/content/landingPages.ts). */
export const CODE_LP_SLUGS = [
  'beykent-anaokulu',
  'beylikduzu-anaokulu',
  'az-mevcutlu-anaokulu',
  'kres-2-yas',
  'anaokulu-ucret',
] as const;

/** Kod slug'ları + önizleme yolu. DB check'i de aynı listeyi taşır (0024). */
export const RESERVED_LP_SLUGS: readonly string[] = [...CODE_LP_SLUGS, 'onizleme'];

export const LP_SLUG_RE = /^[a-z0-9-]{3,60}$/;
export const ARCHIVE_REDIRECT_PATH = '/lp/az-mevcutlu-anaokulu';

export const AD_PRIMARY_TEXT_MAX = 125;
export const AD_HEADLINE_MAX = 40;

export type LpMediaKey = 'gardenWide' | 'gardenWorkshops' | 'mudKitchen';

/** Yalnız çocuk yüzü olmayan okul kareleri (web MEDIA ile tutarlılığı web testinde). */
export const LP_MEDIA_OPTIONS: { key: LpMediaKey; label: string; src: string }[] = [
  { key: 'gardenWide', label: 'Bahçe, geniş açı', src: '/bahce-genis.webp' },
  { key: 'gardenWorkshops', label: 'Bahçe atölyeleri', src: '/bahce-atolyeler.webp' },
  { key: 'mudKitchen', label: 'Mutfak atölyesi', src: '/mutfak-atolyesi.webp' },
];

export function isLpMediaKey(v: unknown): v is LpMediaKey {
  return typeof v === 'string' && LP_MEDIA_OPTIONS.some((o) => o.key === v);
}

export type LandingFields = {
  h1: string;
  subhead: string;
  bodyBlocks: { heading: string; text: string }[];
  mediaKey: LpMediaKey | null;
  adPrimaryText: string;
  adHeadline: string;
  metaTitle: string;
  metaDescription: string;
};

const META_DESCRIPTION_MAX = 160;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** En çok `max` karakter; kesilirse son kelime sınırında, sonda boşluk yok. */
function cutAtWord(s: string, max: number, sep = ' '): string {
  if (s.length <= max) return s;
  const head = s.slice(0, max + 1);
  const i = head.lastIndexOf(sep);
  const out = i > 0 ? s.slice(0, i) : s.slice(0, max);
  return sep === ' ' ? out.trimEnd() : out.replace(/-+$/, '');
}

/** İçerik kartının `page_fields`'i → sayfa alanları. */
export function pageFieldsToLandingFields(pf: Record<string, unknown>): LandingFields {
  const h1 = str(pf.baslik);
  const subhead = str(pf.alt_baslik);
  const bodyBlocks: LandingFields['bodyBlocks'] = [];
  for (const n of [1, 2, 3]) {
    const heading = str(pf[`blok${n}_baslik`]);
    const text = str(pf[`blok${n}_metin`]);
    if (heading || text) bodyBlocks.push({ heading, text });
  }
  return {
    h1,
    subhead,
    bodyBlocks,
    mediaKey: isLpMediaKey(pf.mediaKey) ? pf.mediaKey : null,
    adPrimaryText: str(pf.adPrimaryText),
    adHeadline: str(pf.adHeadline),
    metaTitle: h1,
    metaDescription: cutAtWord(subhead, META_DESCRIPTION_MAX),
  };
}

/** DB'deki `landing_pages.fields` jsonb'sini savunmacı okur. */
export function parseLandingFields(json: unknown): LandingFields {
  const o: Record<string, unknown> =
    json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  const bodyBlocks: LandingFields['bodyBlocks'] = [];
  if (Array.isArray(o.bodyBlocks)) {
    for (const b of o.bodyBlocks) {
      if (!b || typeof b !== 'object') continue;
      const { heading, text } = b as Record<string, unknown>;
      if (typeof heading !== 'string' || typeof text !== 'string') continue;
      bodyBlocks.push({ heading, text });
    }
  }
  return {
    h1: str(o.h1),
    subhead: str(o.subhead),
    bodyBlocks,
    mediaKey: isLpMediaKey(o.mediaKey) ? o.mediaKey : null,
    adPrimaryText: str(o.adPrimaryText),
    adHeadline: str(o.adHeadline),
    metaTitle: str(o.metaTitle),
    metaDescription: str(o.metaDescription),
  };
}

const TR_MAP: Record<string, string> = { ı: 'i', ş: 's', ç: 'c', ğ: 'g', ö: 'o', ü: 'u' };
const SLUGIFY_MAX_WORDS = 5;
const SLUGIFY_MAX_CHARS = 40;

/** Başlıktan Türkçe karaktersiz adres: en çok 5 kelime, 40 karakter. */
export function slugify(text: string): string {
  const base = text
    .toLocaleLowerCase('tr')
    .replace(/[ışçğöü]/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const words = base.split('-').filter(Boolean).slice(0, SLUGIFY_MAX_WORDS).join('-');
  return cutAtWord(words, SLUGIFY_MAX_CHARS, '-');
}

/** Boş, ayrılmış ya da alınmış olmayan bir adres önerir. */
export function suggestSlug(title: string, fallbackCode: string, taken: ReadonlySet<string>): string {
  let base = slugify(title);
  if (base.length < 3) {
    const code = fallbackCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    base = `sayfa-${code}`;
  }
  const free = (s: string) => !RESERVED_LP_SLUGS.includes(s) && !taken.has(s);
  if (free(base)) return base;
  for (let n = 2; ; n++) {
    const s = `${base}-${n}`;
    if (free(s)) return s;
  }
}

export function slugError(slug: string): string | null {
  if (!LP_SLUG_RE.test(slug)) return 'Adres 3–60 karakter olmalı; yalnız küçük harf, rakam ve tire';
  if (RESERVED_LP_SLUGS.includes(slug)) return 'Bu adres sitede zaten var';
  return null;
}
