import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';
import { PHONE_ERROR } from '@/lib/leadSchema';
import { KVKK_CONSENT_LABEL } from '@/content/kvkk';
import { SLOTS } from '@/lib/content/registry';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import LeadForm from '../LeadForm';

const data = () => defaultData(['form.']);

describe('LeadForm etiketleri (form.* slotları)', () => {
  it('data verilmezse ve verilirse varsayılan HTML aynı', () => {
    const bare = render(<LeadForm />).container.innerHTML;
    const withData = render(<LeadForm data={data()} />).container.innerHTML;
    expect(withData).toBe(bare);
    expect(bare).toContain('Numaranızı bırakın, <strong>15 dakika</strong> içinde sizi arayalım.');
  });

  it('etiketler ve düğme slot değerinden gelir', () => {
    const d = data();
    d.values['form.parentName.label'] = 'Veli adı';
    d.values['form.phone.label'] = 'Cep numaranız';
    d.values['form.submit'] = 'Arayın';
    d.values['form.help.emphasis'] = '10 dakika';
    render(<LeadForm data={d} />);
    expect(screen.getByLabelText('Veli adı')).toHaveAttribute('name', 'parentName');
    expect(screen.getByLabelText('Cep numaranız')).toHaveAttribute('name', 'phone');
    expect(screen.getByRole('button', { name: 'Arayın' })).toBeInTheDocument();
    expect(document.body.textContent).toContain('10 dakika');
  });

  it('KVKK onay cümlesi slot değildir ve değiştirilemez', () => {
    expect(Object.keys(SLOTS).filter((k) => k.startsWith('form.kvkk'))).toEqual([]);
    const d = { ...data(), editing: true };
    render(<LeadForm data={d} />);
    const consent = screen.getByRole('checkbox', { name: /Google/ }).closest('label')!;
    expect(consent).toHaveAttribute('data-edit-ignore');
    expect(consent.querySelector('[data-edit-key]')).toBeNull();
    expect(consent.textContent).toContain(KVKK_CONSENT_LABEL.slice("Aydınlatma Metni'ni okudum. ".length));
  });

  it('ziyaretçiye hiçbir düzenleme özniteliği gitmez; düzenleme modunda etiketler işaretlenir', () => {
    expect(render(<LeadForm data={data()} />).container.innerHTML).not.toContain('data-edit-');
    const { container } = render(<LeadForm data={{ ...data(), editing: true }} />);
    for (const key of ['form.parentName.label', 'form.phone.label', 'form.submit', 'form.help.emphasis']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
  });

  it('uzun formda görünen her yazı bir alandan gelir (KVKK cümlesi, ay/semt seçenekleri ve ekran okuyucu etiketleri hariç)', () => {
    const d = { ...sentinelData(['form.']), editing: true };
    const { container } = render(<LeadForm data={d} qualify currentYear={2026} />);
    expect(uncoveredText(container)).toEqual([]);
    expect(container.querySelector('#phone')).toHaveAttribute('placeholder', '⟦form.phone.placeholder⟧');
    expect([...container.querySelectorAll('option[value=""]')].map((o) => o.textContent)).toEqual([
      '⟦form.birth.month⟧', '⟦form.birth.year⟧', '⟦form.district.placeholder⟧',
    ]);
  });

  it('hata yazıları düzenlenebilir; sunucunun bilinmeyen mesajı olduğu gibi kalır', async () => {
    const d = data();
    d.values['form.err.phone'] = 'Numarayı 05 ile yazın';
    d.values['form.tooMany'] = 'Biraz bekleyin';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ ok: false, errors: { phone: [PHONE_ERROR], parentName: ['Başka bir hata'] } }) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ ok: false, message: 'sunucu' }) });
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<LeadForm data={d} />);
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('Numarayı 05 ile yazın')).toBeInTheDocument();
    expect(screen.getByText('Başka bir hata')).toBeInTheDocument();
    expect(screen.getByText('Lütfen işaretli alanları kontrol edin.')).toBeInTheDocument();
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('Biraz bekleyin')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('alan adları ve gizli alanlar değişmedi', () => {
    const { container } = render(<LeadForm data={data()} />);
    expect([...container.querySelectorAll('input')].map((i) => i.getAttribute('name'))).toEqual(
      expect.arrayContaining(['parentName', 'phone', 'kvkkConsent', 'website']),
    );
  });
});
