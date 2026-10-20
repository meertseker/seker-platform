import { describe, it, expect, vi, afterEach } from 'vitest';
import { metaPixelId, trackMetaLead } from '../metaPixel';

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as unknown as { fbq?: unknown }).fbq;
});

describe('metaPixelId', () => {
  it('yalnız rakamsa döner, boş ya da bozuksa boş', () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', ' 123456 ');
    expect(metaPixelId()).toBe('123456');
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', 'abc');
    expect(metaPixelId()).toBe('');
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '');
    expect(metaPixelId()).toBe('');
  });
});

describe('trackMetaLead', () => {
  it('fbq yokken hata vermez', () => {
    expect(() => trackMetaLead('e1')).not.toThrow();
  });
  it('fbq varken eventID ile çağırır', () => {
    const fbq = vi.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    trackMetaLead('e1');
    expect(fbq).toHaveBeenCalledWith('track', 'Lead', {}, { eventID: 'e1' });
  });
  it('fbq atarsa dışarı sızdırmaz', () => {
    (window as unknown as { fbq: unknown }).fbq = () => {
      throw new Error('x');
    };
    expect(() => trackMetaLead('e1')).not.toThrow();
  });
});
