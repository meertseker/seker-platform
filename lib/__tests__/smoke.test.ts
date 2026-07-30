import { describe, it, expect } from 'vitest';
import { SITE } from '../site';

describe('test altyapısı', () => {
  it('site sabitlerini yükleyebilir', () => {
    expect(SITE.name).toBe('Özel Şeker Anaokulu');
  });
});
