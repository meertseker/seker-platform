import { vi, describe, it, expect } from 'vitest';

vi.mock('@/lib/content/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/content/server')>();
  return { ...actual, getReaderData: async () => actual.buildReaderData({}, false, 2026) };
});

import { generateMetadata } from '@/app/(site)/iletisim/page';
import { SITE } from '@/lib/site';
import { FULL_DAY_LABEL } from '@/content/program';

describe('/iletisim generateMetadata', () => {
  it('açıklama eski şablon metniyle aynı', async () => {
    const m = await generateMetadata();
    expect(m.description).toBe(
      `Özel Şeker Anaokulu iletişim: ${SITE.address.street}, ${SITE.address.district}. Telefon ${SITE.phone.display}. Hafta içi ${FULL_DAY_LABEL} açığız.`,
    );
    expect(m.title).toBe('İletişim | Özel Şeker Anaokulu');
  });
});
