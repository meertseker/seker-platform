import { describe, it, expect } from 'vitest';
import { TEACHERS } from '../teachers';

describe('öğretmen kadrosu', () => {
  it('en az bir kişi içerir', () => {
    expect(TEACHERS.length).toBeGreaterThan(0);
  });

  it('her kişinin adı ve unvanı vardır', () => {
    for (const person of TEACHERS) {
      expect(person.name.length).toBeGreaterThan(2);
      expect(person.role.length).toBeGreaterThan(2);
    }
  });

  it('fotoğrafı olan kişilerin fotoğrafı public/kadro/ altındadır', () => {
    for (const person of TEACHERS) {
      if (person.photo) {
        expect(person.photo).toMatch(/^\/kadro\//);
      }
    }
  });

  it('her kişinin eğitim bilgisi vardır', () => {
    for (const person of TEACHERS) {
      expect(person.education.length).toBeGreaterThan(5);
    }
  });
});
