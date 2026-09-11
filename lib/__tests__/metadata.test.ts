import { describe, it, expect } from 'vitest';
import { buildMetadata } from '../metadata';

describe('buildMetadata', () => {
  const meta = buildMetadata({
    title: 'Ücretler',
    description: 'Şeffaf ücret bilgisi.',
    path: '/ucretler',
  });

  it('başlığa marka son ekini ekler', () => {
    expect(meta.title).toBe('Ücretler | Özel Şeker Anaokulu');
  });

  it('çağıran taraf soneki kendi yazmışsa ikinci kez eklemez', () => {
    const already = buildMetadata({
      title: 'Az Mevcutlu Anaokulu | Özel Şeker Anaokulu',
      description: 'x',
      path: '/lp/az-mevcutlu-anaokulu',
    });
    expect(already.title).toBe('Az Mevcutlu Anaokulu | Özel Şeker Anaokulu');
  });

  it('canonical URL üretir', () => {
    expect(meta.alternates?.canonical).toBe('https://sekeranaokulu.com/ucretler');
  });

  it('OpenGraph verisi üretir', () => {
    expect(meta.openGraph?.url).toBe('https://sekeranaokulu.com/ucretler');
    expect(meta.openGraph?.locale).toBe('tr_TR');
  });

  it('ana sayfada çift marka adı kullanmaz', () => {
    const home = buildMetadata({ title: 'Özel Şeker Anaokulu', description: 'x', path: '/' });
    expect(home.title).toBe('Özel Şeker Anaokulu');
  });

  it('ana sayfa canonical URL\'inde sondaki eğik çizgi bulunmaz', () => {
    const home = buildMetadata({ title: 'Özel Şeker Anaokulu', description: 'x', path: '/' });
    expect(home.alternates?.canonical).toBe('https://sekeranaokulu.com');
  });

  it('noindex bayrağına uyar', () => {
    const hidden = buildMetadata({ title: 'X', description: 'y', path: '/z', noindex: true });
    expect(hidden.robots).toEqual({ index: false, follow: false });
  });

  it('noindex istenmediğinde robots alanı hiç eklenmez', () => {
    const meta = buildMetadata({ title: 'X', description: 'y', path: '/z' });
    expect('robots' in meta).toBe(false);
  });
});
