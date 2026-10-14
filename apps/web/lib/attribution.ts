export type Attribution = {
  gclid: string;
  landingPath: string;
};

export const ATTRIBUTION_KEY = 'seker_attr';

const MAX_GCLID = 200;
const MAX_PATH = 200;

export function parseAttribution(search: string, pathname: string): Attribution {
  const params = new URLSearchParams(search);
  return {
    gclid: (params.get('gclid') ?? '').slice(0, MAX_GCLID),
    landingPath: pathname.slice(0, MAX_PATH),
  };
}

/**
 * İlk dokunuşu korur: veli reklamdan /lp/... sayfasına indi, sonra /kayit'e
 * gitti — gclid ilk inişten gelir, ikinci sayfa onu ezmemelidir.
 */
export function persistAttribution(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  next: Attribution,
): Attribution {
  let stored: Attribution | null = null;
  const raw = storage.getItem(ATTRIBUTION_KEY);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Attribution>;
      if (typeof parsed.gclid === 'string' && typeof parsed.landingPath === 'string') {
        stored = { gclid: parsed.gclid, landingPath: parsed.landingPath };
      }
    } catch {
      stored = null;
    }
  }

  if (stored && stored.gclid) return stored;

  const resolved = stored && !next.gclid ? stored : next;
  storage.setItem(ATTRIBUTION_KEY, JSON.stringify(resolved));
  return resolved;
}
