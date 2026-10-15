import { describe, it, expect, vi, beforeEach } from 'vitest';

const enable = vi.fn();
const disable = vi.fn();
vi.mock('next/headers', () => ({ draftMode: async () => ({ enable, disable, isEnabled: false }) }));
const getEditor = vi.fn();
vi.mock('@seker/auth/editor', () => ({ getEditor: () => getEditor() }));

import { GET as enableGET } from '../enable/route';
import { GET as disableGET } from '../disable/route';

beforeEach(() => {
  enable.mockReset();
  disable.mockReset();
  getEditor.mockReset();
  process.env.PANEL_URL = 'https://panel.sekeranaokulu.com';
});

describe('/api/edit/enable', () => {
  it('editör değilse panel girişine yollar, draft açmaz', async () => {
    getEditor.mockResolvedValue(null);
    const res = await enableGET(new Request('https://sekeranaokulu.com/api/edit/enable?next=/kayit'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://panel.sekeranaokulu.com/login');
    expect(enable).not.toHaveBeenCalled();
  });
  it('editörse draft açar ve güvenli yola yönlendirir', async () => {
    getEditor.mockResolvedValue({ id: 'u1', fullName: 'Ayşe' });
    const res = await enableGET(new Request('https://sekeranaokulu.com/api/edit/enable?next=//evil.com'));
    expect(enable).toHaveBeenCalledOnce();
    expect(res.headers.get('location')).toBe('https://sekeranaokulu.com/');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});

describe('/api/edit/disable', () => {
  it('draft kapatır ve ana sayfaya döner', async () => {
    const res = await disableGET(new Request('https://sekeranaokulu.com/api/edit/disable?next=/kayit'));
    expect(disable).toHaveBeenCalledOnce();
    expect(res.headers.get('location')).toBe('https://sekeranaokulu.com/kayit');
  });
});
