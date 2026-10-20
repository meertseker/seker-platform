import { describe, it, expect } from "vitest";
import { formatNotificationTime, groupNotificationsByDay } from "@/lib/notifications/group";

// 2026-10-20 12:00 İstanbul (UTC+3)
const now = new Date("2026-10-20T09:00:00Z");
const item = (id: string, created_at: string) => ({ id, created_at });

describe("groupNotificationsByDay", () => {
  it("İstanbul takvim gününe göre Bugün / Dün / Daha eski, sıra korunur", () => {
    const items = [
      item("a", "2026-10-20T08:00:00Z"),
      item("b", "2026-10-19T21:30:00Z"), // İstanbul 20 Eki 00:30 → Bugün
      item("c", "2026-10-19T20:59:00Z"), // İstanbul 19 Eki 23:59 → Dün
      item("d", "2026-10-18T21:00:00Z"), // İstanbul 19 Eki 00:00 → Dün
      item("e", "2026-10-18T20:59:59Z"), // İstanbul 18 Eki 23:59 → Daha eski
      item("f", "2025-01-01T10:00:00Z"),
    ];
    expect(groupNotificationsByDay(items, now)).toEqual([
      { label: "Bugün", items: [items[0], items[1]] },
      { label: "Dün", items: [items[2], items[3]] },
      { label: "Daha eski", items: [items[4], items[5]] },
    ]);
  });

  it("boş gruplar düşer", () => {
    const items = [item("x", "2026-10-01T10:00:00Z"), item("y", "2026-10-20T06:00:00Z")];
    expect(groupNotificationsByDay(items, now)).toEqual([
      { label: "Bugün", items: [items[1]] },
      { label: "Daha eski", items: [items[0]] },
    ]);
    expect(groupNotificationsByDay([], now)).toEqual([]);
  });

  it("İstanbul gece yarısından hemen sonra: önceki akşam Dün olur", () => {
    const justAfterMidnight = new Date("2026-10-19T21:05:00Z"); // İstanbul 20 Eki 00:05
    const items = [item("a", "2026-10-19T21:01:00Z"), item("b", "2026-10-19T20:30:00Z")];
    expect(groupNotificationsByDay(items, justAfterMidnight)).toEqual([
      { label: "Bugün", items: [items[0]] },
      { label: "Dün", items: [items[1]] },
    ]);
  });

  it("ay sınırında dün doğru hesaplanır", () => {
    const firstOfMonth = new Date("2026-11-01T09:00:00Z");
    const items = [item("a", "2026-10-31T12:00:00Z"), item("b", "2026-10-30T12:00:00Z")];
    expect(groupNotificationsByDay(items, firstOfMonth).map((g) => g.label)).toEqual(["Dün", "Daha eski"]);
  });

  it("bozuk tarih Daha eski'ye düşer", () => {
    const items = [item("a", "bozuk")];
    expect(groupNotificationsByDay(items, now)).toEqual([{ label: "Daha eski", items }]);
  });
});

describe("formatNotificationTime", () => {
  it("bugün yalnız saat", () => {
    expect(formatNotificationTime("2026-10-20T11:05:00Z", now)).toBe("14:05");
    expect(formatNotificationTime("2026-10-19T21:30:00Z", now)).toBe("00:30");
  });
  it("dün: 'dün SS:DD'", () => {
    expect(formatNotificationTime("2026-10-19T06:12:00Z", now)).toBe("dün 09:12");
    expect(formatNotificationTime("2026-10-19T20:59:00Z", now)).toBe("dün 23:59");
  });
  it("daha eski: gün + kısa ay; başka yılda yıl da", () => {
    expect(formatNotificationTime("2026-10-12T10:00:00Z", now)).toBe("12 Eki");
    expect(formatNotificationTime("2025-10-12T10:00:00Z", now)).toBe("12 Eki 2025");
  });
  it("bozuk tarih boş döner", () => {
    expect(formatNotificationTime("bozuk", now)).toBe("");
  });
});
