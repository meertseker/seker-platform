import type { SlotDef } from '../types';
import { KVKK_TEXT } from '@/content/kvkk';
import { CEREZ_DESC, CEREZ_HTML } from '@/content/cerez';
import { limitFor, metaDescriptionMax } from './limits';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** KVKK_TEXT'i tek bir zengin metin gövdesine çevirir (gizlilik varsayılanı). */
export function kvkkToHtml(text: typeof KVKK_TEXT): string {
  return text.sections
    .map((sec) =>
      [
        `<h2>${esc(sec.title)}</h2>`,
        ...sec.paragraphs.map((para) => `<p>${esc(para)}</p>`),
        sec.items ? `<ul>${sec.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '',
      ].join(''),
    )
    .join('');
}

const WARN = 'Yasal metin: değişiklikten önce yöneticiye danışın.';

const PLACEHOLDER = (what: string) =>
  `<p>Bu sayfa şu anda hazırlanmaktadır. ${what} hakkında bilgi almak için bizimle iletişime geçebilirsiniz.</p>`;

const GIZLILIK_DESC = 'Özel Şeker Anaokulu kişisel verilerin korunması aydınlatma metni.';
const KULLANIM_DESC =
  'Bu sayfa şu anda hazırlanmaktadır. Kullanım şartlarımız hakkında bilgi almak için bizimle iletişime geçebilirsiniz.';

const title = (label: string, def: string): SlotDef => ({ kind: 'text', label, default: def, max: 80, warn: WARN });
const body = (label: string, def: string): SlotDef => ({
  kind: 'rich', label, default: def, max: 20000, warn: WARN, allowHeadings: true,
});
const metaTitle = (def: string): SlotDef => ({ kind: 'text', label: 'Başlık (tarayıcı sekmesi)', default: def, max: 70 });
const metaDesc = (def: string): SlotDef => ({
  kind: 'text', label: 'Açıklama', default: def, max: metaDescriptionMax(def),
});

/** Yasal sayfalar. KVKK_CONSENT_LABEL bilerek slot değildir (Google onay beyanının dayanağı; kodda kalır). */
export const LEGAL_SLOTS: Record<string, SlotDef> = {
  'meta.gizlilik.title': metaTitle('KVKK Aydınlatma Metni'),
  'meta.gizlilik.description': metaDesc(GIZLILIK_DESC),
  'meta.kullanim.title': metaTitle('Kullanım Şartları'),
  'meta.kullanim.description': metaDesc(KULLANIM_DESC),
  'meta.cerez.title': metaTitle('Çerez Politikası'),
  'meta.cerez.description': metaDesc(CEREZ_DESC),

  'legal.gizlilik.title': title('Başlık', 'KVKK Aydınlatma Metni'),
  'legal.gizlilik.updatedLabel': {
    kind: 'text', label: 'Son güncelleme etiketi', default: 'Son güncelleme:', max: limitFor('Son güncelleme:'), warn: WARN,
  },
  'legal.gizlilik.updatedOn': { kind: 'text', label: 'Son güncelleme tarihi', default: KVKK_TEXT.updatedOn, max: 80, warn: WARN },
  'legal.gizlilik.body': body('KVKK aydınlatma metni', kvkkToHtml(KVKK_TEXT)),

  'legal.kullanim.title': title('Başlık', 'Kullanım Şartları'),
  'legal.kullanim.body': body('Kullanım şartları metni', PLACEHOLDER('Kullanım şartlarımız')),

  'legal.cerez.title': title('Başlık', 'Çerez Politikası'),
  'legal.cerez.body': body('Çerez politikası metni', CEREZ_HTML),

  'legal.common.contactCta': { kind: 'text', label: 'İletişim düğmesi', default: 'İletişim', max: limitFor('İletişim') },
};
