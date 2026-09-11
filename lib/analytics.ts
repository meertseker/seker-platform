export const TRACKED_EVENTS = [
  'lead_submit',
  'whatsapp_click',
  'tel_click',
  'cta_click',
  'tour_request',
  'pricing_view',
] as const;

export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export function trackEvent(name: TrackedEvent, payload: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || !window.dataLayer) return;
  window.dataLayer.push({ event: name, ...payload });
}

/**
 * Lead'in beklenen değeri, çocuğun giriş yaşına göre.
 * İki yaşında giren çocuk dört yıl kalabilir, beş yaşında giren bir yıl.
 * Değerler yıllık ücret ve %80 yıllık kalma oranı varsayımıyla türetilmiştir.
 */
export const LEAD_VALUE_BY_AGE: Record<string, number> = {
  '2-3': 3500,
  '3-4': 2900,
  '4-5': 2100,
  '5-6': 1200,
};

const FALLBACK_LEAD_VALUE = LEAD_VALUE_BY_AGE['5-6'];

export function leadValue(childAge: string): number {
  return LEAD_VALUE_BY_AGE[childAge] ?? FALLBACK_LEAD_VALUE;
}

/**
 * Form artık yaş grubu sormadığı için `childAge` çoğu çağrıda boştur ve
 * lead değeri FALLBACK_LEAD_VALUE'ya düşer — yani Google Ads'e giden
 * dönüşüm değeri yaşa göre ayrışmaz. Yaş bilinen bir kanaldan gelirse
 * (ör. yaş grubu sayfasına özel bir form) parametre yine geçilebilir.
 */
export function trackLead(childAge?: string, extra: Record<string, unknown> = {}): void {
  trackEvent('lead_submit', {
    ...(childAge ? { child_age: childAge } : {}),
    value: leadValue(childAge ?? ''),
    currency: 'TRY',
    ...extra,
  });
}
