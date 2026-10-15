import { describe, it, expect } from 'vitest';
import { buildPreschoolSchema } from '@/lib/schema';
import { preschoolSchema } from '@/lib/schemaDefaults';
import { makeReader } from '@/lib/content/reader';
import { defaultData } from '@/lib/content/testing';
import { whatsappUrl, phoneE164, WHATSAPP_URL, SITE } from '@/lib/site';

describe('buildPreschoolSchema', () => {
  it('telefon ve adresi içerikten alır, yapıyı korur', () => {
    const data = defaultData();
    data.values['site.phone'] = '0532 111 22 33';
    data.values['site.address.street'] = 'Yeni Sokak 1';
    const s = buildPreschoolSchema(makeReader(data)) as Record<string, unknown>;
    expect(s['@type']).toBe('Preschool');
    expect(s.telephone).toBe('+905321112233');
    expect((s.address as Record<string, unknown>).streetAddress).toBe('Yeni Sokak 1');
    expect(Object.keys(s)).toEqual(Object.keys(preschoolSchema));
  });

  it('varsayılan içerik eski sabitlerle aynı değerleri üretir', () => {
    expect(preschoolSchema.telephone).toBe(SITE.phone.e164);
    expect(preschoolSchema.foundingDate).toBe(String(SITE.foundingYear));
    expect(preschoolSchema.address.addressRegion).toBe(SITE.address.city);
    expect(preschoolSchema.name).toBe(SITE.name);
    expect(preschoolSchema.description).toBe(SITE.description);
    expect(preschoolSchema.email).toBe(SITE.email);
    const hours = preschoolSchema.openingHoursSpecification[0];
    expect(hours.opens).toBe(SITE.hours.opens);
    expect(hours.closes).toBe(SITE.hours.closes);
  });
});

describe('telefon ve WhatsApp bağlantıları', () => {
  it('varsayılanda eski WHATSAPP_URL ile aynı', () => {
    expect(whatsappUrl(makeReader(defaultData()))).toBe(WHATSAPP_URL);
  });
  it('geçersiz telefonda koddaki numaraya düşer; geçerlide wa.me yeni numarayı kullanır', () => {
    const data = defaultData();
    data.values['site.phone'] = 'abc';
    expect(phoneE164(makeReader(data))).toBe(SITE.phone.e164);
    data.values['site.phone'] = '0532 111 22 33';
    expect(whatsappUrl(makeReader(data))).toContain('https://wa.me/905321112233?text=');
  });
});
