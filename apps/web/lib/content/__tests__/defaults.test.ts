import { describe, it, expect } from 'vitest';
import { SLOTS } from '../registry';
import { validateEdits } from '../validate';

const vars = { yilSayisi: '15', kurulusYili: '2011' };

/**
 * Sabit listelerde bir alan düzenlenince listenin tamamı kaydedilir. Varsayılanında boş bir alan zorunluysa
 * listedeki hiçbir metin kaydedilemez (Eğitim sayfası "4. paragraf boş bırakılamaz" hatası).
 */
describe('kayıt defteri varsayılanları', () => {
  it.each(Object.keys(SLOTS).filter((k) => SLOTS[k].kind !== 'image'))('%s varsayılanı olduğu gibi kaydedilebilir', (key) => {
    const r = validateEdits([{ key, value: SLOTS[key].default, baseUpdatedAt: null }], vars);
    expect(r).toMatchObject({ ok: true });
  });
});
