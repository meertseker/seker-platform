import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { create, update, del, move } = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), del: vi.fn(), move: vi.fn() }));
vi.mock('@/app/actions/announcements', () => ({
  createAnnouncement: create, updateAnnouncement: update, deleteAnnouncement: del, moveAnnouncement: move,
}));
vi.mock('@/app/actions/media', () => ({ uploadImage: vi.fn() }));

import { AnnouncementDialog } from '../AnnouncementDialog';
import type { AnnouncementRow } from '@/lib/content/types';

const rows: AnnouncementRow[] = [
  { id: 'a1', title: 'Kermes', body: '<p>Cumartesi</p>', imageId: null, startsOn: '2026-10-20', endsOn: null, published: true, sort: -1, updatedAt: 't' },
  { id: 'a2', title: 'Taslak duyuru', body: '<p>x</p>', imageId: null, startsOn: '2026-10-21', endsOn: null, published: false, sort: 0, updatedAt: 't' },
];

beforeEach(() => {
  create.mockReset(); update.mockReset(); del.mockReset(); move.mockReset();
});

describe('AnnouncementDialog', () => {
  it('taslaklar dahil tüm duyuruları listeler', () => {
    render(<AnnouncementDialog announcements={rows} initialId="a1" onClose={() => {}} />);
    expect(screen.getByText('Taslak duyuru')).toBeInTheDocument();
    expect(screen.getByText(/Taslak · 21\.10\.2026/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Başlık/)).toHaveValue('Kermes');
  });

  it('sunucu hatasını role=alert ile gösterir', async () => {
    update.mockResolvedValue({ ok: false, error: 'Bitiş tarihi başlangıçtan önce olamaz.' });
    render(<AnnouncementDialog announcements={rows} initialId="a1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kaydet' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Bitiş tarihi');
    expect(update).toHaveBeenCalledWith('a1', expect.objectContaining({ title: 'Kermes', published: true, endsOn: null }));
  });

  it('silme iki adımlı', () => {
    render(<AnnouncementDialog announcements={rows} initialId="a1" onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sil' }));
    expect(del).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Silmeyi onayla' })).toBeInTheDocument();
  });

  it('yeni duyuru formu boş başlar', () => {
    render(<AnnouncementDialog announcements={[]} initialId="new" onClose={() => {}} />);
    expect(screen.getByLabelText(/Başlık/)).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Sil' })).toBeNull();
  });
});
