import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import type { ReaderData } from '@/lib/content/types';
import { PENDING_STORAGE_KEY } from '../pending';
import { RESUME_KEY, draftKey, writeDraft } from '../drafts';

vi.mock('../edit.css', () => ({}));
const saveContent = vi.fn();
vi.mock('@/app/actions/content', () => ({ saveContent: (...a: unknown[]) => saveContent(...a) }));
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import EditBar, { REMIND_AFTER_MS } from '../EditBar';

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
  localStorage.clear();
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

  it('Vazgeç yenilemeden önce depoyu temizler (bekleyenler geri gelmez)', () => {
    seed();
    let atReload: string | null | undefined;
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/', reload: () => { atReload = sessionStorage.getItem(PENDING_STORAGE_KEY); } },
    });
    try {
      bar();
      fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
      expect(atReload).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, 'location', original);
    }
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

describe('EditBar (önizleme iframe içinde)', () => {
  it('hiçbir şey yapmaz: yansıtma, depolama yazımı, beforeunload yok', () => {
    seed();
    const before = sessionStorage.getItem(PENDING_STORAGE_KEY);
    const original = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', { configurable: true, value: {} });
    const add = vi.spyOn(window, 'addEventListener');
    document.body.innerHTML = '<h1 data-edit-key="hero.title" data-edit-kind="text">Eski</h1>';
    try {
      const { container } = bar();
      expect(container.innerHTML).toBe('');
      expect(document.querySelector('h1')!.textContent).toBe('Eski');
      expect(document.querySelector('h1')!.getAttribute('data-edit-pending')).toBeNull();
      expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toBe(before);
      expect(add.mock.calls.some(([t]) => t === 'beforeunload')).toBe(false);
      expect(screen.queryByText(/başkası değiştirdi/)).toBeNull();
    } finally {
      add.mockRestore();
      if (original) Object.defineProperty(window, 'top', original);
      else delete (window as unknown as { top?: unknown }).top;
      document.body.innerHTML = '';
    }
  });
});

describe('EditBar (yasal uyarı)', () => {
  const warnData = (): ReaderData => ({
    ...mkData(),
    values: { 'hero.title': 'Eski', 'legal.x': 'Gizli' },
    meta: {
      'hero.title': { label: 'Ana başlık' },
      'legal.x': { label: 'Yasal', warn: 'Yasal metin: değişiklikten önce yöneticiye danışın.' },
    } as never,
  });
  const dbl = (key: string) => {
    document.body.innerHTML =
      '<h1 data-edit-key="hero.title" data-edit-kind="text">Eski</h1><h2 data-edit-key="legal.x" data-edit-kind="text">Gizli</h2>';
    bar(warnData());
    fireEvent.dblClick(document.querySelector(`[data-edit-key="${key}"]`)!);
  };

  it('warn olan alanda çift tıklama uyarıyı gösterir ve düzenleyici yine açılır', () => {
    dbl('legal.x');
    expect(screen.getByText('Yasal metin: değişiklikten önce yöneticiye danışın.')).toBeInTheDocument();
    expect(document.querySelector('[data-edit-key="legal.x"]')!.getAttribute('contenteditable')).not.toBeNull();
    document.body.innerHTML = '';
  });

  it('warn olmayan alanda uyarı çıkmaz', () => {
    dbl('hero.title');
    expect(screen.queryByText(/Yasal metin/)).toBeNull();
    document.body.innerHTML = '';
  });
});

