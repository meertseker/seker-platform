import { describe, it, expect } from 'vitest';
import { ATTRIBUTION_KEY, parseAttribution, persistAttribution, type Attribution } from '../attribution';

describe('parseAttribution', () => {
  it('gclid ve landing path çıkarır', () => {
    expect(parseAttribution('?gclid=Cj0ABC123', '/lp/az-mevcutlu-anaokulu')).toEqual({
      gclid: 'Cj0ABC123',
      landingPath: '/lp/az-mevcutlu-anaokulu',
      utm: {},
    });
  });

  it('gclid yoksa boş bırakır ama yolu tutar', () => {
    expect(parseAttribution('', '/kayit')).toEqual({ gclid: '', landingPath: '/kayit', utm: {} });
  });

  it('diğer parametreler arasından gclid ve utm değerlerini bulur', () => {
    const a = parseAttribution('?utm_source=google&gclid=XYZ&utm_medium=cpc&utm_campaign=kres&foo=1', '/');
    expect(a.gclid).toBe('XYZ');
    expect(a.utm).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'kres' });
  });

  it('aşırı uzun gclid ve utm değerlerini 200 karaktere kırpar', () => {
    const a = parseAttribution(`?gclid=${'a'.repeat(300)}&utm_campaign=${'c'.repeat(1000)}`, '/');
    expect(a.gclid.length).toBe(200);
    expect(a.utm.utm_campaign?.length).toBe(200);
  });

  it('boş utm parametrelerini almaz', () => {
    expect(parseAttribution('?utm_source=&utm_medium=%20', '/').utm).toEqual({});
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
    const next: Attribution = { gclid: 'A1', landingPath: '/lp/kres-2-yas', utm: {} };
    expect(persistAttribution(storage, next)).toEqual(next);
    expect(storage.read()).toBe(JSON.stringify(next));
  });

  it('ilk dokunuşu korur — sonraki sayfa gclid\'i ezmez', () => {
    const first: Attribution = { gclid: 'FIRST', landingPath: '/lp/kres-2-yas', utm: {} };
    const storage = makeStorage(JSON.stringify(first));
    expect(persistAttribution(storage, { gclid: '', landingPath: '/kayit', utm: {} })).toEqual(first);
  });

  it('utm ile gelen ilk dokunuş da korunur', () => {
    const first: Attribution = { gclid: '', landingPath: '/', utm: { utm_source: 'instagram' } };
    const storage = makeStorage(JSON.stringify(first));
    expect(persistAttribution(storage, { gclid: '', landingPath: '/kayit', utm: {} })).toEqual(first);
  });

  it('kayıtlı değerde sinyal yoksa yeni gclid günceller', () => {
    const storage = makeStorage(JSON.stringify({ gclid: '', landingPath: '/', utm: {} }));
    expect(persistAttribution(storage, { gclid: 'NEW', landingPath: '/lp/kres-2-yas', utm: {} }).gclid).toBe('NEW');
  });

  it('utm alanı olmayan eski biçimli kaydı okur', () => {
    const storage = makeStorage(JSON.stringify({ gclid: 'OLD', landingPath: '/lp/x' }));
    expect(persistAttribution(storage, { gclid: '', landingPath: '/kayit', utm: {} })).toEqual({
      gclid: 'OLD', landingPath: '/lp/x', utm: {},
    });
  });

  it('bozuk kayıtta çökmeden yeni değeri kullanır', () => {
    const storage = makeStorage('{bozuk');
    const next: Attribution = { gclid: 'B2', landingPath: '/', utm: {} };
    expect(persistAttribution(storage, next)).toEqual(next);
  });
});
