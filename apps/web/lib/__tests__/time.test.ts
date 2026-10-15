import { describe, it, expect, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));

import { currentYear, todayIso, fillYears } from '../time';

describe('time', () => {
  it('currentYear bugünün yılını döner', async () => {
    expect(await currentYear()).toBe(new Date().getFullYear());
  });
  it('todayIso ISO tarih döner', async () => {
    expect(await todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('fillYears {yilSayisi} belirtecini doldurur', () => {
    expect(fillYears('{yilSayisi} yıl', 15)).toBe('15 yıl');
    expect(fillYears('belirteçsiz', 15)).toBe('belirteçsiz');
  });
});