describe('EditBar belirteçli metin düzenleme', () => {
  const tokenData = (): ReaderData => ({
    values: { 'about.lead': '{yilSayisi} yıllık deneyim' },
    updatedAt: { 'about.lead': 't1' },
    meta: { 'about.lead': { label: 'Giriş', kind: 'text' } } as never,
    editing: true,
    vars: { yilSayisi: '10', kurulusYili: '2016' },
  });
  const setup = () => {
    const p = document.createElement('p');
    p.setAttribute('data-edit-key', 'about.lead');
    p.setAttribute('data-edit-kind', 'text');
    p.textContent = '10 yıllık deneyim';
    document.body.append(p);
    bar(tokenData());
    return p;
  };
  afterEach(() => document.querySelectorAll('p[data-edit-key]').forEach((n) => n.remove()));

  it('çift tıkla ve odak kaybı bekleyen değişiklik oluşturmaz', () => {
    const p = setup();
    fireEvent.dblClick(p);
    expect(p.textContent).toBe('{yilSayisi} yıllık deneyim');
    fireEvent.blur(p);
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY) ?? '{}').toBe('{}');
    expect(p.textContent).toBe('10 yıllık deneyim');
  });

  it('belirteçli cümle düzenlenince kayıtlı değer belirteci korur, DOM dolu metni gösterir', async () => {
    const p = setup();
    fireEvent.dblClick(p);
    p.textContent = '{yilSayisi} yıllık güzel deneyim';
    fireEvent.blur(p);
    await waitFor(() => expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('{yilSayisi} yıllık güzel deneyim'));
    expect(p.textContent).toBe('10 yıllık güzel deneyim');
  });
});

describe('EditBar isteğe bağlı alan', () => {
  const optData = (): ReaderData => ({
    values: { 'egitim.sections': [{ id: 'montessori', p4: 'Eski dördüncü paragraf' }] },
    updatedAt: { 'egitim.sections': 't1' },
    meta: {
      'egitim.sections': { label: 'Bölümler', kind: 'list', fields: { p4: { kind: 'text', label: '4. paragraf', optional: true } } },
    } as never,
    editing: true,
    vars: { yilSayisi: '10', kurulusYili: '2016' },
  });
  const setup = (optional: boolean) => {
    const p = document.createElement('p');
    p.setAttribute('data-edit-key', 'egitim.sections');
    p.setAttribute('data-edit-kind', 'text');
    p.setAttribute('data-edit-path', 'montessori.p4');
    if (optional) p.setAttribute('data-edit-optional', '1');
    p.textContent = 'Eski dördüncü paragraf';
    document.body.append(p);
    bar(optData());
    return p;
  };
  afterEach(() => document.querySelectorAll('p[data-edit-key]').forEach((n) => n.remove()));

  it('boşaltılan isteğe bağlı paragraf boş metin olarak bekler; eski metin geri gelmez', async () => {
    const p = setup(true);
    fireEvent.dblClick(p);
    p.textContent = '';
    fireEvent.blur(p);
    await waitFor(() => expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('"p4":""'));
    expect(p.textContent).toBe('');
    expect(screen.queryByText(/boş bırakılamaz/)).toBeNull();
  });

  it('zorunlu alan boşaltılınca eski metin geri gelir ve uyarı çıkar', () => {
    const p = setup(false);
    fireEvent.dblClick(p);
    p.textContent = '';
    fireEvent.blur(p);
    expect(p.textContent).toBe('Eski dördüncü paragraf');
    expect(screen.getByText(/boş bırakılamaz/)).toBeTruthy();
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY) ?? '{}').toBe('{}');
  });
});

/** window.location'ı pathname '/' ile değiştirir; reload çağrıldığı anda depolarda ne olduğunu kaydeder. */
function stubLocation() {
  const original = Object.getOwnPropertyDescriptor(window, 'location');
  const calls: { session: string | null; resume: string | null; local: string | null }[] = [];
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      pathname: '/',
      reload: () =>
        calls.push({
          session: sessionStorage.getItem(PENDING_STORAGE_KEY),
          resume: sessionStorage.getItem(RESUME_KEY),
          local: localStorage.getItem(draftKey('e', '/')),
        }),
    },
  });
  return {
    calls,
    restore: () => {
      if (original) Object.defineProperty(window, 'location', original);
    },
  };
}

function unrecognized() {
  const e = new Error('Server Action "400997a0" was not found on the server.');
  e.name = 'UnrecognizedActionError';
  return e;
}

