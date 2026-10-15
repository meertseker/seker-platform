import { describe, it, expect } from 'vitest';
import { countChars, fillVars } from '../chars';

describe('countChars', () => {
  it('Türkçe harfleri birer sayar', () => expect(countChars('İğüşöç')).toBe(6));
  it('birleşik emojiyi tek sayar', () => expect(countChars('👨‍👩‍👧')).toBe(1));
  it('boş metin 0', () => expect(countChars('')).toBe(0));
});

describe('fillVars', () => {
  it('belirteçleri doldurur', () => {
    expect(fillVars('{kurulusYili}den beri, {yilSayisi} yıl', { yilSayisi: '15', kurulusYili: '2011' })).toBe(
      '2011den beri, 15 yıl',
    );
  });
});
