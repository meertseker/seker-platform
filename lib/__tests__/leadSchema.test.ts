import { describe, it, expect } from 'vitest';
import { leadSchema } from '../leadSchema';

const valid = {
  parentName: 'Ayşe Yılmaz',
  phone: '05301018875',
  kvkkConsent: true,
};

describe('leadSchema', () => {
  it('yalnızca ad, telefon ve KVKK onayıyla geçerli bir lead kabul eder', () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });

  it('KVKK onayı olmadan reddeder', () => {
    const r = leadSchema.safeParse({ ...valid, kvkkConsent: false });
    expect(r.success).toBe(false);
  });

  it('kısa telefon numarasını reddeder', () => {
    const r = leadSchema.safeParse({ ...valid, phone: '123' });
    expect(r.success).toBe(false);
  });

  it('telefondaki boşluk ve parantezleri temizler', () => {
    const r = leadSchema.safeParse({ ...valid, phone: '(0530) 101 88 75' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe('05301018875');
  });

  it('tek harflik adı reddeder', () => {
    const r = leadSchema.safeParse({ ...valid, parentName: 'A' });
    expect(r.success).toBe(false);
  });

  it('kaldırılan alanlar artık sorulmuyor — şema çıktısında yer almaz', () => {
    const r = leadSchema.safeParse({
      ...valid,
      // Eski istemcilerden gelebilecek fazladan alanlar sessizce düşer.
      email: 'ayse@example.com',
      childAge: '3-4',
      program: 'tam-gun',
      startTerm: '2026-2027',
      message: 'Bilgi almak istiyorum',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      for (const key of ['email', 'childAge', 'program', 'startTerm', 'message']) {
        expect(r.data).not.toHaveProperty(key);
      }
    }
  });

  it('gclid ve landingPath gizli alanları taşınmaya devam eder', () => {
    const r = leadSchema.safeParse({ ...valid, gclid: 'Cj0ABC', landingPath: '/lp/x' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.gclid).toBe('Cj0ABC');
      expect(r.data.landingPath).toBe('/lp/x');
    }
  });
});
