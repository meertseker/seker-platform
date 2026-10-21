import { LANDING_PAGES } from '@/content/landingPages';
import { MEDIA } from '@/content/media';
import type { SlotDef } from '../types';
import { countChars } from '../chars';

const H1_WARN = 'Bu başlık Google Ads reklamının başlığıyla aynı anlamda olmalı. Değiştirirseniz reklamı da kontrol edin.';

/**
 * Sınır: görevin verdiği değer; varsayılan metin (ham, belirteçli) bundan uzunsa metin aynen
 * korunur ve sınır en uzun varsayılana 10'a yukarı yuvarlanarak yükseltilir (F2-T14a).
 */
function max(base: number, ...texts: string[]): number {
  const longest = Math.max(0, ...texts.map((t) => countChars(t)));
  return Math.max(base, Math.ceil(longest / 10) * 10);
}

const withIds = <T extends object>(prefix: string, items: T[]) => items.map((x, i) => ({ id: `${prefix}${i + 1}`, ...x }));

export const LP_SLOTS: Record<string, SlotDef> = {
  'lp.common.ctaPrimary': { kind: 'text', max: 40, default: 'Ön Görüşme Randevusu', label: 'Reklam sayfası ana düğme' },
  'lp.common.ctaWhatsapp': { kind: 'text', max: 40, default: "WhatsApp'tan Yazın", label: 'Reklam sayfası WhatsApp düğmesi' },
  'lp.common.faqTitle': { kind: 'text', max: 60, default: 'Sıkça Sorulanlar', label: 'Reklam sayfası SSS başlığı' },
  'lp.common.visitTitle': { kind: 'text', max: 80, default: 'Okulu gezin, sonra karar verin', label: 'Reklam sayfası kapanış başlığı' },
  'lp.common.mapsCta': { kind: 'text', max: 30, default: 'Haritada Gör', label: 'Harita düğmesi' },
  'lp.common.heroImage': {
    kind: 'image',
    label: 'Reklam sayfası ilk ekran arka planı (binanın göründüğü bahçe)',
    default: { src: MEDIA.gardenWide.src, alt: MEDIA.gardenWide.alt, width: MEDIA.gardenWide.width, height: MEDIA.gardenWide.height, assetId: null },
  },
  ...Object.fromEntries(
    LANDING_PAGES.flatMap((p) => {
      const k = (f: string) => `lp.${p.slug}.${f}`;
      const m = MEDIA[p.mediaKey];
      return [
        [k('metaTitle'), { kind: 'text', max: max(70, p.metaTitle), default: p.metaTitle, label: `${p.slug}: Google başlığı` }],
        [k('metaDescription'), { kind: 'text', max: max(160, p.metaDescription), default: p.metaDescription, label: `${p.slug}: Google açıklaması` }],
        [k('h1'), { kind: 'text', max: max(90, p.h1), default: p.h1, label: `${p.slug}: ana başlık`, warn: H1_WARN }],
        [k('subhead'), { kind: 'text', max: max(300, p.subhead), default: p.subhead, label: `${p.slug}: alt başlık` }],
        [k('formHeading'), { kind: 'text', max: max(80, p.formHeading), default: p.formHeading, label: `${p.slug}: form başlığı` }],
        [k('formIntro'), { kind: 'text', max: max(200, p.formIntro), default: p.formIntro, label: `${p.slug}: form açıklaması` }],
        [k('media'), { kind: 'image', label: `${p.slug}: fotoğraf`, default: { src: m.src, alt: m.alt, width: m.width, height: m.height, assetId: null } }],
        [k('proofPoints'), {
          kind: 'list', label: `${p.slug}: rakamlar şeridi`, maxItems: 4,
          default: withIds('p', p.proofPoints),
          fields: {
            value: { kind: 'text', max: max(14, ...p.proofPoints.map((x) => x.value)), label: 'Rakam' },
            label: { kind: 'text', max: max(40, ...p.proofPoints.map((x) => x.label)), label: 'Açıklama' },
          },
        }],
        [k('bodyBlocks'), {
          kind: 'list', label: `${p.slug}: içerik blokları`, maxItems: 8,
          default: withIds('b', p.bodyBlocks),
          fields: {
            heading: { kind: 'text', max: max(90, ...p.bodyBlocks.map((x) => x.heading)), label: 'Başlık' },
            text: { kind: 'text', max: max(700, ...p.bodyBlocks.map((x) => x.text)), label: 'Metin' },
          },
        }],
        [k('faq'), {
          kind: 'list', label: `${p.slug}: sorular`, maxItems: 10,
          default: withIds('f', p.faq),
          fields: {
            question: { kind: 'text', max: max(140, ...p.faq.map((x) => x.question)), label: 'Soru' },
            answer: { kind: 'text', max: max(600, ...p.faq.map((x) => x.answer)), label: 'Cevap' },
          },
        }],
      ] as [string, SlotDef][];
    }),
  ),
};
