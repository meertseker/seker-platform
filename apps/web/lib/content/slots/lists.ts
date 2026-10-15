import { FAQ_ITEMS } from '@/content/faq';
import { TESTIMONIALS } from '@/content/testimonials';
import { DAY_CHAPTERS } from '@/content/day';
import { BRANCHES } from '@/content/program';
import { AGE_GROUPS_CONTENT } from '@/content/ageGroups';
import type { FieldDef, SlotDef } from '../types';
import { limitForField } from './limits';

// Liste öğelerinin düzenlenemeyen alanları (mediaKey, grade, season, slug, time, image vb.) varsayılan öğede
// durur ve kayıtta olduğu gibi korunur; yalnızca `fields` içindekiler düzenlenir.
// Dizi alanları (paragraflar, kazanımlar, odak alanları) numaralı metin alanlarına açılır: body1, body2 …
// Boş varsayılan alan sayfada basılmaz.

type Rec = Record<string, unknown>;

/** `prefix1..prefixN` anahtarlı alanlara açar; eksik öğeler boş metin olur. */
function spread(prefix: string, values: readonly string[] | undefined, count: number): Rec {
  const out: Rec = {};
  for (let i = 0; i < count; i++) out[`${prefix}${i + 1}`] = values?.[i] ?? '';
  return out;
}

/** Numaralı alanların hepsi için tek sınır: en uzun varsayılan değere göre. */
function maxOver(items: Rec[], prefix: string, count: number): number {
  return Math.max(...Array.from({ length: count }, (_, i) => limitForField(items, `${prefix}${i + 1}`)));
}

