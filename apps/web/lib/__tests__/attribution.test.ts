import { describe, it, expect } from 'vitest';
import { ATTRIBUTION_KEY, parseAttribution, persistAttribution, type Attribution } from '../attribution';

describe('parseAttribution', () => {
  it('gclid ve landing path çıkarır', () => {
    expect(parseAttribution('?gclid=Cj0ABC123', '/lp/az-mevcutlu-anaokulu')).toEqual({
      gclid: 'Cj0ABC123',
      fbclid: '',
      fbc: '',
      landingPath: '/lp/az-mevcutlu-anaokulu',
      utm: {},
    });
  });

  it('gclid yoksa boş bırakır ama yolu tutar', () => {
    expect(parseAttribution('', '/kayit')).toEqual({ gclid: '', fbclid: '', fbc: '', landingPath: '/kayit', utm: {} });
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
    const next: Attribution = { gclid: 'A1', fbclid: '', fbc: '', landingPath: '/lp/kres-2-yas', utm: {} };
    expect(persistAttribution(storage, next)).toEqual(next);
    expect(storage.read()).toBe(JSON.stringify(next));
  });

  it('ilk dokunuşu korur — sonraki sayfa gclid\'i ezmez', () => {
    const first: Attribution = { gclid: 'FIRST', fbclid: '', fbc: '', landingPath: '/lp/kres-2-yas', utm: {} };
    const storage = makeStorage(JSON.stringify(first));
    expect(persistAttribution(storage, { gclid: '', fbclid: '', fbc: '', landingPath: '/kayit', utm: {} })).toEqual(first);
  });

  it('utm ile gelen ilk dokunuş da korunur', () => {
    const first: Attribution = { gclid: '', fbclid: '', fbc: '', landingPath: '/', utm: { utm_source: 'instagram' } };
    const storage = makeStorage(JSON.stringify(first));
    expect(persistAttribution(storage, { gclid: '', fbclid: '', fbc: '', landingPath: '/kayit', utm: {} })).toEqual(first);
  });

  it('kayıtlı değerde sinyal yoksa yeni gclid günceller', () => {
    const storage = makeStorage(JSON.stringify({ gclid: '', landingPath: '/', utm: {} }));
    expect(persistAttribution(storage, { gclid: 'NEW', fbclid: '', fbc: '', landingPath: '/lp/kres-2-yas', utm: {} }).gclid).toBe('NEW');
  });

  it('utm alanı olmayan eski biçimli kaydı okur', () => {
    const storage = makeStorage(JSON.stringify({ gclid: 'OLD', landingPath: '/lp/x' }));
    expect(persistAttribution(storage, { gclid: '', fbclid: '', fbc: '', landingPath: '/kayit', utm: {} })).toEqual({
      gclid: 'OLD', fbclid: '', fbc: '', landingPath: '/lp/x', utm: {},
    });
  });

  it('bozuk kayıtta çökmeden yeni değeri kullanır', () => {
    const storage = makeStorage('{bozuk');
    const next: Attribution = { gclid: 'B2', fbclid: '', fbc: '', landingPath: '/', utm: {} };
    expect(persistAttribution(storage, next)).toEqual(next);
  });
});

describe('fbclid / fbc', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('fbclid büyük/küçük harfi bozmadan fbc üretir', () => {
    const a = parseAttribution('?fbclid=IwAR0AbC', '/', 1700000000000);
    expect(a.fbclid).toBe('IwAR0AbC');
    expect(a.fbc).toBe('fb.1.1700000000000.IwAR0AbC');
  });

  it('fbclid ilk dokunuşta fbc ile saklanır, sonraki sayfa ezmez', () => {
    const s = mem();
    persistAttribution(s, parseAttribution('?fbclid=ILK', '/lp/x', 1000));
    const second = persistAttribution(s, parseAttribution('?fbclid=IKINCI', '/kayit', 2000));
    expect(second.fbclid).toBe('ILK');
    expect(second.fbc).toBe('fb.1.1000.ILK');
  });

  it('eski depolanmış nesnede fbclid/fbc yoksa boş döner', () => {
    const s = mem();
    s.setItem(ATTRIBUTION_KEY, JSON.stringify({ gclid: '', landingPath: '/', utm: {} }));
    const r = persistAttribution(s, parseAttribution('', '/x'));
    expect(r.fbclid).toBe('');
    expect(r.fbc).toBe('');
  });
});

describe('organik Instagram ilk dokunuşu Google tıklamasını engellemez (I-3)', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('yalnız fbclid olan kayıt sonraki gclid ile değişir', () => {
    const s = mem();
    persistAttribution(s, parseAttribution('?fbclid=ORGANIK', '/', 1000));
    const r = persistAttribution(s, parseAttribution('?gclid=GCL1', '/lp/kres-2-yas', 2000));
    expect(r.gclid).toBe('GCL1');
    expect(r.landingPath).toBe('/lp/kres-2-yas');
    expect(JSON.parse(s.getItem(ATTRIBUTION_KEY)!).gclid).toBe('GCL1');
  });

  it('yalnız fbclid olan kayıt sonraki herhangi bir UTM ile değişir', () => {
    const s = mem();
    persistAttribution(s, parseAttribution('?fbclid=ORGANIK', '/', 1000));
    const r = persistAttribution(s, parseAttribution('?utm_source=instagram&utm_medium=paid_social', '/lp/x', 2000));
    expect(r.utm).toEqual({ utm_source: 'instagram', utm_medium: 'paid_social' });
  });

  it('fbclid + UTM olan (Meta reklamı) kayıt sonraki gclid ile değişmez', () => {
    const s = mem();
    const first = persistAttribution(s, parseAttribution('?fbclid=AD&utm_source=instagram&utm_medium=paid_social', '/', 1000));
    expect(persistAttribution(s, parseAttribution('?gclid=GCL2', '/kayit', 2000))).toEqual(first);
  });

  it('yalnız fbclid olan kayıt sinyalsiz sonraki sayfada korunur', () => {
    const s = mem();
    const first = persistAttribution(s, parseAttribution('?fbclid=ORGANIK', '/', 1000));
    expect(persistAttribution(s, parseAttribution('', '/kayit', 2000))).toEqual(first);
  });
});

describe('uzun fbclid kırpılmaz (I-4)', () => {
  it('300 karakterlik fbclid ve fbc değişmeden saklanır', () => {
    const fbclid = 'IwAR' + 'aB9_-'.repeat(59) + 'Zz';
    const a = parseAttribution(`?fbclid=${fbclid}`, '/', 1700000000000);
    expect(a.fbclid).toBe(fbclid);
    expect(a.fbc).toBe(`fb.1.1700000000000.${fbclid}`);
  });

  it('fbclid 500 karakterde kesilir; gclid 200de kalır', () => {
    const a = parseAttribution(`?fbclid=${'f'.repeat(800)}&gclid=${'g'.repeat(800)}`, '/', 1);
    expect(a.fbclid.length).toBe(500);
    expect(a.gclid.length).toBe(200);
  });
});
