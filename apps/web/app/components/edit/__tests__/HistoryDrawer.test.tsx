import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const listRevisions = vi.fn();
const revertRevision = vi.fn();
vi.mock('@/app/actions/content', () => ({
  listRevisions: (...a: unknown[]) => listRevisions(...a),
  revertRevision: (...a: unknown[]) => revertRevision(...a),
}));

import { HistoryDrawer } from '../HistoryDrawer';

const row = { id: 'r1', key: 'k', label: 'Başlık', createdAt: '2026-10-14T10:00:00Z', editorName: 'Ayşe', before: 'A', after: 'B' };
const props = () => ({ onClose: vi.fn(), onReverted: vi.fn(), onError: vi.fn() });

beforeEach(() => {
  listRevisions.mockReset();
  revertRevision.mockReset();
});
afterEach(cleanup);

describe('HistoryDrawer', () => {
  it('yükleme hatasında satır içi hata gösterir', async () => {
    listRevisions.mockRejectedValue(new Error('x'));
    render(<HistoryDrawer {...props()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/yüklenemedi/i);
    expect(screen.queryByText('Yükleniyor…')).toBeNull();
  });
  it('oturum düşmüşse bunu söyler, "Henüz değişiklik yok" demez', async () => {
    listRevisions.mockResolvedValue({ ok: false, error: 'Oturumunuz sona erdi. Panelden tekrar giriş yapın.' });
    render(<HistoryDrawer {...props()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Oturumunuz/);
    expect(screen.queryByText('Henüz değişiklik yok.')).toBeNull();
  });
  it('boş liste', async () => {
    listRevisions.mockResolvedValue({ ok: true, rows: [] });
    render(<HistoryDrawer {...props()} />);
    expect(await screen.findByText('Henüz değişiklik yok.')).toBeInTheDocument();
  });
  it('geri alma başarılı: onReverted çağrılır', async () => {
    listRevisions.mockResolvedValue({ ok: true, rows: [row] });
    revertRevision.mockResolvedValue({ ok: true, savedAt: 'x' });
    const p = props();
    render(<HistoryDrawer {...p} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Bu değişikliği geri al' }));
    await waitFor(() => expect(p.onReverted).toHaveBeenCalled());
    expect(revertRevision).toHaveBeenCalledWith('r1');
  });
  it('geri alma hatası satır içi gösterilir', async () => {
    listRevisions.mockResolvedValue({ ok: true, rows: [row] });
    revertRevision.mockResolvedValue({ ok: false, error: 'Geri alınamadı.' });
    const p = props();
    render(<HistoryDrawer {...p} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Bu değişikliği geri al' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Geri alınamadı.');
    expect(p.onError).toHaveBeenCalledWith('Geri alınamadı.');
  });
});
