import { describe, it, expect } from 'vitest';
import { CONSENT_KEY, readConsent, buildConsentUpdate } from '../consent';

function storageWith(value: string | null) {
  return { getItem: (key: string) => (key === CONSENT_KEY ? value : null) };
}

describe('readConsent', () => {
  it('kayıtlı onayı okur', () => {
    expect(readConsent(storageWith('granted'))).toBe('granted');
    expect(readConsent(storageWith('denied'))).toBe('denied');
  });

  it('kayıt yoksa null döner', () => {
    expect(readConsent(storageWith(null))).toBeNull();
  });

  it('geçersiz değeri null sayar', () => {
    expect(readConsent(storageWith('belki'))).toBeNull();
  });
});

describe('buildConsentUpdate', () => {
  it('onay verildiğinde dört sinyali açar', () => {
    expect(buildConsentUpdate('granted')).toEqual({
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    });
  });

  it('onay reddedildiğinde hepsini kapalı tutar', () => {
    expect(buildConsentUpdate('denied')).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
  });
});
