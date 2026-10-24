'use client';

import type { ReaderData } from '@/lib/content/types';
import { countChars } from '@/lib/content/chars';
import { COOKIE_DEFAULTS } from '@/lib/content/slots/chrome';
import { FORM_QUALIFY_SETTING_KEYS, FORM_SETTING_KEYS } from '@/lib/content/slots/form';
import { Drawer } from './Drawer';

/**
 * Sayfada tıklanacak görünür yeri olmayan site geneli alanlar (telif satırı, WhatsApp düğmesi etiketi,
 * çerez bandı: bant yalnızca tercih kaydı olmayan tarayıcıda açılır).
 */
const EXTRA_SETTING_KEYS = ['chrome.footer.rights', 'chrome.whatsapp.label', ...Object.keys(COOKIE_DEFAULTS)];

/**
 * Sayfadaki birleşik (başka metinle yan yana basılan) öğelerde satır içi düzenleme işareti olmaz;
 * bu alanlar yalnızca burada, ilgili sayfanın ayarlarında düzenlenir. Anahtar: yol deseni.
 */
export const PAGE_EXTRA_KEYS: { match: RegExp; keys: string[] }[] = [
  { match: /^\/yas-gruplari\/[a-z0-9-]+$/, keys: ['yasgrubu.focus.suffix', 'yasgrubu.cta.suffix'] },
  // Başvuru formu olan sayfalar: formda yalnızca belirli durumlarda görünen veya birleşik yazılar.
  {
    match: /^\/$|^\/lp\/[a-z0-9-]+$|^\/(kayit|iletisim|egitim-yaklasimimiz|hakkimizda|yas-gruplari|gunluk-akis|aktiviteler)(\/[a-z0-9-]+)?$/,
    keys: ['form.help.before', 'form.help.after', 'form.submitting', 'form.error', 'form.invalid', ...FORM_SETTING_KEYS],
  },
  // Reklam sayfalarındaki uzun form: seçim kutularının ilk satırları ve seçim hataları.
  { match: /^\/lp\/[a-z0-9-]+$/, keys: FORM_QUALIFY_SETTING_KEYS },
  // Ana sayfadaki "Sahne 01" etiketleri günlük akış sayfasıyla aynı ön eki kullanır.
  { match: /^\/$/, keys: ['gunlukakis.scene.prefix'] },
  { match: /^\/gizlilik$/, keys: ['legal.gizlilik.updatedLabel', 'legal.gizlilik.updatedOn'] },
  { match: /^\/sss$/, keys: ['sss.cta.email'] },
  { match: /^\/gunluk-akis$/, keys: ['gunlukakis.scene.prefix', 'gunlukakis.roster.count', 'gunlukakis.roster.limit'] },
];

export function settingsKeysFor(pathname: string, meta: ReaderData['meta'], pageIds: Record<string, string>): string[] {
  const lp = pathname.match(/^\/lp\/([a-z0-9-]+)$/);
  const pageKeys = lp
    ? [`lp.${lp[1]}.metaTitle`, `lp.${lp[1]}.metaDescription`]
    : pageIds[pathname] ? [`meta.${pageIds[pathname]}.title`, `meta.${pageIds[pathname]}.description`] : [];
  const pageExtras = PAGE_EXTRA_KEYS.filter((e) => e.match.test(pathname)).flatMap((e) => e.keys);
  return [...pageKeys.filter((k) => k in meta), ...pageExtras.filter((k) => k in meta), ...Object.keys(meta).filter((k) => k.startsWith('site.')),
    ...EXTRA_SETTING_KEYS.filter((k) => k in meta)];
}

export function SettingsPanel({ keys, data, currentValue, onChange, onClose }: {
  keys: string[]; data: ReaderData; currentValue(k: string): unknown; onChange(k: string, v: string): void; onClose(): void;
}) {
  return (
    <Drawer title="Sayfa ayarları ve okul bilgileri" onClose={onClose}>
      <p style={{ fontSize: 13, color: '#5f4f75' }}>
        Sayfa başlığı ve açıklaması Google sonuçlarında görünür. Okul bilgileri (telefon, adres, saatler) sitenin her yerinde kullanılır.
      </p>
      {keys.map((k) => {
        const m = data.meta[k];
        const v = String(currentValue(k) ?? '');
        const n = countChars(v);
        return (
          <label key={k} style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
            <span>{m.label} <small style={{ color: m.max && n > m.max ? '#b4234e' : undefined }}>({n}{m.max ? ` / ${m.max}` : ''})</small></span>
            <input id={`setting-${k}`} value={v} onChange={(e) => onChange(k, e.target.value)} />
            {m.pattern && v && !new RegExp(m.pattern).test(v) ? <small style={{ color: '#b4234e' }}>Biçim uygun değil.</small> : null}
          </label>
        );
      })}
    </Drawer>
  );
}
