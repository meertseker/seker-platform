import { describe, it, expect, vi, beforeEach } from 'vitest';

type Result = { data: unknown; error: { code: string; message: string } | null };
type Call = { table: string; select?: string; eq: [string, unknown][] };

const calls: Call[] = [];
let result: Result = { data: null, error: null };

function builder(table: string) {
  const call: Call = { table, eq: [] };
  calls.push(call);
  const b = {
    select(cols: string) {
      call.select = cols;
      return b;
    },
    eq(col: string, val: unknown) {
      call.eq.push([col, val]);
      return b;
    },
    maybeSingle: async () => result,
  };
  return b;
}

vi.mock('@seker/auth/admin', () => ({ createAdminSupabase: () => ({ from: builder }) }));
vi.mock('next/server', () => ({ connection: vi.fn(async () => undefined) }));
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { cacheLife, cacheTag } from 'next/cache';
import { getPreviewLandingPage, getPublishedLandingPage } from '../db';

const TOKEN = 'A'.repeat(43);

beforeEach(() => {
  calls.length = 0;
  result = { data: null, error: null };
  vi.mocked(cacheLife).mockClear();
  vi.mocked(cacheTag).mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getPublishedLandingPage', () => {
  it('yalnız yayındaki satırı slug ile sorgular ve alanları okur', async () => {
    result = { data: { slug: 'ilk-hafta-uyum', status: 'yayinda', fields: { h1: 'Başlık', bodyBlocks: [] } }, error: null };
    const page = await getPublishedLandingPage('ilk-hafta-uyum');
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('landing_pages');
    expect(calls[0].eq).toContainEqual(['slug', 'ilk-hafta-uyum']);
    expect(calls[0].eq).toContainEqual(['status', 'yayinda']);
    expect(page).toEqual({ slug: 'ilk-hafta-uyum', status: 'yayinda', fields: expect.objectContaining({ h1: 'Başlık' }) });
  });

  it("bulunan sayfa 'hours' profiliyle önbelleğe girer (yenileme kaçarsa en geç bir saat)", async () => {
    result = { data: { slug: 'ilk-hafta-uyum', status: 'yayinda', fields: {} }, error: null };
    await getPublishedLandingPage('ilk-hafta-uyum');
    expect(cacheTag).toHaveBeenCalledWith('lp:ilk-hafta-uyum');
    expect(cacheLife).toHaveBeenCalledTimes(1);
    expect(cacheLife).toHaveBeenCalledWith('hours');
  });

  it("satır yoksa 'minutes' profili", async () => {
    await getPublishedLandingPage('ilk-hafta-uyum');
    expect(cacheLife).toHaveBeenCalledWith('minutes');
  });

  it('satır yoksa null', async () => {
    expect(await getPublishedLandingPage('ilk-hafta-uyum')).toBeNull();
  });

  it('Supabase hata dönerse null ve kodla günlüğe yazar', async () => {
    result = { data: null, error: { code: 'PGRST301', message: 'x' } };
    expect(await getPublishedLandingPage('ilk-hafta-uyum')).toBeNull();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[lp]'), 'PGRST301');
  });

  it('adres kuralına uymayan slug için sorgu yapmaz', async () => {
    expect(await getPublishedLandingPage('Kotu_Slug')).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('getPreviewLandingPage', () => {
  it('kısa ya da bozuk token için sorgu yapmadan null', async () => {
    expect(await getPreviewLandingPage('kisa')).toBeNull();
    expect(await getPreviewLandingPage(`${'A'.repeat(42)}!`)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('token ile sorgular; satır yoksa null', async () => {
    expect(await getPreviewLandingPage(TOKEN)).toBeNull();
    expect(calls[0].table).toBe('landing_pages');
    expect(calls[0].eq).toContainEqual(['preview_token', TOKEN]);
  });

  it('taslakta alanlar içerik kartının page_fields değerinden gelir', async () => {
    result = {
      data: { status: 'taslak', fields: {}, content_items: { page_fields: { baslik: 'Karttaki başlık', alt_baslik: 'Alt' } } },
      error: null,
    };
    const page = await getPreviewLandingPage(TOKEN);
    expect(page?.status).toBe('taslak');
    expect(page?.fields.h1).toBe('Karttaki başlık');
    expect(page?.fields.subhead).toBe('Alt');
  });

  it('yayındaki satırda landing_pages.fields kullanılır', async () => {
    result = {
      data: { status: 'yayinda', fields: { h1: 'Yayındaki başlık' }, content_items: { page_fields: { baslik: 'Karttaki' } } },
      error: null,
    };
    const page = await getPreviewLandingPage(TOKEN);
    expect(page).toEqual({ status: 'yayinda', fields: expect.objectContaining({ h1: 'Yayındaki başlık' }) });
  });

  it('Supabase hatasında null', async () => {
    result = { data: null, error: { code: 'XX', message: 'x' } };
    expect(await getPreviewLandingPage(TOKEN)).toBeNull();
  });
});
