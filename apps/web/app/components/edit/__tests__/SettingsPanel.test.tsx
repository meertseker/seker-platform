import { describe, it, expect } from 'vitest';
import { settingsKeysFor } from '../SettingsPanel';
import { SLOTS } from '@/lib/content/registry';

const meta = {
  'meta.yorumlar.title': { kind: 'text' as const, label: 'Sayfa başlığı' },
  'meta.yorumlar.description': { kind: 'text' as const, label: 'Açıklama' },
  'lp.kres-2-yas.metaTitle': { kind: 'text' as const, label: 'LP başlık' },
  'lp.kres-2-yas.metaDescription': { kind: 'text' as const, label: 'LP açıklama' },
  'yasgrubu.focus.suffix': { kind: 'text' as const, label: 'Odak başlığı sonu' },
  'yasgrubu.cta.suffix': { kind: 'text' as const, label: 'Form başlığı sonu' },
  'gunlukakis.scene.prefix': { kind: 'text' as const, label: 'Sahne etiketi' },
  'gunlukakis.roster.count': { kind: 'text' as const, label: 'Künye altyazısı' },
  'gunlukakis.roster.limit': { kind: 'text' as const, label: 'Künye üst sınır' },
  'form.help.before': { kind: 'text' as const, label: 'Form altı baş' },
  'form.error': { kind: 'text' as const, label: 'Form hatası' },
  'sss.cta.email': { kind: 'text' as const, label: 'E-posta düğmesi' },
  'site.phone': { kind: 'text' as const, label: 'Telefon' },
  'chrome.footer.rights': { kind: 'text' as const, label: 'Telif satırı' },
  'chrome.whatsapp.label': { kind: 'text' as const, label: 'WhatsApp etiketi' },
};

describe('settingsKeysFor', () => {
  it('normal sayfa', () => {
    expect(settingsKeysFor('/veli-yorumlari', meta, { '/veli-yorumlari': 'yorumlar' })).toEqual([
      'meta.yorumlar.title',
      'meta.yorumlar.description',
      'site.phone',
      'chrome.footer.rights',
      'chrome.whatsapp.label',
    ]);
  });
  it('reklam sayfası', () => {
    expect(settingsKeysFor('/lp/kres-2-yas', meta, {})).toEqual([
      'lp.kres-2-yas.metaTitle',
      'lp.kres-2-yas.metaDescription',
      // LP'de başvuru formu var: formun birleşik/koşullu yazıları sayfa ayarlarında.
      'form.help.before',
      'form.error',
      'site.phone',
      'chrome.footer.rights',
      'chrome.whatsapp.label',
    ]);
  });
  it('yaş grubu alt sayfası: ek alanlar sayfa alanlarından sonra', () => {
    const keys = settingsKeysFor('/yas-gruplari/2-3-yas', meta, {});
    expect(keys.slice(0, 2)).toEqual(['yasgrubu.focus.suffix', 'yasgrubu.cta.suffix']);
    expect(keys).not.toContain('gunlukakis.scene.prefix');
  });
  it('günlük akış: sahne ve künye alanları', () => {
    const keys = settingsKeysFor('/gunluk-akis', meta, { '/gunluk-akis': 'gunlukakis' });
    expect(keys).toEqual(expect.arrayContaining(['gunlukakis.scene.prefix', 'gunlukakis.roster.count', 'gunlukakis.roster.limit']));
    expect(keys).not.toContain('yasgrubu.focus.suffix');
  });
  it('form olan sayfalarda form ek alanları; diğerlerinde yok', () => {
    for (const path of ['/', '/kayit', '/iletisim', '/hakkimizda', '/yas-gruplari/2-3-yas']) {
      expect(settingsKeysFor(path, meta, {}), path).toEqual(expect.arrayContaining(['form.help.before', 'form.error']));
    }
    for (const path of ['/sss', '/veli-yorumlari']) {
      expect(settingsKeysFor(path, meta, {}), path).not.toContain('form.error');
    }
  });
  it('tıklanamayan yeni yazılar: çerez bandı her sayfada, uzun form alanları yalnız reklam sayfasında, sahne ön eki ana sayfada', () => {
    const all = Object.fromEntries(Object.keys(SLOTS).map((k) => [k, { kind: 'text' as const, label: k }]));
    expect(settingsKeysFor('/sss', all, {})).toEqual(expect.arrayContaining(['chrome.cookie.text', 'chrome.cookie.accept']));
    expect(settingsKeysFor('/kayit', all, {})).toEqual(expect.arrayContaining(['form.phone.placeholder', 'form.err.phone', 'form.tooMany']));
    expect(settingsKeysFor('/kayit', all, {})).not.toContain('form.birth.month');
    expect(settingsKeysFor('/lp/kres-2-yas', all, {})).toEqual(expect.arrayContaining(['form.birth.month', 'form.district.placeholder', 'form.err.startWindow']));
    expect(settingsKeysFor('/', all, {})).toContain('gunlukakis.scene.prefix');
    // Listelenen her anahtar kayıt defterinde tanımlı.
    for (const path of ['/', '/kayit', '/lp/kres-2-yas', '/gunluk-akis']) {
      for (const key of settingsKeysFor(path, all, {})) expect(SLOTS[key], key).toBeDefined();
    }
  });

  it('SSS: e-posta düğmesi yazısı sayfa ayarlarında', () => {
    expect(settingsKeysFor('/sss', meta, {})).toContain('sss.cta.email');
  });
  it('ek alan yalnızca meta içindeyse listelenir', () => {
    expect(settingsKeysFor('/gunluk-akis', {}, {})).toEqual([]);
  });
});
