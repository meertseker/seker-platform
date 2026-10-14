import { describe, it, expect } from 'vitest';
import { AGE_GROUPS_CONTENT, getAgeGroup } from '../ageGroups';
import { ROSTER_STATUS } from '../day';

describe('ageGroups içeriği', () => {
  it('dört yaş grubu tanımlar (2-6 yaş)', () => {
    expect(AGE_GROUPS_CONTENT).toHaveLength(4);
  });

  it('grupları 2-3 yaştan başlayarak sırayla tanımlar', () => {
    const slugs = AGE_GROUPS_CONTENT.map((g) => g.slug);
    expect(slugs).toEqual(['2-3-yas', '3-4-yas', '4-5-yas', '5-6-yas']);
  });

  it('her grup sınıf mevcudunu tek kaynaktan (ROSTER_STATUS) alır, rakamı kendi yazmaz', () => {
    for (const group of AGE_GROUPS_CONTENT) {
      expect(group.classSize).toContain(String(ROSTER_STATUS.childCount));
      expect(group.classSize).toContain(`${ROSTER_STATUS.teacherCount} öğretmen`);
    }
  });

  it('her grubun benzersiz slug\'ı vardır', () => {
    const slugs = AGE_GROUPS_CONTENT.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('her grubun SEO metni doludur', () => {
    for (const group of AGE_GROUPS_CONTENT) {
      expect(group.metaDescription.length).toBeGreaterThan(70);
      expect(group.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it('slug ile grup bulur', () => {
    expect(getAgeGroup('3-4-yas')?.title).toContain('3-4');
  });

  it('bilinmeyen slug için undefined döner', () => {
    expect(getAgeGroup('99-yas')).toBeUndefined();
  });
});
