import { describe, it, expect } from 'vitest';
import { leadSchema } from '../leadSchema';

const valid = {
  parentName: 'Ayşe Yılmaz',
  phone: '05301018875',
  email: 'ayse@example.com',
  childAge: '3-4',
  program: 'tam-gun',
  startTerm: '2026-2027',
  message: 'Bilgi almak istiyorum',
  kvkkConsent: true,
};

describe('leadSchema', () => {
  it('geçerli bir lead kabul eder', () => {
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

  it('e-posta boş bırakılabilir', () => {
    const r = leadSchema.safeParse({ ...valid, email: '' });
    expect(r.success).toBe(true);
  });

  it('geçersiz yaş grubunu reddeder', () => {
    const r = leadSchema.safeParse({ ...valid, childAge: '15-16' });
    expect(r.success).toBe(false);
  });

  it('2-3 yaş grubunu kabul eder', () => {
    const r = leadSchema.safeParse({ ...valid, childAge: '2-3' });
    expect(r.success).toBe(true);
  });

  it('oyun grubu programını kabul eder', () => {
    const r = leadSchema.safeParse({ ...valid, program: 'oyun-grubu' });
    expect(r.success).toBe(true);
  });
});
