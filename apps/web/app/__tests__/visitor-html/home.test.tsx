import { vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Anasayfa from '@/app/(site)/Anasayfa';

describe('ana sayfa ziyaretçi HTML', () => {
  it('düzenleme katmanından önceki hâliyle aynı', async () => {
    const { container } = render(await Anasayfa());
    expect(container.innerHTML).toMatchSnapshot();
  });
});
