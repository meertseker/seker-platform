import { describe, it, expect } from 'vitest';
import { TESTIMONIALS, PUBLISHED_TESTIMONIALS } from '../testimonials';

describe('veli yorumları', () => {
  it('her yorumun metni ve kaynağı vardır', () => {
    for (const item of TESTIMONIALS) {
      expect(item.quote.length).toBeGreaterThan(20);
      expect(['google', 'form', 'yuz-yuze']).toContain(item.source);
    }
  });

  it('soyadı açık yazılmaz (KVKK) — ya yalnızca ad, ya ad + kısaltılmış soyadı', () => {
    for (const item of TESTIMONIALS) {
      // Kabul edilen: "Emre", "Arzu Ö.", "Gizem K.Ç."
      // Reddedilen: "Arzu Öztürk" gibi açık soyadı taşıyan her biçim.
      expect(item.author, item.id).toMatch(/^\p{Lu}\p{Ll}+(?: (?:\p{Lu}\.)+)?$/u);
    }
  });
});

describe('veli yorumları yayın güvenliği', () => {
  it('yayınlanan hiçbir yorum TODO metni içermez', () => {
    for (const item of PUBLISHED_TESTIMONIALS) {
      expect(item.quote).not.toMatch(/TODO/i);
      expect(item.author).not.toMatch(/TODO/i);
      expect(item.context).not.toMatch(/TODO/i);
    }
  });

  it('yayınlanan yorumlar TESTIMONIALS içinde bulunan hazır (ready) alt kümedir', () => {
    for (const item of PUBLISHED_TESTIMONIALS) {
      expect(TESTIMONIALS).toContain(item);
      expect(item.ready).toBe(true);
    }
  });

  it('hazır olmayan taslaklar TESTIMONIALS içinde korunur ama yayınlanmaz', () => {
    // Şu an bütün yorumlar Google'da herkese açık ve yayına uygun; taslak
    // kalmadığında liste eşitlenir. Kapı yine de çalışır durumda kalmalı.
    expect(TESTIMONIALS.length).toBeGreaterThanOrEqual(PUBLISHED_TESTIMONIALS.length);
    for (const item of TESTIMONIALS.filter((t) => !t.ready)) {
      expect(PUBLISHED_TESTIMONIALS).not.toContain(item);
    }
  });
});
