import type { LandingFields } from '@seker/shared/landing';
import { DB_PAGE_DEFAULTS } from '@/content/landingPages';
import { MEDIA } from '@/content/media';
import type { ImageValue, ReaderData } from '@/lib/content/types';

/** lib/content/slots/lp.ts ile aynı kimlik deseni (p1, b1, f1 …). */
const withIds = <T extends object>(prefix: string, items: T[]) => items.map((x, i) => ({ id: `${prefix}${i + 1}`, ...x }));

/**
 * Veritabanı reklam sayfasının alanlarını LandingView'in okuduğu `lp.<slug>.*` anahtarlarına yazar.
 * Bu sayfalar site düzenleme katmanından düzenlenmez (panelden düzenlenir): sonuç her zaman
 * `editing: false`, yönetim üst verisi (meta, updatedAt) ziyaretçiye gitmez.
 */
export function landingReaderData(base: ReaderData, slug: string, fields: LandingFields): ReaderData {
  const k = (f: string) => `lp.${slug}.${f}`;
  const m = MEDIA[fields.mediaKey ?? 'gardenWorkshops'];
  const media: ImageValue = { src: m.src, alt: m.alt, width: m.width, height: m.height, assetId: null };
  return {
    ...base,
    values: {
      ...base.values,
      [k('metaTitle')]: fields.metaTitle,
      [k('metaDescription')]: fields.metaDescription,
      [k('h1')]: fields.h1,
      [k('subhead')]: fields.subhead,
      [k('formHeading')]: DB_PAGE_DEFAULTS.formHeading,
      [k('formIntro')]: DB_PAGE_DEFAULTS.formIntro,
      [k('media')]: media,
      [k('proofPoints')]: withIds('p', DB_PAGE_DEFAULTS.proofPoints),
      [k('bodyBlocks')]: withIds('b', fields.bodyBlocks),
      [k('faq')]: withIds('f', DB_PAGE_DEFAULTS.faq),
    },
    editing: false,
    meta: {},
    updatedAt: {},
  };
}
