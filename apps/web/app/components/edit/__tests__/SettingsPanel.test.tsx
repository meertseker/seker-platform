import { describe, it, expect } from 'vitest';
import { settingsKeysFor } from '../SettingsPanel';

const meta = {
  'meta.bultenler.title': { kind: 'text' as const, label: 'Sayfa başlığı' },
  'meta.bultenler.description': { kind: 'text' as const, label: 'Açıklama' },
  'lp.kres-2-yas.metaTitle': { kind: 'text' as const, label: 'LP başlık' },
  'lp.kres-2-yas.metaDescription': { kind: 'text' as const, label: 'LP açıklama' },
  'site.phone': { kind: 'text' as const, label: 'Telefon' },
};

describe('settingsKeysFor', () => {
  it('normal sayfa', () => {
    expect(settingsKeysFor('/bultenler', meta, { '/bultenler': 'bultenler' })).toEqual([
      'meta.bultenler.title',
      'meta.bultenler.description',
      'site.phone',
    ]);
  });
  it('reklam sayfası', () => {
    expect(settingsKeysFor('/lp/kres-2-yas', meta, {})).toEqual([
      'lp.kres-2-yas.metaTitle',
      'lp.kres-2-yas.metaDescription',
      'site.phone',
    ]);
  });
});
