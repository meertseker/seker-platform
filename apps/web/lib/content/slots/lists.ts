import { FAQ_ITEMS } from '@/content/faq';
import { TESTIMONIALS } from '@/content/testimonials';
import { DAY_CHAPTERS } from '@/content/day';
import { BRANCHES } from '@/content/program';
import type { SlotDef } from '../types';
import { limitForField } from './limits';

// Liste öğelerinin düzenlenemeyen alanları (mediaKey, grade, season, slug, time vb.) varsayılan öğede
// durur ve kayıtta olduğu gibi korunur; yalnızca `fields` içindekiler düzenlenir.
const dayDefault = DAY_CHAPTERS.map(({ id, time, title, lead, mediaKey, grade }) => ({ id, time, title, lead, mediaKey, grade }));
const branchDefault = BRANCHES.map(({ slug, name, summary, season, mediaKey }) => ({ id: slug, name, summary, season, mediaKey }));

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
    },
  },
  'program.branches': {
    kind: 'list', label: 'Branş dersleri', fixedItems: true, maxItems: 40, default: branchDefault,
    fields: {
      name: { kind: 'text', max: limitForField(branchDefault, 'name'), label: 'Ders adı' },
      summary: { kind: 'text', max: limitForField(branchDefault, 'summary'), label: 'Kart özeti' },
    },
  },
};
