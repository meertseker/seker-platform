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
