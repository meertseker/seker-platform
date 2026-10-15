import { describe, it, expect } from 'vitest';
import { pendingReducer, loadPending, savePending, applyListField, PENDING_STORAGE_KEY } from '../pending';

describe('pendingReducer', () => {
  it('set/drop/clear', () => {
    let s = pendingReducer({}, { type: 'set', key: 'a', value: 'x', baseUpdatedAt: null });
    s = pendingReducer(s, { type: 'set', key: 'b', value: 'y', baseUpdatedAt: 't' });
    expect(Object.keys(s)).toEqual(['a', 'b']);
    s = pendingReducer(s, { type: 'drop', keys: ['a'] });
    expect(Object.keys(s)).toEqual(['b']);
    expect(pendingReducer(s, { type: 'clear' })).toEqual({});
  });
  it('aynı anahtarda ilk baseUpdatedAt korunur', () => {
    let s = pendingReducer({}, { type: 'set', key: 'a', value: '1', baseUpdatedAt: 'ilk' });
    s = pendingReducer(s, { type: 'set', key: 'a', value: '2', baseUpdatedAt: 'ikinci' });
    expect(s.a).toEqual({ value: '2', baseUpdatedAt: 'ilk' });
  });
});

describe('kalıcılık (oturum düşse de kaybolmaz)', () => {
  it('sessionStorage ile gidip gelir', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
    savePending(storage, { a: { value: 'x', baseUpdatedAt: null } });
    expect(mem.has(PENDING_STORAGE_KEY)).toBe(true);
    expect(loadPending(storage)).toEqual({ a: { value: 'x', baseUpdatedAt: null } });
    savePending(storage, {});
    expect(mem.has(PENDING_STORAGE_KEY)).toBe(false);
  });
  it('bozuk veri ve storage yokluğu boş döner', () => {
    expect(loadPending({ getItem: () => '{bozuk' })).toEqual({});
    expect(loadPending(null)).toEqual({});
  });
});

describe('applyListField', () => {
  it('id ile öğenin alanını değiştirir, diğerlerine dokunmaz', () => {
    const list = [{ id: 'a', q: '1' }, { id: 'b', q: '2' }];
    expect(applyListField(list, 'b.q', 'yeni')).toEqual([{ id: 'a', q: '1' }, { id: 'b', q: 'yeni' }]);
    expect(list[1].q).toBe('2');
  });
});
