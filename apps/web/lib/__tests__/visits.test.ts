import { describe, it, expect } from 'vitest';
import {
  classifyEntrySource,
  deviceFromUserAgent,
  isBotUserAgent,
  isEntrance,
  normalizeVisitPath,
  parseVisitPayload,
} from '../visits';

const HOST = 'sekeranaokulu.com';
const q = (s: string) => new URLSearchParams(s);

describe('classifyEntrySource', () => {
  it('reklam tıklama kimliği her şeyin önündedir', () => {
    expect(classifyEntrySource(q('gclid=abc&utm_source=google'), 'https://www.google.com/', HOST)).toBe('google_ads');
    expect(classifyEntrySource(q('gbraid=x'), '', HOST)).toBe('google_ads');
    expect(classifyEntrySource(q('wbraid=x'), '', HOST)).toBe('google_ads');
  });

  it('UTM varsa kampanya', () => {
    expect(classifyEntrySource(q('utm_source=instagram&utm_medium=bio'), 'https://l.instagram.com/', HOST)).toBe('kampanya');
  });

  it('arama motorları, sosyal medya, diğer siteler, doğrudan', () => {
    expect(classifyEntrySource(q(''), 'https://www.google.com.tr/', HOST)).toBe('arama');
    expect(classifyEntrySource(q(''), 'https://yandex.com.tr/search', HOST)).toBe('arama');
    expect(classifyEntrySource(q(''), 'https://l.instagram.com/?u=x', HOST)).toBe('sosyal');
    expect(classifyEntrySource(q(''), 'https://m.facebook.com/', HOST)).toBe('sosyal');
    expect(classifyEntrySource(q(''), 'https://www.okulrehberi.com/beylikduzu', HOST)).toBe('diger_site');
    expect(classifyEntrySource(q(''), '', HOST)).toBe('dogrudan');
  });

  it('kendi sitesinden gelen yönlendirme doğrudan sayılır', () => {
    expect(classifyEntrySource(q(''), 'https://sekeranaokulu.com/sss', HOST)).toBe('dogrudan');
  });

  it('benzer adlı sahte arama alan adları arama sayılmaz', () => {
    expect(classifyEntrySource(q(''), 'https://notgoogle.example.com/', HOST)).toBe('diger_site');
  });
});

describe('isEntrance', () => {
  it('yönlendiren yoksa veya başka siteyse giriştir', () => {
    expect(isEntrance('', HOST)).toBe(true);
    expect(isEntrance('https://www.google.com/', HOST)).toBe(true);
    expect(isEntrance('https://sekeranaokulu.com/', HOST)).toBe(false);
  });
});

describe('deviceFromUserAgent', () => {
  it('telefon ve tablet mobil, diğerleri masaüstü', () => {
    expect(deviceFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('mobil');
    expect(deviceFromUserAgent('Mozilla/5.0 (Linux; Android 15; SM-S921B) Mobile')).toBe('mobil');
    expect(deviceFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('masaustu');
  });
});

describe('normalizeVisitPath', () => {
  it('sorgu ve sondaki eğik çizgiyi atar', () => {
    expect(normalizeVisitPath('/lp/kres/?gclid=1#x')).toBe('/lp/kres');
    expect(normalizeVisitPath('/')).toBe('/');
  });

  it('geçersiz, çok uzun veya teknik yolları reddeder', () => {
    expect(normalizeVisitPath('lp')).toBeNull();
    expect(normalizeVisitPath('/' + 'a'.repeat(250))).toBeNull();
    expect(normalizeVisitPath('/<script>')).toBeNull();
    expect(normalizeVisitPath('/api/v')).toBeNull();
    expect(normalizeVisitPath('/_next/static/x.js')).toBeNull();
    expect(normalizeVisitPath(42)).toBeNull();
  });
});

describe('parseVisitPayload', () => {
  it('geçerli giriş ve iç gezinme', () => {
    expect(parseVisitPayload({ p: '/', s: 'arama', d: 'mobil', e: true })).toEqual({ p: '/', s: 'arama', d: 'mobil', e: true });
    expect(parseVisitPayload({ p: '/sss', s: 'site_ici', d: 'masaustu', e: false })).toEqual({
      p: '/sss', s: 'site_ici', d: 'masaustu', e: false,
    });
  });

  it('tutarsız veya bilinmeyen değerleri reddeder', () => {
    expect(parseVisitPayload({ p: '/', s: 'site_ici', d: 'mobil', e: true })).toBeNull();
    expect(parseVisitPayload({ p: '/', s: 'arama', d: 'mobil', e: false })).toBeNull();
    expect(parseVisitPayload({ p: '/', s: 'hack', d: 'mobil', e: true })).toBeNull();
    expect(parseVisitPayload({ p: '/', s: 'arama', d: 'tv', e: true })).toBeNull();
    expect(parseVisitPayload({ p: '/', s: 'arama', d: 'mobil', e: 'evet' })).toBeNull();
    expect(parseVisitPayload(null)).toBeNull();
  });
});

describe('isBotUserAgent', () => {
  it('botları ve boş tarayıcı bilgisini eler', () => {
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 Chrome-Lighthouse')).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1')).toBe(false);
  });
});
