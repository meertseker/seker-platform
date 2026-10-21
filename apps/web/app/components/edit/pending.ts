export type Pending = Record<string, { value: unknown; baseUpdatedAt: string | null }>;
export type PendingAction =
  | { type: 'set'; key: string; value: unknown; baseUpdatedAt: string | null }
  | { type: 'clear' }
  /** Taslak geri yükleme: taslaktaki değerler eklenir, bu sekmede o sırada yapılmış değişiklikler üstün gelir. */
  | { type: 'merge'; pending: Pending }
  | { type: 'drop'; keys: string[] }
  | { type: 'rebase'; bases: Record<string, string | null> };

export const PENDING_STORAGE_KEY = 'seker-edit-pending';

export function pendingReducer(state: Pending, action: PendingAction): Pending {
  switch (action.type) {
    case 'set':
      return {
        ...state,
        [action.key]: { value: action.value, baseUpdatedAt: state[action.key]?.baseUpdatedAt ?? action.baseUpdatedAt },
      };
    case 'drop':
      return Object.fromEntries(Object.entries(state).filter(([k]) => !action.keys.includes(k)));
    case 'rebase':
      return Object.fromEntries(
        Object.entries(state).map(([k, p]) => [k, k in action.bases ? { ...p, baseUpdatedAt: action.bases[k] } : p]),
      );
    case 'merge':
      return { ...action.pending, ...state };
    case 'clear':
      return {};
  }
}

export function loadPending(storage: Pick<Storage, 'getItem'> | null): Pending {
  try {
    const raw = storage?.getItem(PENDING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Pending) : {};
  } catch {
    return {};
  }
}

export function savePending(storage: Pick<Storage, 'setItem' | 'removeItem'> | null, state: Pending): void {
  try {
    if (!storage) return;
    if (Object.keys(state).length) storage.setItem(PENDING_STORAGE_KEY, JSON.stringify(state));
    else storage.removeItem(PENDING_STORAGE_KEY);
  } catch {
    /* gizli sekme: yalnızca bellekte tutulur */
  }
}

export function applyListField(list: { id: string }[], path: string, value: unknown): { id: string }[] {
  const [id, ...rest] = path.split('.');
  const field = rest.join('.');
  return list.map((item) => (item.id === id ? { ...item, [field]: value } : item));
}