describe('EditBar sürüm kayması', () => {
  let loc: ReturnType<typeof stubLocation>;
  beforeEach(() => {
    loc = stubLocation();
  });
  afterEach(() => loc.restore());

  it('sunucu eylemi bulunamazsa bekleyenleri saklar, uyarır ve sayfayı yeniler', async () => {
    seed();
    saveContent.mockRejectedValue(unrecognized());
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(screen.getByText('Site güncellendi. Değişiklikleriniz korunarak sayfa yenileniyor…')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Kaydedilemedi, tekrar deneyin.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeDisabled();
    await waitFor(() => expect(loc.calls).toHaveLength(1), { timeout: 3000 });
    expect(loc.calls[0].session).toContain('Yeni');
    expect(loc.calls[0].local).toContain('Yeni');
    expect(JSON.parse(loc.calls[0].resume!)).toMatchObject({ attempts: 1 });
  });

  it('ağ hatasında çevrimdışıysa yenilemez, bekleyenler kalır', async () => {
    seed();
    saveContent.mockRejectedValue(new TypeError('Failed to fetch'));
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      bar();
      fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
      await waitFor(() => expect(screen.getByText(/İnternet bağlantısı yok/)).toBeInTheDocument());
      expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
      expect(screen.getByRole('button', { name: 'Kaydet' })).toBeEnabled();
      expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('Yeni');
    } finally {
      online.mockRestore();
    }
  });

  it('ağ hatası (çevrimiçi) sürüm hatası gibi korunarak yenilenir', async () => {
    seed();
    saveContent.mockRejectedValue(new TypeError('Failed to fetch'));
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(loc.calls).toHaveLength(1), { timeout: 3000 });
    expect(loc.calls[0].local).toContain('Yeni');
  });

  it('yenilemeden sonra bekleyenler geri gelir ve taban değişmediyse kendiliğinden kaydedilir', async () => {
    seed('t1');
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ at: Date.now(), attempts: 1 }));
    saveContent.mockResolvedValue({ ok: true, savedAt: 'x' });
    bar();
    await waitFor(() => expect(saveContent).toHaveBeenCalledWith([{ key: 'hero.title', value: 'Yeni', baseUpdatedAt: 't1' }]));
    await waitFor(() => expect(screen.getByText(/Yayında/)).toBeInTheDocument());
    expect(saveContent).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(draftKey('e', '/'))).toBeNull();
  });

  it("yenilemeden sonra taban değiştiyse kaydetmez, Kaydet'e tekrar basmasını ister", async () => {
    seed('eski-taban');
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ at: Date.now(), attempts: 1 }));
    bar(mkData({ 'hero.title': 'taze' }));
    await waitFor(() => expect(screen.getByText(/Kaydet'e tekrar basın/)).toBeInTheDocument());
    expect(screen.getByText(/başkası değiştirdi/)).toBeInTheDocument();
    expect(saveContent).not.toHaveBeenCalled();
    expect(screen.getByText('1 kaydedilmemiş değişiklik')).toBeInTheDocument();
  });

  it('art arda yenileme sorunu çözmezse döngüye girmez', async () => {
    seed();
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ at: Date.now(), attempts: 2 }));
    saveContent.mockRejectedValue(unrecognized());
    bar();
    await waitFor(() => expect(screen.getByText(/Sunucuya şu an ulaşılamıyor/)).toBeInTheDocument());
    expect(loc.calls).toHaveLength(0);
    expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('Yeni');
  });

  it('çakışma hatası sürüm hatası sayılmaz (yenileme yok)', async () => {
    seed();
    saveContent.mockResolvedValue({ ok: false, error: 'Bu metin siz düzenlerken değişti', conflicts: ['hero.title'] });
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(screen.getByText(/Ana başlık/)).toBeInTheDocument());
    expect(screen.queryByText(/Site güncellendi/)).toBeNull();
    expect(loc.calls).toHaveLength(0);
  });
});

