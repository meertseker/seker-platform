import { describe, it, expect } from 'vitest';
import { leadSchema, PHONE_ERROR } from '../leadSchema';

const valid = {
  parentName: 'Ayşe Yılmaz',
  phone: '05301018875',
  kvkkConsent: true,
};

describe('leadSchema', () => {
  it('yalnızca ad, telefon ve KVKK onayıyla geçerli bir lead kabul eder', () => {
    const r = leadSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe('+905301018875');
      expect(r.data.utm).toEqual({});
      expect(r.data.website).toBe('');
    }
  });

  it('KVKK onayı olmadan reddeder', () => {
    expect(leadSchema.safeParse({ ...valid, kvkkConsent: false }).success).toBe(false);
  });

  it.each([
    ['(0530) 101 88 75'],
    ['+90 530 101 88 75'],
    ['0090 530 101 88 75'],
    ['530-101-88-75'],
  ])('%s biçimini E.164 cep numarasına çevirir', (phone) => {
    const r = leadSchema.safeParse({ ...valid, phone });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe('+905301018875');
  });

  it.each([['123'], ['0212 222 33 44'], ['']])('%s numarasını Türkçe mesajla reddeder', (phone) => {
    const r = leadSchema.safeParse({ ...valid, phone });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.phone?.[0]).toBe(PHONE_ERROR);
  });

  it('tek harflik adı reddeder', () => {
    expect(leadSchema.safeParse({ ...valid, parentName: 'A' }).success).toBe(false);
  });

  it('kaldırılan alanlar artık sorulmuyor — şema çıktısında yer almaz', () => {
    const r = leadSchema.safeParse({
      ...valid,
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

  it('gclid, landingPath ve utm gizli alanları taşınır; bilinmeyen utm anahtarı düşer', () => {
    const r = leadSchema.safeParse({
      ...valid, gclid: 'Cj0ABC', landingPath: '/lp/x',
      utm: { utm_source: 'google', utm_campaign: 'kres', utm_evil: 'x' },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.gclid).toBe('Cj0ABC');
      expect(r.data.landingPath).toBe('/lp/x');
      expect(r.data.utm).toEqual({ utm_source: 'google', utm_campaign: 'kres' });
    }
  });

  it('çok uzun gizli alanlar başvuruyu reddettirmez, kırpılır', () => {
    const r = leadSchema.safeParse({
      ...valid, gclid: 'g'.repeat(300), landingPath: '/'.repeat(500),
      utm: { utm_campaign: 'c'.repeat(1000) },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.gclid).toHaveLength(200);
      expect(r.data.landingPath).toHaveLength(200);
      expect(r.data.utm.utm_campaign).toHaveLength(200);
    }
  });

  it('honeypot alanını taşır (route bot olarak ele alır)', () => {
    const r = leadSchema.safeParse({ ...valid, website: 'http://spam.example' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.website).toBe('http://spam.example');
  });
});

describe('leadSchema qualify alanları', () => {
  const base = { parentName: 'Ayşe Yılmaz', phone: '05301018875', kvkkConsent: true as const };
  const year = new Date().getFullYear();
  const full = {
    ...base,
    qualify: true,
    childBirthMonth: 5,
    childBirthYear: year - 3,
    district: 'Beykent',
    startWindow: '1_3_ay',
    wantsWhatsapp: true,
  };

  it('qualify açıkken semt eksikse şema reddeder', () => {
    const rest: Partial<typeof full> = { ...full };
    delete rest.district;
    const r = leadSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.district).toBeTruthy();
  });

  it('qualify kapalıyken eski form değişmeden geçer', () => {
    expect(leadSchema.safeParse(base).success).toBe(true);
  });

  it('qualify açık ve tüm alanlar geçerliyse geçer', () => {
    expect(leadSchema.safeParse(full).success).toBe(true);
    expect(leadSchema.safeParse({ ...full, district: 'Diğer', wantsWhatsapp: false }).success).toBe(true);
  });

  it('geçersiz ay, yıl, semt ve dönemi reddeder', () => {
    for (const bad of [
      { childBirthMonth: 13 },
      { childBirthYear: year - 8 },
      { childBirthYear: year + 1 },
      { district: 'Ankara' },
      { startWindow: 'yarin' },
    ]) {
      expect(leadSchema.safeParse({ ...full, ...bad }).success).toBe(false);
    }
  });
});
