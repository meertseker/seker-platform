import { describe, it, expect } from 'vitest';
import { preschoolSchema, buildFaqSchema } from '../schema';
import { SITE } from '../site';

describe('preschoolSchema', () => {
  it('Preschool tipini kullanır', () => {
    expect(preschoolSchema['@type']).toBe('Preschool');
  });

  it('gerçek telefon numarasını kullanır (placeholder değil)', () => {
    expect(preschoolSchema.telephone).toBe(SITE.phone.e164);
    expect(preschoolSchema.telephone).not.toContain('555-123');
  });

  it('adres ve koordinat içerir', () => {
    expect(preschoolSchema.address.addressLocality).toContain('Beykent');
    expect(preschoolSchema.geo['@type']).toBe('GeoCoordinates');
  });

  it('çalışma saatlerini içerir', () => {
    expect(preschoolSchema.openingHoursSpecification[0].opens).toBe(SITE.hours.opens);
  });

  it('boş sosyal medya linklerini dahil etmez', () => {
    expect(preschoolSchema.sameAs.every((url: string) => url.length > 0)).toBe(true);
  });
});

describe('buildFaqSchema', () => {
  it('soruları FAQPage yapısına çevirir', () => {
    const schema = buildFaqSchema([
      { id: 'a', question: 'Kaç yaş?', answer: '2-6 yaş.', featured: true, ready: true },
    ]);
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity[0].name).toBe('Kaç yaş?');
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe('2-6 yaş.');
  });
});
