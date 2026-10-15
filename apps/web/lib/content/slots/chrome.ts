import { NAV_ITEMS, FOOTER_LINKS } from '@/content/nav';
import type { SlotDef } from '../types';
import { limitFor, limitForField } from './limits';

/** Menü öğesinin kimliği: adresin slug'ı. Adres ve sıra kodda kalır; yalnızca etiket düzenlenir. */
export function navId(href: string): string {
  return href.replace(/^\/+/, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
}

const navDefault = NAV_ITEMS.map(({ href, label }) => ({ id: navId(href), label }));
const footerDefault = FOOTER_LINKS.map(({ href, label }) => ({ id: navId(href), label }));

/** id -> sabit adres (kodda). Liste öğeleri yalnızca id ve etiket taşır. */
export const NAV_HREFS: Record<string, string> = Object.fromEntries(NAV_ITEMS.map((i) => [navId(i.href), i.href]));
export const FOOTER_HREFS: Record<string, string> = Object.fromEntries(FOOTER_LINKS.map((i) => [navId(i.href), i.href]));

const t = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

export const CHROME_SLOTS: Record<string, SlotDef> = {
  'chrome.nav.items': {
    kind: 'list', label: 'Üst menü', fixedItems: true, maxItems: 20, default: navDefault,
    fields: { label: { kind: 'text', max: 40, label: 'Menü yazısı' } },
  },
  'chrome.header.cta': t('Üst menü randevu düğmesi', 'Ön Görüşme Randevusu'),
  'chrome.footer.links': {
    kind: 'list', label: 'Alt bilgi bağlantıları', fixedItems: true, maxItems: 30, default: footerDefault,
    fields: { label: { kind: 'text', max: Math.max(40, limitForField(footerDefault, 'label')), label: 'Bağlantı yazısı' } },
  },
  'chrome.footer.name': t('Alt bilgi okul adı', 'Şeker Anaokulu'),
  'chrome.footer.tagline': t(
    'Alt bilgi tanıtım cümlesi',
    "Beykent'in en köklü anaokullarından biri. {kurulusYili}'den beri 2-6 yaş çocuklara Montessori temelli okul öncesi eğitim veriyoruz.",
  ),
  'chrome.footer.linksTitle': t('Alt bilgi bağlantı başlığı', 'Hızlı Linkler'),
  'chrome.footer.contactTitle': t('Alt bilgi iletişim başlığı', 'İletişim'),
  'chrome.footer.rights': t('Telif satırı (yıl otomatik)', 'Şeker Anaokulu. Tüm hakları saklıdır.'),
  'chrome.footer.privacy': t('Gizlilik bağlantısı', 'Gizlilik Politikası'),
  'chrome.footer.terms': t('Kullanım şartları bağlantısı', 'Kullanım Şartları'),
  'chrome.footer.cookies': t('Çerez bağlantısı', 'Çerez Politikası'),
  'chrome.mobile.call': t('Mobil çubuk: ara', 'Ara'),
  'chrome.mobile.whatsapp': t('Mobil çubuk: WhatsApp', 'WhatsApp'),
  'chrome.mobile.book': t('Mobil çubuk: randevu', 'Randevu'),
  'chrome.whatsapp.label': t('WhatsApp düğmesi erişilebilirlik etiketi', "WhatsApp'tan yazın"),
  'chrome.contact.phone': t('İletişim kartı: telefon başlığı', 'Telefon'),
  'chrome.contact.email': t('İletişim kartı: e-posta başlığı', 'E-posta'),
  'chrome.contact.address': t('İletişim kartı: adres başlığı', 'Adres'),
  'chrome.lp.footer.kvkk': t('Reklam sayfası alt bilgi: KVKK', 'KVKK Aydınlatma Metni'),
  'chrome.lp.footer.cookies': t('Reklam sayfası alt bilgi: çerez', 'Çerez Politikası'),
};
