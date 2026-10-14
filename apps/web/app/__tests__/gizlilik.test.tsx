import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GizlilikPage from '../(site)/gizlilik/page';
import { KVKK_TEXT, KVKK_CONSENT_LABEL, TEYIT_MARKER } from '@/content/kvkk';

const allText = () => JSON.stringify(KVKK_TEXT);

describe('KVKK aydınlatma metni', () => {
  it('yer tutucu metin kalmadı', () => {
    render(<GizlilikPage />);
    expect(screen.queryByText(/hazırlanmaktadır/)).toBeNull();
  });

  it('veri sorumlusunu ve iletişim bilgisini gösterir', () => {
    render(<GizlilikPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('KVKK Aydınlatma Metni');
    expect(screen.getAllByText(/Özel Şeker Anaokulu/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sekerakademi@gmail\.com/).length).toBeGreaterThan(0);
  });

  it('Google ile reklam ölçümü paylaşımını ve yurt dışı aktarımı açıkça söyler', () => {
    expect(allText()).toMatch(/Google/);
    expect(allText()).toMatch(/reklam/);
    expect(allText()).toMatch(/yurt dışı/i);
  });

  it('KVKK md. 11 haklarını listeler', () => {
    const rights = KVKK_TEXT.sections.find((s) => s.id === 'haklar');
    expect(rights?.items?.length).toBeGreaterThanOrEqual(8);
  });

  it('onay kutusu metni aramayı ve Google paylaşımını kapsar', () => {
    expect(KVKK_CONSENT_LABEL).toMatch(/aranma/);
    expect(KVKK_CONSENT_LABEL).toMatch(/Google/);
  });

  it('okuldan teyit bekleyen tam dört işaret var', () => {
    expect(JSON.stringify(KVKK_TEXT).split(TEYIT_MARKER).length - 1).toBe(4);
  });
});