describe('EditBar kalıcı taslak', () => {
  let loc: ReturnType<typeof stubLocation>;
  beforeEach(() => {
    loc = stubLocation();
  });
  afterEach(() => loc.restore());
  const draftOf = (value: string) => ({ 'hero.title': { value, baseUpdatedAt: 't1' } });

  it("bekleyenler localStorage'a kullanıcı + sayfa anahtarıyla yazılır, kayıt sonrası silinir", async () => {
    seed();
    saveContent.mockResolvedValue({ ok: true, savedAt: 'x' });
    bar();
    await waitFor(() => expect(localStorage.getItem(draftKey('e', '/'))).toContain('Yeni'));
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(screen.getByText(/Yayında/)).toBeInTheDocument());
    expect(localStorage.getItem(draftKey('e', '/'))).toBeNull();
  });

  it('sekme kapanmışsa açılışta sorar; Geri yükle bekleyenleri getirir', async () => {
    writeDraft(localStorage, 'e', '/', draftOf('Taslak'), Date.now());
    bar();
    expect(screen.getByRole('dialog', { name: 'Kaydedilmemiş değişiklikler' })).toHaveTextContent('Kaydedilmemiş 1 değişiklik bulundu');
    expect(screen.getByText('Değişiklik yok')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Geri yükle' }));
    expect(screen.getByText('1 kaydedilmemiş değişiklik')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('Taslak'));
    expect(localStorage.getItem(draftKey('e', '/'))).toContain('Taslak');
  });

  it('geri yüklenen taslağın tabanı bayatsa uyarılır ve taban tazelenir', async () => {
    writeDraft(localStorage, 'e', '/', { 'hero.title': { value: 'Taslak', baseUpdatedAt: 'eski' } }, Date.now());
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'Geri yükle' }));
    expect(screen.getByText(/başkası değiştirdi: Ana başlık/)).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem(PENDING_STORAGE_KEY)).toContain('"baseUpdatedAt":"t1"'));
  });

  it('At taslağı siler; başka kullanıcının taslağı sorulmaz ve silinmez', () => {
    writeDraft(localStorage, 'e', '/hakkimizda', draftOf('Taslak'), Date.now());
    writeDraft(localStorage, 'baskasi', '/', draftOf('Onun'), Date.now());
    bar();
    expect(screen.getByRole('dialog')).toHaveTextContent('/hakkimizda sayfasında');
    fireEvent.click(screen.getByRole('button', { name: 'At' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(draftKey('e', '/hakkimizda'))).toBeNull();
    expect(localStorage.getItem(draftKey('baskasi', '/'))).toContain('Onun');
    expect(screen.getByText('Değişiklik yok')).toBeInTheDocument();
  });

  it('süresi geçmiş taslak sorulmaz ve temizlenir', async () => {
    writeDraft(localStorage, 'e', '/', draftOf('Eski'), Date.now() - 8 * 24 * 60 * 60 * 1000);
    bar();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(localStorage.getItem(draftKey('e', '/'))).toBeNull());
  });

  it('aynı sekmede bekleyen varken soru çıkmaz', () => {
    seed();
    writeDraft(localStorage, 'e', '/baska', draftOf('Taslak'), Date.now());
    bar();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('EditBar hatırlatma', () => {
  afterEach(() => vi.useRealTimers());

  it('5 dakikadan uzun kaydedilmeyen değişiklikte "Kaydetmeyi unutmayın" çıkar', () => {
    vi.useFakeTimers();
    seed();
    bar();
    expect(screen.queryByText('Kaydetmeyi unutmayın')).toBeNull();
    act(() => void vi.advanceTimersByTime(REMIND_AFTER_MS - 1000));
    expect(screen.queryByText('Kaydetmeyi unutmayın')).toBeNull();
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByText('Kaydetmeyi unutmayın')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kaydet' })).toHaveClass('remind');
  });

  it('bekleyen yoksa hatırlatma çıkmaz', () => {
    vi.useFakeTimers();
    bar();
    act(() => void vi.advanceTimersByTime(REMIND_AFTER_MS * 2));
    expect(screen.queryByText('Kaydetmeyi unutmayın')).toBeNull();
  });
});
