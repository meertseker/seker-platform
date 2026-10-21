import type { Pending } from './pending';

/**
 * Bekleyenlerin tek kaynağı EditBar'daki reducer durumudur. sessionStorage o sekmenin çalışma kopyasıdır
 * (pending.ts); burası aynı durumun localStorage'daki yedeğidir: sekme kapansa da kaybolmaz.
 * Anahtar kullanıcı + sayfa bazındadır, DRAFT_TTL_MS sonra temizlenir.
 */
export const DRAFT_PREFIX = 'seker-edit-draft:v1:';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Draft = { key: string; path: string; savedAt: number; pending: Pending };
type LocalStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export function draftKey(userId: string, path: string): string {
  return `${DRAFT_PREFIX}${userId}:${path}`;
}

export function writeDraft(store: LocalStore | null, userId: string, path: string, pending: Pending, now: number): void {
  try {
    if (!store) return;
    const key = draftKey(userId, path);
    if (Object.keys(pending).length) store.setItem(key, JSON.stringify({ path, savedAt: now, pending }));
    else store.removeItem(key);
  } catch {
    /* kota dolu ya da depo kapalı: sessionStorage kopyası yine durur */
  }
}

export function removeDraft(store: LocalStore | null, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    /* depo kapalı */
  }
}

function parse(raw: string | null): Omit<Draft, 'key'> | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<Draft> | null;
    if (!d || typeof d !== 'object' || typeof d.savedAt !== 'number' || typeof d.path !== 'string') return null;
    if (!d.pending || typeof d.pending !== 'object' || Array.isArray(d.pending) || !Object.keys(d.pending).length) return null;
    return { path: d.path, savedAt: d.savedAt, pending: d.pending };
  } catch {
    return null;
  }
}

function keys(store: LocalStore): string[] {
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith(DRAFT_PREFIX)) out.push(k);
  }
  return out;
}

/** Süresi geçmiş ya da bozuk taslakları (tüm kullanıcılar için) siler. */
export function purgeDrafts(store: LocalStore | null, now: number): void {
  try {
    if (!store) return;
    for (const k of keys(store)) {
      const d = parse(store.getItem(k));
      if (!d || now - d.savedAt > DRAFT_TTL_MS) store.removeItem(k);
    }
  } catch {
    /* depo kapalı */
  }
}

/** Kullanıcının geçerli taslakları, en yenisi önce; önce bu sayfanınkiler. */
export function listDrafts(store: LocalStore | null, userId: string, now: number, currentPath?: string): Draft[] {
  try {
    if (!store) return [];
    const prefix = `${DRAFT_PREFIX}${userId}:`;
    const out: Draft[] = [];
    for (const k of keys(store)) {
      if (!k.startsWith(prefix)) continue;
      const d = parse(store.getItem(k));
      if (d && now - d.savedAt <= DRAFT_TTL_MS) out.push({ key: k, ...d });
    }
    return out.sort((a, b) => Number(b.path === currentPath) - Number(a.path === currentPath) || b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/**
 * Sürüm kayması yüzünden yapılan otomatik yenilemenin işareti (sessionStorage). Yenilemeden sonra
 * EditBar bunu görünce bekleyenleri geri yüklendi diye bildirir ve mümkünse kendiliğinden kaydeder.
 */
export const RESUME_KEY = 'seker-edit-resume';
export const RESUME_TTL_MS = 10 * 60 * 1000;
/** Bu kadar art arda yenilemeden sonra döngüye girmemek için yenileme durur. */
export const RESUME_MAX_ATTEMPTS = 2;

export type Resume = { at: number; attempts: number };

export function readResume(store: Pick<Storage, 'getItem'> | null, now: number): Resume | null {
  try {
    const raw = store?.getItem(RESUME_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<Resume>;
    if (typeof r?.at !== 'number' || typeof r.attempts !== 'number' || now - r.at > RESUME_TTL_MS) return null;
    return { at: r.at, attempts: r.attempts };
  } catch {
    return null;
  }
}

export function writeResume(store: Pick<Storage, 'setItem'> | null, r: Resume): void {
  try {
    store?.setItem(RESUME_KEY, JSON.stringify(r));
  } catch {
    /* depo kapalı */
  }
}

export function clearResume(store: Pick<Storage, 'removeItem'> | null): void {
  try {
    store?.removeItem(RESUME_KEY);
  } catch {
    /* depo kapalı */
  }
}
