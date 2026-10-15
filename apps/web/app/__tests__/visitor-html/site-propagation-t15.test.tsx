import { vi, describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import KayitView from '@/app/(site)/kayit/KayitView';
import BultenlerView from '@/app/(site)/bultenler/BultenlerView';
import TesekkurlerView from '@/app/(site)/tesekkurler/TesekkurlerView';
import YorumlarView from '@/app/(site)/veli-yorumlari/YorumlarView';
import SSS from '@/app/(site)/sss/SSS';
import { defaultData } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// F2-T12a: tel:, wa.me, mailto ve harita bağlantıları site.* alanlarından gelir; SITE sabitinden değil.
const NEW_PHONE = '0532 111 22 33';
const cases: [string, (d: ReturnType<typeof defaultData>) => React.ReactElement, string[]][] = [
  ['kayit', (d) => <KayitView data={d} />, ['kayit.', 'form.']],
  ['bultenler', (d) => <BultenlerView data={d} />, ['bultenler.', 'media.']],
  ['tesekkurler', (d) => <TesekkurlerView data={d} />, ['tesekkurler.']],
  ['sss', (d) => <SSS data={d} />, ['sss.', 'faq.']],
];

describe('site.* alanları bu sayfalardaki bağlantılara yayılır', () => {
  it.each(cases)('%s: telefon ve WhatsApp', (_name, view, prefixes) => {
    const d = defaultData(prefixes);
    d.values['site.phone'] = NEW_PHONE;
    d.values['site.whatsappMessage'] = 'Merhaba test';
    const { container } = render(view(d));
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs).toContain('tel:+905321112233');
    expect(hrefs.some((h) => h.includes('905301018875'))).toBe(false);
    expect(container.textContent).toContain(NEW_PHONE);
    if (_name !== 'sss') expect(hrefs).toContain('https://wa.me/905321112233?text=Merhaba%20test');
  });

  it('sss: e-posta bağlantısı', () => {
    const d = defaultData(['sss.', 'faq.']);
    d.values['site.email'] = 'yeni@example.com';
    const { container } = render(<SSS data={d} />);
    expect(container.querySelector('a[href="mailto:yeni@example.com"]')).not.toBeNull();
  });

  it('yorumlar: Google yorum bağlantısı adresten üretilir', () => {
    const d = defaultData(['yorumlar.', 'testimonials.']);
    d.values['site.address.street'] = 'Yeni Sokak No:1';
    const { container } = render(<YorumlarView data={d} />);
    const href = container.querySelector('a[target="_blank"]')!.getAttribute('href')!;
    expect(decodeURIComponent(href)).toContain('Yeni Sokak No:1');
  });
});
