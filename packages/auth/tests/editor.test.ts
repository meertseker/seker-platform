import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const single = vi.fn();
vi.mock('../src/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));

import { getEditor } from '../src/editor';

beforeEach(() => {
  getUser.mockReset();
  single.mockReset();
});

describe('getEditor', () => {
  it('oturum yoksa null', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getEditor()).toBeNull();
  });
  it('yetkisi kapalıysa null', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    single.mockResolvedValue({ data: { id: 'u', full_name: 'A', is_active: true, can_edit_site: false } });
    expect(await getEditor()).toBeNull();
  });
  it('pasif kullanıcı null', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    single.mockResolvedValue({ data: { id: 'u', full_name: 'A', is_active: false, can_edit_site: true } });
    expect(await getEditor()).toBeNull();
  });
  it('aktif editör', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    single.mockResolvedValue({ data: { id: 'u', full_name: 'Ayşe', is_active: true, can_edit_site: true } });
    expect(await getEditor()).toEqual({ id: 'u', fullName: 'Ayşe' });
  });
});
