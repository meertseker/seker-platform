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

/**
 * Çerez bandının yazıları. CookieBanner istemci bileşenidir; data verilmezse (testler) bu varsayılanları kullanır.
 * Bant yalnızca tercih kaydı olmayan tarayıcıda göründüğü için alanlar sayfa ayarlarında da listelenir.
 */
export const COOKIE_DEFAULTS: Record<string, string> = {
  'chrome.cookie.text': 'Deneyiminizi iyileştirmek ve reklam performansını ölçmek için çerez kullanıyoruz.',
  'chrome.cookie.link': 'Çerez Politikası',
  'chrome.cookie.reject': 'Reddet',
  'chrome.cookie.accept': 'Kabul Et',
  'chrome.cookie.label': 'Çerez tercihi',
};

const COOKIE_LABELS: Record<string, string> = {
  'chrome.cookie.text': 'Açıklama cümlesi',
  'chrome.cookie.link': 'Politika bağlantısı',
  'chrome.cookie.reject': 'Reddet düğmesi',
  'chrome.cookie.accept': 'Kabul düğmesi',
  'chrome.cookie.label': 'Erişilebilirlik etiketi (ekran okuyucu)',
};

const t = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

export const CHROME_SLOTS: Record<string, SlotDef> = {
  'chrome.nav.items': {
    kind: 'list', label: 'Menü maddeleri', fixedItems: true, maxItems: 20, default: navDefault,
    fields: { label: { kind: 'text', max: 40, label: 'Menü yazısı' } },
  },
  'chrome.header.cta': t('Randevu düğmesi', 'Ön Görüşme Randevusu'),
  'chrome.footer.links': {
    kind: 'list', label: 'Bağlantılar', fixedItems: true, maxItems: 30, default: footerDefault,
    fields: { label: { kind: 'text', max: Math.max(40, limitForField(footerDefault, 'label')), label: 'Bağlantı yazısı' } },
  },
  'chrome.footer.name': t('Okul adı', 'Şeker Anaokulu'),
  'chrome.footer.tagline': t(
    'Tanıtım cümlesi',
    "Beykent'in en köklü anaokullarından biri. {kurulusYili}'den beri 2-6 yaş çocuklara Montessori temelli okul öncesi eğitim veriyoruz.",
  ),
  'chrome.footer.linksTitle': t('Bağlantılar başlığı', 'Hızlı Linkler'),
  'chrome.footer.contactTitle': t('İletişim başlığı', 'İletişim'),
  'chrome.footer.rights': t('Telif satırı (yıl otomatik)', 'Şeker Anaokulu. Tüm hakları saklıdır.'),
  'chrome.footer.privacy': t('Gizlilik bağlantısı', 'Gizlilik Politikası'),
  'chrome.footer.terms': t('Kullanım şartları bağlantısı', 'Kullanım Şartları'),
  'chrome.footer.cookies': t('Çerez bağlantısı', 'Çerez Politikası'),
  'chrome.mobile.call': t('Ara düğmesi', 'Ara'),
  'chrome.mobile.whatsapp': t('WhatsApp düğmesi', 'WhatsApp'),
  'chrome.mobile.book': t('Randevu düğmesi', 'Randevu'),
  'chrome.whatsapp.label': t('Erişilebilirlik etiketi (ekran okuyucu)', "WhatsApp'tan yazın"),
  'chrome.contact.phone': t('Telefon başlığı', 'Telefon'),
  'chrome.contact.email': t('E-posta başlığı', 'E-posta'),
  'chrome.contact.address': t('Adres başlığı', 'Adres'),
  'chrome.lp.footer.kvkk': t('KVKK bağlantısı', 'KVKK Aydınlatma Metni'),
  'chrome.lp.footer.cookies': t('Çerez bağlantısı', 'Çerez Politikası'),
  ...Object.fromEntries(Object.entries(COOKIE_DEFAULTS).map(([key, def]) => [key, t(COOKIE_LABELS[key], def)])),
};
