import { describe, it, expect } from 'vitest';
import {
  DRAFT_TTL_MS,
  RESUME_TTL_MS,
  clearResume,
  draftKey,
  listDrafts,
  purgeDrafts,
  readResume,
  removeDraft,
  writeDraft,
  writeResume,
} from '../drafts';
import { classifySaveError } from '../saveErrors';

function memStore() {
  const mem = new Map<string, string>();
  return {
    mem,
    get length() {
      return mem.size;
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
}

const P = { 'hero.title': { value: 'Yeni', baseUpdatedAt: 't1' } };

describe('taslaklar (localStorage, kullanıcı + sayfa)', () => {
  it('yazar, kullanıcıya göre listeler; boş bekleyen anahtarı siler', () => {
    const s = memStore();
    writeDraft(s, 'u1', '/', P, 1000);
    writeDraft(s, 'u2', '/', P, 1000);
    expect(s.mem.has(draftKey('u1', '/'))).toBe(true);
    const list = listDrafts(s, 'u1', 2000);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ path: '/', savedAt: 1000, pending: P, key: draftKey('u1', '/') });
    writeDraft(s, 'u1', '/', {}, 3000);
    expect(s.mem.has(draftKey('u1', '/'))).toBe(false);
    expect(s.mem.has(draftKey('u2', '/'))).toBe(true);
  });

  it('önce bu sayfanın taslağı, sonra en yenisi gelir', () => {
    const s = memStore();
    writeDraft(s, 'u', '/a', P, 1000);
    writeDraft(s, 'u', '/b', P, 3000);
    writeDraft(s, 'u', '/c', P, 2000);
    expect(listDrafts(s, 'u', 4000).map((d) => d.path)).toEqual(['/b', '/c', '/a']);
    expect(listDrafts(s, 'u', 4000, '/a').map((d) => d.path)).toEqual(['/a', '/b', '/c']);
  });

  it('süresi geçen ve bozuk taslaklar temizlenir, listede görünmez', () => {
    const s = memStore();
    writeDraft(s, 'u', '/eski', P, 0);
    writeDraft(s, 'u', '/taze', P, DRAFT_TTL_MS);
    s.setItem(draftKey('u', '/bozuk'), '{bozuk');
    s.setItem('baska-anahtar', 'dokunma');
    const now = DRAFT_TTL_MS + 10;
    expect(listDrafts(s, 'u', now).map((d) => d.path)).toEqual(['/taze']);
    purgeDrafts(s, now);
    expect([...s.mem.keys()].sort()).toEqual(['baska-anahtar', draftKey('u', '/taze')].sort());
    removeDraft(s, draftKey('u', '/taze'));
    expect(listDrafts(s, 'u', now)).toEqual([]);
  });

  it('depo yoksa ya da fırlatırsa sessizce boş döner', () => {
    expect(listDrafts(null, 'u', 0)).toEqual([]);
    const broken = { ...memStore(), setItem: () => { throw new Error('kota'); } };
    expect(() => writeDraft(broken, 'u', '/', P, 0)).not.toThrow();
  });
});

describe('yenileme işareti', () => {
  it('yazılır, okunur, süresi geçince yok sayılır, silinir', () => {
    const s = memStore();
    writeResume(s, { at: 1000, attempts: 1 });
    expect(readResume(s, 2000)).toEqual({ at: 1000, attempts: 1 });
    expect(readResume(s, 1000 + RESUME_TTL_MS + 1)).toBeNull();
    clearResume(s);
    expect(readResume(s, 2000)).toBeNull();
  });
});

describe('classifySaveError', () => {
  it('sunucu eylemi bulunamadı → version', () => {
    const e = new Error('Server Action "400997a0" was not found on the server. \nRead more: …');
    e.name = 'UnrecognizedActionError';
    expect(classifySaveError(e)).toBe('version');
    expect(classifySaveError(new Error('Failed to find Server Action "abc"'))).toBe('version');
    expect(classifySaveError(new Error('An unexpected response was received from the server.'))).toBe('version');
  });
  it('ağ hatası → network', () => {
    expect(classifySaveError(new TypeError('Failed to fetch'))).toBe('network');
    expect(classifySaveError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe('network');
    expect(classifySaveError(new TypeError('Load failed'))).toBe('network');
  });
  it('diğerleri → other', () => {
    expect(classifySaveError(new Error('ağ'))).toBe('other');
    expect(classifySaveError(new TypeError('x is not a function'))).toBe('other');
    expect(classifySaveError(null)).toBe('other');
  });
});
