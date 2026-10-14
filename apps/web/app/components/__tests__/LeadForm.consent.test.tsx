import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import LeadForm from '../LeadForm';
import { KVKK_CONSENT_LABEL } from '@/content/kvkk';

describe('LeadForm onay kutusu', () => {
  it('zorunlu ve yeni onay metnini gösterir', () => {
    render(<LeadForm />);
    const box = screen.getByRole('checkbox', { name: /Google/ });
    expect(box).toBeRequired();
    expect(screen.getByRole('link', { name: 'KVKK Aydınlatma Metni' })).toHaveAttribute('href', '/gizlilik');
    expect(document.body.textContent).toContain(
      "KVKK Aydınlatma Metni'ni okudum. " + KVKK_CONSENT_LABEL.slice("Aydınlatma Metni'ni okudum. ".length),
    );
  });
});
