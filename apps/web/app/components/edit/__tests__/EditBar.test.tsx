import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { ReaderData } from '@/lib/content/types';
import { PENDING_STORAGE_KEY } from '../pending';

vi.mock('../edit.css', () => ({}));
const saveContent = vi.fn();
vi.mock('@/app/actions/content', () => ({ saveContent: (...a: unknown[]) => saveContent(...a) }));
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import EditBar from '../EditBar';

const editor = { id: 'e', name: 'Ö' } as never;
const mkData = (updatedAt: Record<string, string> = { 'hero.title': 't1' }): ReaderData => ({
  values: { 'hero.title': 'Eski' },
  updatedAt,
  meta: { 'hero.title': { label: 'Ana başlık' } } as never,
  editing: true,
  vars: { yilSayisi: '10', kurulusYili: '2016' },
});
const seed = (base: string | null = 't1') =>
  sessionStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify({ 'hero.title': { value: 'Yeni', baseUpdatedAt: base } }));
const bar = (data = mkData()) => render(<EditBar editor={editor} data={data} announcements={[]} />);

beforeEach(() => {
  cleanup();
  sessionStorage.clear();
  saveContent.mockReset();
  refresh.mockReset();
});

describe('EditBar', () => {
  it('başarılı kayıt bekleyenleri temizler', async () => {
    seed();
    saveContent.mockResolvedValue({ ok: true, savedAt: 'x' });
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(screen.getByText(/Yayında/)).toBeInTheDocument());
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });

  it('oturum hatasında bekleyenler saklanır ve yeniden açılışta geri gelir', async () => {
    seed();
    saveContent.mockResolvedValue({ ok: false, error: 'Oturumunuz sona erdi. Panelden tekrar giriş yapın.' });
    const v = bar();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(screen.getByText('Panele git')).toBeInTheDocument());
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('Yeni');
    v.unmount();
    bar();
    expect(screen.getByText('1 kaydedilmemiş değişiklik')).toBeInTheDocument();
  });

  it('çakışmada etiketler gösterilir ve bekleyenler korunur', async () => {
    seed();
    saveContent.mockResolvedValue({ ok: false, error: 'Bu metin siz düzenlerken değişti', conflicts: ['hero.title'] });
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(screen.getByText(/Ana başlık/)).toBeInTheDocument());
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('Yeni');
  });

  it('sunucu eylemi fırlatırsa hata gösterilir ve düğmeler yeniden açılır', async () => {
    seed();
    saveContent.mockRejectedValue(new Error('ağ'));
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(screen.getByText('Kaydedilemedi, tekrar deneyin.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeEnabled();
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('Yeni');
  });

  it('bayat tabanlı bekleyen açılışta tazelenir ve kalıcı uyarı çıkar', async () => {
    seed('eski-taban');
    saveContent.mockResolvedValue({ ok: true, savedAt: 'x' });
    bar(mkData({ 'hero.title': 'taze' }));
    expect(screen.getByText(/başkası değiştirdi: Ana başlık/)).toBeInTheDocument();
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('"baseUpdatedAt":"taze"');
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('Yeni');
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(saveContent).toHaveBeenCalledWith([{ key: 'hero.title', value: 'Yeni', baseUpdatedAt: 'taze' }]));
  });
});
