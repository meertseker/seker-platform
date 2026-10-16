import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackEvent, LEAD_VALUE_BY_AGE, leadValue, trackLead } from '../analytics';
import { AGE_GROUPS } from '@/content/ageGroups';

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

  it('GA4 kimliği ve gtag varsa olay GA4 hedefine de gönderilir', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    process.env.NEXT_PUBLIC_GA4_ID = 'G-TEST';
    try {
      trackEvent('tel_click', { location: 'header' });
      expect(gtag).toHaveBeenCalledWith('event', 'tel_click', { location: 'header', send_to: 'G-TEST' });
    } finally {
      delete window.gtag;
      delete process.env.NEXT_PUBLIC_GA4_ID;
    }
  });

  it('GA4 kimliği yoksa gtag çağrılmaz', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    try {
      trackEvent('tel_click');
      expect(gtag).not.toHaveBeenCalled();
    } finally {
      delete window.gtag;
    }
  });

  it('dataLayer tanımsızsa hata fırlatmaz', () => {
    delete window.dataLayer;
    expect(() => trackEvent('tel_click')).not.toThrow();
  });
});

describe('leadValue', () => {
  it('her yaş grubu için değer tanımlı', () => {
    for (const age of AGE_GROUPS) {
      expect(LEAD_VALUE_BY_AGE[age]).toBeGreaterThan(0);
    }
  });

  it('küçük yaş daha değerli — LTV sıralamasını korur', () => {
    expect(LEAD_VALUE_BY_AGE['2-3']).toBeGreaterThan(LEAD_VALUE_BY_AGE['3-4']);
    expect(LEAD_VALUE_BY_AGE['3-4']).toBeGreaterThan(LEAD_VALUE_BY_AGE['4-5']);
    expect(LEAD_VALUE_BY_AGE['4-5']).toBeGreaterThan(LEAD_VALUE_BY_AGE['5-6']);
  });

  it('bilinmeyen yaş için en düşük değeri döner', () => {
    expect(leadValue('9-10')).toBe(LEAD_VALUE_BY_AGE['5-6']);
    expect(leadValue('')).toBe(LEAD_VALUE_BY_AGE['5-6']);
  });
});

describe('trackLead', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it('yaşa göre değerli dönüşüm olayı gönderir', () => {
    trackLead('2-3');
    expect(window.dataLayer).toEqual([
      { event: 'lead_submit', child_age: '2-3', value: LEAD_VALUE_BY_AGE['2-3'], currency: 'TRY' },
    ]);
  });

  it('ek alanları olaya taşır', () => {
    trackLead('4-5', { program: 'tam-gun' });
    expect(window.dataLayer?.[0]).toMatchObject({
      child_age: '4-5', program: 'tam-gun', currency: 'TRY',
    });
  });
});

describe('trackEvent düzenleme modunda', () => {
  it('seker-editing sınıfı varken hiçbir olay göndermez', () => {
    window.dataLayer = [];
    document.body.classList.add('seker-editing');
    try {
      trackEvent('cta_click');
      trackLead('2-3');
      expect(window.dataLayer).toEqual([]);
    } finally {
      document.body.classList.remove('seker-editing');
    }
  });
});
