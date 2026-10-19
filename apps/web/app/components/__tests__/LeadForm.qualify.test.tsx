import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const trackLead = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackLead: (...a: unknown[]) => trackLead(...a) }));

import LeadForm from '../LeadForm';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  trackLead.mockReset();
});

describe('LeadForm qualify', () => {
  it('qualify ile 4 nitelik sorusunu gösterir', () => {
    render(<LeadForm qualify currentYear={2026} />);
    expect(screen.getByText('Çocuğunuzun doğum ayı ve yılı')).toBeInTheDocument();
    expect(screen.getByLabelText('Doğum ayı')).toBeInTheDocument();
    const year = screen.getByLabelText('Doğum yılı') as HTMLSelectElement;
    expect([...year.options].map((o) => o.value).filter(Boolean)).toEqual(
      ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'],
    );
    const district = screen.getByLabelText('Oturduğunuz semt') as HTMLSelectElement;
    expect([...district.options].map((o) => o.value)).toContain('Diğer');
    expect(screen.getByText('Ne zaman başlamayı düşünüyorsunuz?')).toBeInTheDocument();
    expect(screen.getByLabelText('Hemen')).toBeInTheDocument();
    expect(screen.getByLabelText('Gelecek eğitim yılı')).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp'tan yazmamızı ister misiniz?")).toBeInTheDocument();
  });

  it('qualify kapalıyken bu alanları göstermez', () => {
    render(<LeadForm />);
    expect(screen.queryByLabelText('Oturduğunuz semt')).toBeNull();
    expect(screen.queryByLabelText('Doğum yılı')).toBeNull();
  });

  it('gönderimde alanları payloada koyar, takip olayına koymaz', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<LeadForm qualify currentYear={2026} />);
    fireEvent.change(screen.getByLabelText('Adınız'), { target: { value: 'Ayşe Yılmaz' } });
    fireEvent.change(screen.getByLabelText('Telefon numaranız'), { target: { value: '05301018875' } });
    fireEvent.change(screen.getByLabelText('Doğum ayı'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Doğum yılı'), { target: { value: '2023' } });
    fireEvent.change(screen.getByLabelText('Oturduğunuz semt'), { target: { value: 'Beykent' } });
    fireEvent.click(screen.getByLabelText('1–3 ay içinde'));
    fireEvent.click(screen.getByLabelText("WhatsApp'tan yazmamızı ister misiniz?"));
    fireEvent.click(screen.getByRole('checkbox', { name: /Google/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Beni Arayın' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      qualify: true,
      childBirthMonth: 5,
      childBirthYear: 2023,
      district: 'Beykent',
      startWindow: '1_3_ay',
      wantsWhatsapp: true,
    });
    await waitFor(() => expect(trackLead).toHaveBeenCalled());
    expect(JSON.stringify(trackLead.mock.calls)).not.toMatch(/Beykent|2023|childBirth|district/);
  });

  it('qualify açıkken alanlar required, kapalıyken yok', () => {
    const { unmount } = render(<LeadForm qualify currentYear={2026} />);
    expect(screen.getByLabelText('Doğum ayı')).toBeRequired();
    expect(screen.getByLabelText('Doğum yılı')).toBeRequired();
    expect(screen.getByLabelText('Oturduğunuz semt')).toBeRequired();
    expect(screen.getByLabelText('Hemen')).toBeRequired();
    unmount();
    const { container } = render(<LeadForm />);
    expect(container.querySelector('select, input[type="radio"]')).toBeNull();
  });

  it('qualify eksikken istemcide durur, fetch çağrılmaz', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<LeadForm qualify currentYear={2026} />);
    fireEvent.click(screen.getByRole('button', { name: 'Beni Arayın' }));
    expect(await screen.findByText('Semtinizi seçin')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
