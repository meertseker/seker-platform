import { describe, it, expect } from 'vitest';
import { makeReader, pickData } from '../reader';
import type { ReaderData } from '../types';

const data: ReaderData = {
  values: {
    'home.hero.title': 'Başlık {yilSayisi}',
    'home.faq': [{ id: 'a', question: 'S?', answer: 'C' }],
    'media.x': { src: '/zurafalar.webp', alt: 'x', width: 1, height: 1, assetId: null },
    'other.key': 'z',
  },
  updatedAt: {},
  meta: {
    'home.hero.title': { kind: 'text', max: 120, label: 'Başlık' },
    'home.faq': { kind: 'list', label: 'SSS', fields: { question: { kind: 'text', max: 120, label: 'Soru' } } },
    'media.x': { kind: 'image', label: 'Foto' },
    'other.key': { kind: 'text', label: 'z' },
  },
  editing: false,
  vars: { yilSayisi: '15', kurulusYili: '2011' },
};

describe('makeReader', () => {
  it('ziyaretçide öznitelik üretmez', () => {
    const c = makeReader(data);
    expect(c.text('home.hero.title')).toBe('Başlık 15');
    expect(c.attrs('home.hero.title')).toEqual({});
    expect(c.listAttrs('home.faq')).toEqual({});
  });
  it('düzenlemede data-edit-* üretir', () => {
    const c = makeReader({ ...data, editing: true });
    expect(c.attrs('home.hero.title')).toEqual({
      'data-edit-key': 'home.hero.title',
      'data-edit-kind': 'text',
      'data-edit-max': '120',
    });
    expect(c.attrs('home.faq', 'a.question')).toEqual({
      'data-edit-key': 'home.faq',
      'data-edit-kind': 'text',
      'data-edit-max': '120',
      'data-edit-path': 'a.question',
    });
    expect(c.listAttrs('home.faq')).toEqual({ 'data-edit-list': 'home.faq', 'data-edit-label': 'SSS' });
  });
  it('bilinmeyen anahtarda hata fırlatır (yazım hatası sessiz geçmesin)', () => {
    expect(() => makeReader(data).text('yok.boyle')).toThrow(/yok.boyle/);
  });
  it('fill() belirteçleri text() ile aynı şekilde doldurur (liste alanları için)', () => {
    const c = makeReader(data);
    expect(c.fill('{kurulusYili}den beri {yilSayisi} yıl')).toBe('2011den beri 15 yıl');
    expect(c.fill('belirteç yok')).toBe('belirteç yok');
  });
});

describe('pickData', () => {
  it('yalnızca verilen önekleri taşır', () => {
    const picked = pickData(data, ['home.']);
    expect(Object.keys(picked.values).sort()).toEqual(['home.faq', 'home.hero.title']);
    expect(Object.keys(picked.meta).sort()).toEqual(['home.faq', 'home.hero.title']);
  });
});
