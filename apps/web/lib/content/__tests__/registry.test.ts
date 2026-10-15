import { describe, it, expect } from 'vitest';
import { SLOTS } from '../registry';
import { countChars } from '../chars';

describe('registry', () => {
  it.each(Object.entries(SLOTS))('%s geçerli bir tanım', (key, def) => {
    expect(key).toMatch(/^[a-z0-9][a-zA-Z0-9_.-]{1,120}$/);
    expect(def.label.length).toBeGreaterThan(0);
    if (def.kind === 'text') {
      expect(typeof def.default).toBe('string');
      expect(def.max).toBeGreaterThan(0);
      expect(countChars(def.default as string)).toBeLessThanOrEqual(def.max!);
      if (def.pattern) expect(def.default as string).toMatch(new RegExp(def.pattern));
    }
    if (def.kind === 'rich') expect(typeof def.default).toBe('string');
    if (def.kind === 'image') {
      expect(def.default).toMatchObject({ src: expect.any(String), alt: expect.any(String) });
    }
    if (def.kind === 'list') {
      expect(Array.isArray(def.default)).toBe(true);
      expect(def.fields).toBeDefined();
      const ids = (def.default as { id: string }[]).map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of def.default as Record<string, unknown>[]) {
        for (const [field, f] of Object.entries(def.fields!)) {
          if (f.kind === 'text' && f.max) expect(countChars(String(item[field] ?? ''))).toBeLessThanOrEqual(f.max);
        }
      }
    }
  });
});
