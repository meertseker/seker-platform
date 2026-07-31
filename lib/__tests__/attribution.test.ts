import { describe, it, expect } from 'vitest';
import { ATTRIBUTION_KEY, parseAttribution, persistAttribution, type Attribution } from '../attribution';

describe('parseAttribution', () => {
  it('gclid ve landing path çıkarır', () => {
    expect(parseAttribution('?gclid=Cj0ABC123', '/lp/az-mevcutlu-anaokulu')).toEqual({
      gclid: 'Cj0ABC123',
      landingPath: '/lp/az-mevcutlu-anaokulu',
    });
  });

  it('gclid yoksa boş bırakır ama yolu tutar', () => {
    expect(parseAttribution('', '/kayit')).toEqual({ gclid: '', landingPath: '/kayit' });
  });

  it('diğer parametreler arasından gclid bulur', () => {
    expect(parseAttribution('?utm_source=google&gclid=XYZ&utm_medium=cpc', '/').gclid).toBe('XYZ');
  });

  it('aşırı uzun gclid değerini kırpar', () => {
    expect(parseAttribution(`?gclid=${'a'.repeat(300)}`, '/').gclid.length).toBeLessThanOrEqual(200);
  });
});

describe('persistAttribution', () => {
  function makeStorage(initial: string | null) {
    let value = initial;
    return {
      getItem: (key: string) => (key === ATTRIBUTION_KEY ? value : null),
      setItem: (key: string, next: string) => { if (key === ATTRIBUTION_KEY) value = next; },
      read: () => value,
    };
  }

  it('kayıt yoksa yeni değeri yazar', () => {
    const storage = makeStorage(null);
    const next: Attribution = { gclid: 'A1', landingPath: '/lp/kres-2-yas' };
    expect(persistAttribution(storage, next)).toEqual(next);
    expect(storage.read()).toBe(JSON.stringify(next));
  });

  it('ilk dokunuşu korur — sonraki sayfa gclid\'i ezmez', () => {
    const first: Attribution = { gclid: 'FIRST', landingPath: '/lp/kres-2-yas' };
    const storage = makeStorage(JSON.stringify(first));
    expect(persistAttribution(storage, { gclid: '', landingPath: '/kayit' })).toEqual(first);
  });

  it('kayıtlı gclid boşsa yeni gclid günceller', () => {
    const storage = makeStorage(JSON.stringify({ gclid: '', landingPath: '/' }));
    expect(persistAttribution(storage, { gclid: 'NEW', landingPath: '/lp/kres-2-yas' }).gclid).toBe('NEW');
  });

  it('bozuk kayıtta çökmeden yeni değeri kullanır', () => {
    const storage = makeStorage('{bozuk');
    const next: Attribution = { gclid: 'B2', landingPath: '/' };
    expect(persistAttribution(storage, next)).toEqual(next);
  });
});