function numbered(prefix: string, count: number, def: (n: number) => FieldDef): Record<string, FieldDef> {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}${i + 1}`, def(i + 1)]));
}

const DAY_BODY_COUNT = 2;
const dayDefault: Rec[] = DAY_CHAPTERS.map(({ id, time, title, lead, body, mediaKey, grade, feature }) => ({
  id, time, title, lead, ...spread('body', body, DAY_BODY_COUNT), mediaKey, grade, ...(feature ? { feature } : {}),
}));

const BRANCH_BODY_COUNT = 4;
const BRANCH_GAIN_COUNT = 5;
const branchDefault: Rec[] = BRANCHES.map(({ slug, name, summary, body, gains, season, mediaKey }) => ({
  id: slug, name, summary, ...spread('body', body, BRANCH_BODY_COUNT), ...spread('gain', gains, BRANCH_GAIN_COUNT), season, mediaKey,
}));

/** Yaş grubu kart adı ("Oyun Grubu"…): Eğitim sayfasındaki yaş kartlarıyla ortak. */
const AGE_GROUP_NAMES: Record<string, string> = {
  '2-3-yas': 'Oyun Grubu',
  '3-4-yas': 'Anaokulu',
  '4-5-yas': 'Anaokulu',
  '5-6-yas': 'İlkokula Hazırlık',
};
const AGE_FOCUS_COUNT = 4;
const AGE_HIGHLIGHT_COUNT = 5;
const ageDefault: Rec[] = AGE_GROUPS_CONTENT.map((g) => {
  const focus: Rec = {};
  for (let i = 0; i < AGE_FOCUS_COUNT; i++) {
    focus[`focus${i + 1}Title`] = g.focusAreas[i]?.title ?? '';
    focus[`focus${i + 1}Text`] = g.focusAreas[i]?.description ?? '';
  }
  return {
    id: g.slug,
    groupName: AGE_GROUP_NAMES[g.slug],
    title: g.title,
    ageLabel: g.ageLabel,
    headline: g.headline,
    metaTitle: g.metaTitle,
    metaDescription: g.metaDescription,
    intro: g.intro,
    classSize: g.classSize,
    ...focus,
    ...spread('highlight', g.dailyHighlights, AGE_HIGHLIGHT_COUNT),
    image: g.image,
  };
});

const focusTitleMax = Math.min(
  120,
  Math.max(...Array.from({ length: AGE_FOCUS_COUNT }, (_, i) => limitForField(ageDefault, `focus${i + 1}Title`))),
);
const focusTextMax = Math.max(...Array.from({ length: AGE_FOCUS_COUNT }, (_, i) => limitForField(ageDefault, `focus${i + 1}Text`)));
const focusFields: Record<string, FieldDef> = {};
for (let i = 1; i <= AGE_FOCUS_COUNT; i++) {
  focusFields[`focus${i}Title`] = { kind: 'text', max: focusTitleMax, label: `${i}. odak alanı başlığı` };
  focusFields[`focus${i}Text`] = { kind: 'text', max: focusTextMax, label: `${i}. odak alanı açıklaması` };
}

export const LIST_SLOTS: Record<string, SlotDef> = {
  'faq.items': {
    kind: 'list', label: 'Sıkça sorulan sorular', maxItems: 40, default: FAQ_ITEMS,
    fields: {
      question: { kind: 'text', max: 160, label: 'Soru' },
      answer: { kind: 'text', max: 900, label: 'Cevap' },
      featured: { kind: 'flag', label: 'Ana sayfada göster' },
      ready: { kind: 'flag', label: 'Yayında' },
    },
  },
  'testimonials.items': {
    kind: 'list', label: 'Veli yorumları', maxItems: 40, default: TESTIMONIALS,
    fields: {
      quote: { kind: 'text', max: 600, label: 'Yorum' },
      author: { kind: 'text', max: 40, label: 'Veli' },
      context: { kind: 'text', max: 80, label: 'Açıklama' },
      ready: { kind: 'flag', label: 'Yayında' },
    },
  },
  // Ana sayfanın ihtiyacı olduğu için Task 11'de eklendi; Task 14 yalnızca alan ekleyip genişletir.
  'day.chapters': {
    kind: 'list', label: 'Günün sahneleri', fixedItems: true, maxItems: 20, default: dayDefault,
    fields: {
      time: { kind: 'text', max: 10, label: 'Saat' },
      title: { kind: 'text', max: limitForField(dayDefault, 'title'), label: 'Başlık' },
      lead: { kind: 'text', max: limitForField(dayDefault, 'lead'), label: 'Kısa açıklama' },
      ...numbered('body', DAY_BODY_COUNT, (n) => ({
        kind: 'text', max: maxOver(dayDefault, 'body', DAY_BODY_COUNT), label: `${n}. paragraf${n > 1 ? ' (boşsa gösterilmez)' : ''}`,
      })),
    },
  },
  'program.branches': {
    kind: 'list', label: 'Branş dersleri', fixedItems: true, maxItems: 40, default: branchDefault,
    fields: {
      name: { kind: 'text', max: limitForField(branchDefault, 'name'), label: 'Ders adı' },
      summary: { kind: 'text', max: limitForField(branchDefault, 'summary'), label: 'Kart özeti' },
      ...numbered('body', BRANCH_BODY_COUNT, (n) => ({
        kind: 'text', max: maxOver(branchDefault, 'body', BRANCH_BODY_COUNT), label: `${n}. paragraf${n > 2 ? ' (boşsa gösterilmez)' : ''}`,
      })),
      ...numbered('gain', BRANCH_GAIN_COUNT, (n) => ({
        kind: 'text', max: maxOver(branchDefault, 'gain', BRANCH_GAIN_COUNT), label: `${n}. kazanım etiketi${n > 4 ? ' (boşsa gösterilmez)' : ''}`,
      })),
    },
  },
  // Yaş grubu sayfaları ve Eğitim sayfasının yaş kartları bu tek listeden okunur; alt sayfa adresleri (id) sabittir.
  'ageGroups.items': {
    kind: 'list', label: 'Yaş grupları', fixedItems: true, maxItems: 4, default: ageDefault,
    fields: {
      groupName: { kind: 'text', max: limitForField(ageDefault, 'groupName'), label: 'Grup adı (kısa)' },
      title: { kind: 'text', max: Math.min(120, limitForField(ageDefault, 'title')), label: 'Başlık' },
      ageLabel: { kind: 'text', max: 20, label: 'Yaş aralığı' },
      headline: { kind: 'text', max: Math.min(120, limitForField(ageDefault, 'headline')), label: 'Alt sayfa ana başlığı' },
      metaTitle: { kind: 'text', max: 70, label: 'Sayfa başlığı (Google)' },
      metaDescription: { kind: 'text', max: 160, label: 'Sayfa açıklaması (Google)' },
      intro: { kind: 'text', max: limitForField(ageDefault, 'intro'), label: 'Giriş metni' },
      classSize: { kind: 'text', max: limitForField(ageDefault, 'classSize'), label: 'Sınıf mevcudu' },
      ...focusFields,
      ...numbered('highlight', AGE_HIGHLIGHT_COUNT, (n) => ({
        kind: 'text', max: maxOver(ageDefault, 'highlight', AGE_HIGHLIGHT_COUNT), label: `Günün akışından ${n}. madde`,
      })),
    },
  },
};
