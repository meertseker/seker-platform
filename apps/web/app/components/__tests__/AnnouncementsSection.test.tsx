import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AnnouncementsSection from '../AnnouncementsSection';
import { makeReader } from '@/lib/content/reader';
import { defaultData } from '@/lib/content/testing';

describe('AnnouncementsSection', () => {
  it('ziyaretçide boşsa hiçbir şey basmaz', () => {
    const { container } = render(<AnnouncementsSection c={makeReader(defaultData(['home.announcements.']))} items={[]} />);
    expect(container.innerHTML).toBe('');
  });
  it('düzenlemede boşsa yönlendirme metni', () => {
    const { container } = render(<AnnouncementsSection c={makeReader({ ...defaultData(['home.announcements.']), editing: true })} items={[]} />);
    expect(container.textContent).toContain('Yeni duyuru');
  });
  it('duyuruyu başlık ve temiz gövdeyle basar, kartı düzenleme için işaretler', () => {
    const { container } = render(
      <AnnouncementsSection
        c={makeReader({ ...defaultData(['home.announcements.']), editing: true })}
        items={[{ id: 'a1', title: 'Kermes', body: '<p>Cumartesi</p>', imageSrc: null, imageAlt: null, startsOn: '2026-10-20', endsOn: null }]}
      />,
    );
    expect(container.querySelector('[data-edit-announcement="a1"] h3')!.textContent).toBe('Kermes');
  });
  it('ziyaretçide kart düzenleme özniteliği taşımaz', () => {
    const { container } = render(
      <AnnouncementsSection
        c={makeReader(defaultData(['home.announcements.']))}
        items={[{ id: 'a1', title: 'Kermes', body: '<p>Cumartesi</p>', imageSrc: null, imageAlt: null, startsOn: '2026-10-20', endsOn: null }]}
      />,
    );
    expect(container.innerHTML).not.toContain('data-edit-');
    expect(container.querySelector('h3')!.textContent).toBe('Kermes');
  });
});
