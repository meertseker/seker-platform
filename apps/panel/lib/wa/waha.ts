/** WAHA (WhatsApp HTTP API) istemcisi. Sunucuda iç ağdaki `waha` konteynerine konuşur. */

export const WAHA_SESSION = "default";

export type WahaStatus =
  | "STOPPED" | "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED"
  | "PASSKEY_REQUIRED" | "PASSKEY_CONFIRMATION_REQUIRED" | "YOK";

export interface WahaConfig {
  url: string;
  apiKey: string;
}

export interface WahaSessionInfo {
  status: WahaStatus;
  me: { id: string; pushName: string | null } | null;
}

export interface WahaGroup {
  id: string;
  name: string;
}

/** WAHA_URL boşsa özellik kapalıdır. */
export function readWahaConfig(): WahaConfig | null {
  const url = process.env.WAHA_URL?.trim();
  const apiKey = process.env.WAHA_API_KEY?.trim();
  if (!url || !apiKey) return null;
  return { url: url.replace(/\/+$/, ""), apiKey };
}

export class WahaError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(cfg: WahaConfig, method: string, path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: {
      "X-Api-Key": cfg.apiKey,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new WahaError(`WAHA ${method} ${path} → ${res.status} ${text.slice(0, 200)}`, res.status);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function getSession(cfg: WahaConfig): Promise<WahaSessionInfo> {
  try {
    const data = await call<{ status: WahaStatus; me?: { id: string; pushName?: string } | null }>(
      cfg, "GET", `/api/sessions/${WAHA_SESSION}`,
    );
    return { status: data.status, me: data.me ? { id: data.me.id, pushName: data.me.pushName ?? null } : null };
  } catch (e) {
    if (e instanceof WahaError && e.status === 404) return { status: "YOK", me: null };
    throw e;
  }
}

/** Oturum yoksa oluşturur, durmuşsa başlatır. */
export async function ensureSessionStarted(cfg: WahaConfig): Promise<WahaSessionInfo> {
  const current = await getSession(cfg);
  if (current.status === "YOK") {
    await call(cfg, "POST", "/api/sessions", { name: WAHA_SESSION, start: true });
  } else if (current.status === "STOPPED") {
    await call(cfg, "POST", `/api/sessions/${WAHA_SESSION}/start`);
  } else if (current.status === "FAILED") {
    await call(cfg, "POST", `/api/sessions/${WAHA_SESSION}/restart`);
  }
  return getSession(cfg);
}

/** QR kodu PNG data URL olarak; QR beklenmiyorsa null. */
export async function getQrDataUrl(cfg: WahaConfig): Promise<string | null> {
  try {
    const data = await call<{ mimetype: string; data: string }>(cfg, "GET", `/api/${WAHA_SESSION}/auth/qr?format=image`);
    return data?.data ? `data:${data.mimetype || "image/png"};base64,${data.data}` : null;
  } catch (e) {
    if (e instanceof WahaError && e.status >= 400 && e.status < 500) return null;
    throw e;
  }
}

export async function logoutSession(cfg: WahaConfig): Promise<void> {
  await call(cfg, "POST", `/api/sessions/${WAHA_SESSION}/logout`);
}

function groupId(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "_serialized" in raw && typeof raw._serialized === "string") return raw._serialized;
  return null;
}

/** Motorlar farklı biçim döner (dizi ya da id → grup sözlüğü); ikisi de okunur. */
export function parseGroups(data: unknown): WahaGroup[] {
  const list = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data) : [];
  const groups: WahaGroup[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const g = entry as Record<string, unknown>;
    const id = groupId(g.id) ?? groupId(g.JID) ?? groupId(g.jid);
    if (!id || !id.endsWith("@g.us")) continue;
    const name = [g.subject, g.name, g.Name, g.Subject].find((v): v is string => typeof v === "string" && v.trim() !== "");
    groups.push({ id, name: name ?? id });
  }
  return groups.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export async function listGroups(cfg: WahaConfig): Promise<WahaGroup[]> {
  const data = await call<unknown>(cfg, "GET", `/api/${WAHA_SESSION}/groups?exclude=participants`, undefined, 30_000);
  return parseGroups(data);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mesajı insan gibi gönderir: kısa bir "yazıyor…" sonrasında metin. */
export async function sendText(cfg: WahaConfig, chatId: string, text: string): Promise<void> {
  const typingMs = Math.min(4000, 1000 + text.length * 15);
  try {
    await call(cfg, "POST", "/api/startTyping", { session: WAHA_SESSION, chatId });
    await sleep(typingMs);
    await call(cfg, "POST", "/api/stopTyping", { session: WAHA_SESSION, chatId });
  } catch {
    // Yazıyor göstergesi süs; başarısız olsa da mesaj gitmeli.
  }
  await call(cfg, "POST", "/api/sendText", { session: WAHA_SESSION, chatId, text, linkPreview: false }, 30_000);
}
