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
