import { describe, it, expect } from "vitest";
import {
  badgeLabel,
  classifySummaryResponse,
  reconcileOptimistic,
  summaryChanged,
  visibleUnreadCount,
} from "@/lib/notifications/bell-state";

const items = [
  { id: "a", read_at: null },
  { id: "b", read_at: null },
  { id: "c", read_at: "2026-10-20T08:00:00Z" },
];

describe("visibleUnreadCount", () => {
  it("yerelde okunan okunmamışlar düşülür", () => {
    expect(visibleUnreadCount({ unreadCount: 5, items, readIds: new Set(), allRead: false })).toBe(5);
    expect(visibleUnreadCount({ unreadCount: 5, items, readIds: new Set(["a"]), allRead: false })).toBe(4);
  });
  it("zaten okunmuş öğe ya da listede olmayan kimlik sayıyı düşürmez", () => {
    expect(visibleUnreadCount({ unreadCount: 5, items, readIds: new Set(["c", "zzz"]), allRead: false })).toBe(5);
  });
  it("tümü okundu → 0; asla eksiye düşmez", () => {
    expect(visibleUnreadCount({ unreadCount: 5, items, readIds: new Set(), allRead: true })).toBe(0);
    expect(visibleUnreadCount({ unreadCount: 1, items, readIds: new Set(["a", "b"]), allRead: false })).toBe(0);
  });
});

describe("badgeLabel", () => {
  it("99 üstü 99+", () => {
    expect(badgeLabel(0)).toBe("0");
    expect(badgeLabel(7)).toBe("7");
    expect(badgeLabel(99)).toBe("99");
    expect(badgeLabel(100)).toBe("99+");
  });
});

describe("summaryChanged", () => {
  const known = { unread: 3, latestId: "a" };
  it("sayı ya da en yeni kimlik değişince true", () => {
    expect(summaryChanged(known, { unread: 3, latestId: "a" })).toBe(false);
    expect(summaryChanged(known, { unread: 4, latestId: "a" })).toBe(true);
    expect(summaryChanged(known, { unread: 3, latestId: "b" })).toBe(true);
    expect(summaryChanged({ unread: 0, latestId: null }, { unread: 0, latestId: null })).toBe(false);
  });
});

describe("classifySummaryResponse", () => {
  const base = { ok: true, status: 200, type: "basic", redirected: false };
  it("oturum yok işaretleri yoklamayı durdurur", () => {
    expect(classifySummaryResponse({ ...base, ok: false, status: 0, type: "opaqueredirect" })).toBe("stop");
    expect(classifySummaryResponse({ ...base, ok: false, status: 401 })).toBe("stop");
    expect(classifySummaryResponse({ ...base, redirected: true })).toBe("stop");
  });
  it("diğer hatalar yok sayılır, başarılı okunur", () => {
    expect(classifySummaryResponse({ ...base, ok: false, status: 500 })).toBe("ignore");
    expect(classifySummaryResponse(base)).toBe("read");
  });
});

describe("reconcileOptimistic", () => {
  const item = (id: string, read = false) => ({ id, read_at: read ? "2026-10-20T10:00:00Z" : null });

  it("sunucuda hâlâ okunmamış görünen yerel okundular korunur, okunmuş olanlar düşer", () => {
    const next = reconcileOptimistic({
      readIds: new Set(["a", "b", "gone"]),
      allRead: false,
      prevItems: [item("a"), item("b"), item("gone")],
      items: [item("a"), item("b", true)],
      unreadCount: 3,
    });
    expect([...next.readIds]).toEqual(["a"]);
    expect(next.allRead).toBe(false);
  });

  it("tümü okundu, işlem sürerken yenileme gelirse korunur", () => {
    const next = reconcileOptimistic({
      readIds: new Set(),
      allRead: true,
      prevItems: [item("a"), item("b")],
      items: [item("a"), item("b")],
      unreadCount: 2,
    });
    expect(next.allRead).toBe(true);
  });

  it("sunucu 0 okunmamış dediğinde her şey sıfırlanır", () => {
    const next = reconcileOptimistic({
      readIds: new Set(["a"]),
      allRead: true,
      prevItems: [item("a")],
      items: [item("a", true)],
      unreadCount: 0,
    });
    expect(next.allRead).toBe(false);
    expect(next.readIds.size).toBe(0);
  });

  it("tümü okundu sürerken yeni bildirim gelirse yalnız yenisi okunmamış sayılır", () => {
    const next = reconcileOptimistic({
      readIds: new Set(),
      allRead: true,
      prevItems: [item("a"), item("b")],
      items: [item("new"), item("a"), item("b")],
      unreadCount: 3,
    });
    expect(next.allRead).toBe(false);
    expect([...next.readIds].sort()).toEqual(["a", "b"]);
    expect(
      visibleUnreadCount({ unreadCount: 3, items: [item("new"), item("a"), item("b")], ...next }),
    ).toBe(1);
  });
});
