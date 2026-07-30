import { describe, it, expect, beforeEach } from 'vitest';
import { trackEvent } from '../analytics';

describe('trackEvent', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it('olayı dataLayer\'a gönderir', () => {
    trackEvent('lead_submit', { child_age: '3-4' });
    expect(window.dataLayer).toEqual([{ event: 'lead_submit', child_age: '3-4' }]);
  });

  it('payload olmadan çalışır', () => {
    trackEvent('whatsapp_click');
    expect(window.dataLayer).toEqual([{ event: 'whatsapp_click' }]);
  });

  it('dataLayer tanımsızsa hata fırlatmaz', () => {
    delete window.dataLayer;
    expect(() => trackEvent('tel_click')).not.toThrow();
  });
});
