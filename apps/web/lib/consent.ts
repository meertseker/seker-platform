export type ConsentChoice = 'granted' | 'denied';

export const CONSENT_KEY = 'seker_consent_v2';

const MANAGED_SIGNALS = [
  'ad_storage',
  'ad_user_data',
  'ad_personalization',
  'analytics_storage',
] as const;

export function readConsent(storage: Pick<Storage, 'getItem'>): ConsentChoice | null {
  const value = storage.getItem(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function buildConsentUpdate(choice: ConsentChoice): Record<string, ConsentChoice> {
  return Object.fromEntries(
    MANAGED_SIGNALS.map((signal) => [signal, choice]),
  ) as Record<string, ConsentChoice>;
}
