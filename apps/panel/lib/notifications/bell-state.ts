// Zilin iyimser okunmamış sayısı ve canlı özet karşılaştırması (saf yardımcılar).

export interface BellSummary {
  unread: number;
  latestId: string | null;
}

/** Sunucu sayısından, bu ekranda okundu sayılan okunmamış öğeler düşülür; 0'ın altına inmez. */
export function visibleUnreadCount({
  unreadCount,
  items,
  readIds,
  allRead,
}: {
  unreadCount: number;
  items: { id: string; read_at: string | null }[];
  readIds: ReadonlySet<string>;
  allRead: boolean;
}): number {
  if (allRead) return 0;
  const locallyRead = items.filter((item) => !item.read_at && readIds.has(item.id)).length;
  return Math.max(0, unreadCount - locallyRead);
}

export interface OptimisticRead {
  readIds: ReadonlySet<string>;
  allRead: boolean;
}

/**
 * Sunucudan yeni liste gelince iyimser okundu durumunu uzlaştırır: işlem sürerken gelen
 * yenileme rozeti geri yakmasın. Sunucuda okunmuş görünenler düşer; "tümü okundu"
 * sunucu 0 diyene kadar sürer, ama arada yeni bildirim gelirse yalnız eskiler okundu kalır.
 */
export function reconcileOptimistic({
  readIds,
  allRead,
  prevItems,
  items,
  unreadCount,
}: OptimisticRead & {
  prevItems: { id: string; read_at: string | null }[];
  items: { id: string; read_at: string | null }[];
  unreadCount: number;
}): OptimisticRead {
  if (unreadCount === 0) return { readIds: new Set(), allRead: false };
  const newestChanged = (items[0]?.id ?? null) !== (prevItems[0]?.id ?? null);
  if (allRead && !newestChanged) return { readIds: new Set(), allRead: true };
  const stillUnread = new Set(items.filter((item) => !item.read_at).map((item) => item.id));
  const candidates = allRead
    ? prevItems.filter((item) => !item.read_at).map((item) => item.id)
    : [...readIds];
  return { readIds: new Set(candidates.filter((id) => stillUnread.has(id))), allRead: false };
}

export function badgeLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function summaryChanged(known: BellSummary, next: BellSummary): boolean {
  return known.unread !== next.unread || known.latestId !== next.latestId;
}

/**
 * Özet isteğinin yanıtı: "stop" oturum yok (401 ya da girişe yönlendirme) → yoklama biter;
 * "ignore" geçici hata → değişiklik yok; "read" gövde okunur.
 */
export function classifySummaryResponse(res: {
  ok: boolean;
  status: number;
  type: string;
  redirected: boolean;
}): "stop" | "ignore" | "read" {
  if (res.type === "opaqueredirect" || res.status === 401 || res.redirected) return "stop";
  return res.ok ? "read" : "ignore";
}
