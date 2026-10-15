import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import YorumlarView from '@/app/(site)/veli-yorumlari/YorumlarView';
import { defaultData } from '@/lib/content/testing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
// Yayında yorum yokken görünen boş durum.
vi.mock('@/content/testimonials', () => ({ TESTIMONIALS: [], PUBLISHED_TESTIMONIALS: [] }));

describe('yorumlar (boş durum) ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('düzenleme katmanından önceki hâliyle aynı', () => {
    const { container } = render(<YorumlarView data={defaultData(['yorumlar.', 'meta.yorumlar.', 'testimonials.'])} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('düzenleme modunda liste bağlantısı boş durumda da bulunur', () => {
    const data = { ...defaultData(['yorumlar.', 'meta.yorumlar.', 'testimonials.']), editing: true };
    const { container } = render(<YorumlarView data={data} />);
    expect(container.querySelector('[data-edit-list="testimonials.items"]')).not.toBeNull();
  });
  it('ziyaretçi HTML içinde bağlantı yok', () => {
    const { container } = render(<YorumlarView data={defaultData(['yorumlar.', 'meta.yorumlar.', 'testimonials.'])} />);
    expect(container.innerHTML).not.toContain('data-edit-');
  });
});
