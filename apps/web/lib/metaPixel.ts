import { consentVersionFromEnv } from './metaClick';

/**
 * Meta pikseli yardımcıları. Piksel varsayılan kapalıdır: kimlik boşsa ya da onay metni v2 açılmadıysa
 * hiçbir şey yüklenmez; ikisi de varsa yalnız çerez bandında "Kabul Et" seçilince yüklenir (KVKK).
 */

/** Çerez bandı seçimini kaydedince yayılan pencere olayı (detail: 'granted' | 'denied'). */
export const CONSENT_EVENT = 'seker:consent';

/**
 * NEXT_PUBLIC_META_PIXEL_ID yalnız rakamsa döner, değilse ''.
 * Onay metni v2 (Meta'yı anan aydınlatma ve çerez metni) açılmadan piksel yoktur: kimlik girilmiş olsa da ''.
 */
export function metaPixelId(): string {
  if (consentVersionFromEnv() !== 2) return '';
  const value = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? '';
  return /^\d+$/.test(value) ? value : '';
}

type Fbq = (...args: unknown[]) => void;

/**
 * Form başarısında Lead olayı. Sunucu (CAPI) aynı eventID ile gönderir, Meta tekilleştirir.
 * Piksel yüklenmemişse (kimlik yok / onay yok) sessizce çıkar; form akışına asla hata atmaz.
 */
export function trackMetaLead(eventId: string): void {
  try {
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    if (typeof fbq !== 'function') return;
    fbq('track', 'Lead', {}, { eventID: eventId });
  } catch {
    // Ölçüm hatası başvuruyu bozmamalı.
  }
}
