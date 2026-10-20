import { buildFbc } from './metaClick';

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

export type Attribution = {
  gclid: string;
  fbclid: string;
  fbc: string;
  landingPath: string;
  utm: Utm;
};

export const ATTRIBUTION_KEY = 'seker_attr';

const MAX_VALUE = 200;
/** fbclid uzun olabilir; kırpılırsa fbc Meta'da eşleşmez. fbclid ve fbc için ayrı sınır (leadSchema ve create_web_lead ile aynı). */
export const MAX_META_CLICK = 500;

export function parseAttribution(search: string, pathname: string, now: number = Date.now()): Attribution {
  const params = new URLSearchParams(search);
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = (params.get(key) ?? '').trim().slice(0, MAX_VALUE);
    if (value) utm[key] = value;
  }
  const fbclid = (params.get('fbclid') ?? '').trim().slice(0, MAX_META_CLICK);
  return {
    gclid: (params.get('gclid') ?? '').trim().slice(0, MAX_VALUE),
    fbclid,
    fbc: fbclid ? buildFbc(fbclid, now) : '',
    landingPath: pathname.slice(0, MAX_VALUE),
    utm,
  };
}

function hasSignal(a: Attribution): boolean {
  return Boolean(a.gclid) || Boolean(a.fbclid) || Object.keys(a.utm).length > 0;
}

/** gclid ya da UTM: reklam/kampanya işareti. Yalnız fbclid organik Instagram'dır (Meta organik bağlantılara da ekler). */
function hasCampaignSignal(a: Attribution): boolean {
  return Boolean(a.gclid) || Object.keys(a.utm).length > 0;
}

function readStored(raw: string | null): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    if (typeof parsed.gclid !== 'string' || typeof parsed.landingPath !== 'string') return null;
    const utm: Utm = {};
    if (parsed.utm && typeof parsed.utm === 'object') {
      for (const key of UTM_KEYS) {
        const value = (parsed.utm as Record<string, unknown>)[key];
        if (typeof value === 'string' && value) utm[key] = value;
      }
    }
    return {
      gclid: parsed.gclid,
      fbclid: typeof parsed.fbclid === 'string' ? parsed.fbclid : '',
      fbc: typeof parsed.fbc === 'string' ? parsed.fbc : '',
      landingPath: parsed.landingPath,
      utm,
    };
  } catch {
    return null;
  }
}

/**
 * İlk dokunuşu korur: veli reklamdan /lp/... sayfasına indi, sonra /kayit'e
 * gitti — gclid/utm ilk inişten gelir, ikinci sayfa onu ezmemelidir.
 */
export function persistAttribution(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  next: Attribution,
): Attribution {
  const stored = readStored(storage.getItem(ATTRIBUTION_KEY));
  // Yalnız fbclid'li (organik Instagram) ilk dokunuş, sonraki gclid/UTM'li dokunuşa yer açar: Google tıklaması kaybolmasın.
  const organicOnly = stored !== null && !hasCampaignSignal(stored);
  if (stored && hasSignal(stored) && !(organicOnly && hasCampaignSignal(next))) return stored;

  const resolved = stored && !hasSignal(next) ? stored : next;
  storage.setItem(ATTRIBUTION_KEY, JSON.stringify(resolved));
  return resolved;
}
