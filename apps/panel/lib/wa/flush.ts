import { formatGroup, groupItems, type WaContext, type WaGroup, type WaItem } from "./format";
import { chatIdFor } from "./routing";

export interface WaOutboxRow {
  id: string;
  attempts: number;
  createdAt: string;
  /** Kaynağı (olay ya da not) silinmişse null. */
  item: WaItem | null;
}

export interface WaSettings {
  enabled: boolean;
  /** Ana grup (Kayıt Randevuları); bildirimlerin açılabilmesi için şart. */
  groupId: string;
  /** Ödeme ve fatura grubu; boşsa ödeme mesajları da ana gruba gider. */
  finansGroupId?: string;
}

export interface WaStore {
  settings(): Promise<WaSettings>;
  releaseStale(lockedBeforeIso: string): Promise<void>;
  listPending(nowIso: string, limit: number): Promise<WaOutboxRow[]>;
  loadContext(items: WaItem[]): Promise<WaContext>;
  claim(ids: string[]): Promise<string[]>;
  markSent(ids: string[], message: string): Promise<void>;
  markRetry(ids: string[], error: string, attempts: number, availableAtIso: string): Promise<void>;
  markFailed(ids: string[], error: string, attempts: number): Promise<void>;
  markSkipped(ids: string[], reason: string): Promise<void>;
}

export interface WaSender {
  isReady(): Promise<boolean>;
  send(chatId: string, text: string): Promise<void>;
}

export interface FlushOptions {
  now?: Date;
  /** Son işlemden bu kadar geçmeden grup gönderilmez (peş peşe işlemler birleşsin). */
  settleMs?: number;
  /** Bundan eski satırlar gönderilmez; gruba bayat işlem yağmasın. */
  maxAgeMs?: number;
  maxMessages?: number;
  pauseMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface FlushResult {
  disabled?: boolean;
  notReady?: boolean;
  sent: number;
  skipped: number;
  failed: number;
  waiting: number;
}

const STALE_LOCK_MS = 5 * 60_000;

/** Kalıcı hata: tekrar denemek işe yaramaz (yanlış grup, yetki). 429 ve 5xx tekrar denenir. */
function isPermanent(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export async function flushOutbox(
  deps: { store: WaStore; sender: WaSender },
  options: FlushOptions = {},
): Promise<FlushResult> {
  const {
    now = new Date(), settleMs = 15_000, maxAgeMs = 24 * 3600_000, maxMessages = 15,
    pauseMs = 3_000, maxAttempts = 6, sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = options;
  const { store, sender } = deps;
  const result: FlushResult = { sent: 0, skipped: 0, failed: 0, waiting: 0 };

  const settings = await store.settings();
  if (!settings.enabled || !settings.groupId) return { ...result, disabled: true };

  await store.releaseStale(new Date(now.getTime() - STALE_LOCK_MS).toISOString());
  const rows = await store.listPending(now.toISOString(), 300);
  if (rows.length === 0) return result;

  const orphan = rows.filter((r) => !r.item).map((r) => r.id);
  const tooOld = rows
    .filter((r) => r.item && now.getTime() - Date.parse(r.createdAt) > maxAgeMs)
    .map((r) => r.id);
  if (orphan.length) await store.markSkipped(orphan, "kaynak kayıt silinmiş");
  if (tooOld.length) await store.markSkipped(tooOld, "24 saatten eski");
  result.skipped += orphan.length + tooOld.length;

  const skip = new Set([...orphan, ...tooOld]);
  const live = rows.filter((r) => !skip.has(r.id));
  if (live.length === 0) return result;

  const attemptsById = new Map(live.map((r) => [r.id, r.attempts]));
  const items = live.map((r) => r.item as WaItem);
  const ctx = await store.loadContext(items);
  // Önce hedef gruba göre ayır, sonra birleştir: farklı gruplara giden işlemler aynı mesaja girmesin.
  // Ödeme grubu seçili değilse hepsi ana gruba düşer ve davranış eskisiyle aynıdır.
  const byChat = new Map<string, WaItem[]>();
  for (const item of items) {
    const chatId = chatIdFor(item.eventType, settings);
    const list = byChat.get(chatId) ?? [];
    list.push(item);
    byChat.set(chatId, list);
  }
  const groups: Array<WaGroup & { chatId: string }> = [...byChat]
    .flatMap(([chatId, list]) => groupItems(list, ctx).map((g) => ({ ...g, chatId })))
    .sort((a, b) => a.items[0].createdAt.localeCompare(b.items[0].createdAt));

  const ready = groups.filter((g) => now.getTime() - Date.parse(g.lastAt) >= settleMs);
  result.waiting = groups.length - ready.length;
  if (ready.length === 0) return result;

  if (!(await sender.isReady())) return { ...result, notReady: true };

  let sentMessages = 0;
  /** Geçici hata veren gruplar: bu koşuda o gruba başka mesaj denenmez, diğer grup etkilenmez. */
  const blocked = new Set<string>();
  for (const group of ready) {
    if (sentMessages >= maxMessages || blocked.has(group.chatId)) {
      result.waiting += 1;
      continue;
    }
    const ids = group.items.map((i) => i.outboxId);
    const text = formatGroup(group, ctx);
    if (!text) {
      await store.markSkipped(ids, "gösterilecek bilgi yok");
      result.skipped += ids.length;
      continue;
    }
    const claimed = await store.claim(ids);
    if (claimed.length === 0) continue;

    if (sentMessages > 0) await sleep(pauseMs);
    try {
      await sender.send(group.chatId, text);
      await store.markSent(claimed, text);
      result.sent += 1;
      sentMessages += 1;
    } catch (error) {
      const attempts = Math.max(...claimed.map((id) => attemptsById.get(id) ?? 0)) + 1;
      const message = (error as Error).message?.slice(0, 300) ?? "bilinmeyen hata";
      if (isPermanent(error) || attempts >= maxAttempts) {
        await store.markFailed(claimed, message, attempts);
        result.failed += 1;
      } else {
        const backoffMs = Math.min(60, 2 ** attempts) * 60_000;
        await store.markRetry(claimed, message, attempts, new Date(now.getTime() + backoffMs).toISOString());
        result.waiting += 1;
      }
      // Bağlantı gittiyse bu grubun sıradaki mesajlarını da aynı hataya sürüklemeyelim.
      if (!isPermanent(error)) blocked.add(group.chatId);
    }
  }
  return result;
}
