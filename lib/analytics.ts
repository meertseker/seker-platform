declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

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
