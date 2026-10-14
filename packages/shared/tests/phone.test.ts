import { describe, it, expect } from 'vitest';
import { normalizeTurkishPhone } from '../src/phone';

describe('normalizeTurkishPhone', () => {
  it.each([
    ['0536 656 33 96', '+905366563396'],
    ['+90 534 034 44 46', '+905340344446'],
    ['05315248234', '+905315248234'],
    ['90 541 977 66 21', '+905419776621'],
    ['5366563396', '+905366563396'],
    ['(0536) 656-33-96', '+905366563396'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeTurkishPhone(raw)).toBe(expected);
  });

  it.each([['123'], ['02123456789'], [''], ['+4915112345678'], ['0000000000']])(
    'geçersiz: %s -> null',
    (raw) => expect(normalizeTurkishPhone(raw)).toBeNull(),
  );
});
