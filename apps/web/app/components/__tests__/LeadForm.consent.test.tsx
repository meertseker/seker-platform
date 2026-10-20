import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import LeadForm from '../LeadForm';
import { KVKK_CONSENT_LABEL } from '@/content/kvkk';
import { CONSENT_VERSION } from '@/lib/metaClick';

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

describe('LeadForm Meta alanları', () => {
  function fill() {
    fireEvent.change(document.getElementById('parentName')!, { target: { value: 'Ayşe Yılmaz' } });
    fireEvent.change(document.getElementById('phone')!, { target: { value: '05301018875' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Google/ }));
  }

  it('olay kimliği ve çerez onayı gönderilir', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.setItem('seker_consent_v2', 'granted');
    const { container } = render(<LeadForm />);
    fill();
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.adCookieConsent).toBe(true);
    expect(typeof body.metaEventId).toBe('string');
    expect(body.metaEventId.length).toBeGreaterThan(8);
    // T8b: form, gösterdiği onay metninin sürümünü gönderir (etiketle aynı sabit).
    expect(body.consentVersion).toBe(CONSENT_VERSION);
    expect(body.consentVersion).toBe(1);
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('localStorage hata verse bile başvuru gider (onay yok sayılır)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { container } = render(<LeadForm />);
    fill();
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).adCookieConsent).toBe(false);
    spy.mockRestore();
    vi.unstubAllGlobals();
  });
});
