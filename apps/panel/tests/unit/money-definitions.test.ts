import { describe, expect, it } from "vitest";
import {
  collectedDay,
  collectedKurus,
  fetchCollectedKurus,
  isOverdue,
  istanbulDayStartIso,
  monthDayRange,
  overdueKurus,
  receivableKurus,
  sumKurus,
} from "@/lib/queries/money";

describe("tek tanımlar: tahsilat", () => {
  it("yalnız ödenmiş satır; ödenen tutar (eski kayıtta boşsa tutar)", () => {
    expect(collectedKurus({ status: "odendi", amount: 15000, paid_amount: 14995 })).toBe(1499500);
    expect(collectedKurus({ status: "odendi", amount: "15000", paid_amount: null })).toBe(1500000);
    expect(collectedKurus({ status: "bekliyor", amount: 15000, paid_amount: null })).toBe(0);
    expect(collectedKurus({ status: "iptal", amount: 15000, paid_amount: 15000 })).toBe(0);
  });

  it("tahsilatın günü paid_at'in İstanbul günü", () => {
    expect(collectedDay({ status: "odendi", paid_at: "2026-10-20T21:30:00Z" })).toBe("2026-10-21");
    expect(collectedDay({ status: "odendi", paid_at: "2026-10-20T20:59:59Z" })).toBe("2026-10-20");
    expect(collectedDay({ status: "bekliyor", paid_at: null })).toBeNull();
  });

  it("ay aralığı (yıl dönümü dahil)", () => {
    expect(monthDayRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-11-01" });
    expect(monthDayRange("2026-12-15")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  });

  it("İstanbul gününün başlangıcı UTC", () => {
    expect(istanbulDayStartIso("2026-10-01")).toBe("2026-09-30T21:00:00.000Z");
  });
});

describe("tek tanımlar: alacak", () => {
  it("iptal olmayan satırın tutarı (ödenmişte de taksit tutarı)", () => {
    expect(receivableKurus({ status: "bekliyor", amount: 100 })).toBe(10000);
    expect(receivableKurus({ status: "odendi", amount: 100 })).toBe(10000);
    expect(receivableKurus({ status: "iptal", amount: 100 })).toBe(0);
  });

  it("toplama yardımcısı", () => {
    const rows = [
      { status: "bekliyor", amount: 100 },
      { status: "iptal", amount: 50 },
      { status: "odendi", amount: 25.5 },
    ];
    expect(sumKurus(rows, receivableKurus)).toBe(12550);
  });
});

describe("tek tanımlar: geciken", () => {
  const today = "2026-10-21";
  it("bekliyor ve vadesi bugünden önce, öğrenci aktif", () => {
    expect(isOverdue({ status: "bekliyor", due_date: "2026-10-20" }, today, "aktif")).toBe(true);
    expect(isOverdue({ status: "bekliyor", due_date: "2026-10-21" }, today, "aktif")).toBe(false);
    expect(isOverdue({ status: "odendi", due_date: "2026-09-01" }, today, "aktif")).toBe(false);
    expect(isOverdue({ status: "iptal", due_date: "2026-09-01" }, today, "aktif")).toBe(false);
  });

  it("ayrılan ya da mezun öğrencinin taksiti geciken sayılmaz", () => {
    expect(isOverdue({ status: "bekliyor", due_date: "2026-09-01" }, today, "ayrildi")).toBe(false);
    expect(isOverdue({ status: "bekliyor", due_date: "2026-09-01" }, today, "mezun")).toBe(false);
  });

  it("geciken tutar", () => {
    expect(overdueKurus({ status: "bekliyor", due_date: "2026-09-01", amount: 5 }, today, "aktif")).toBe(500);
    expect(overdueKurus({ status: "bekliyor", due_date: "2026-11-01", amount: 5 }, today, "aktif")).toBe(0);
  });
});

describe("fetchCollectedKurus", () => {
  it("İstanbul gün aralığında ödenmiş satırları toplar", async () => {
    const calls: [string, unknown, unknown?][] = [];
    const rows = [
      { status: "odendi", amount: 100, paid_amount: 90 },
      { status: "odendi", amount: 50, paid_amount: null },
    ];
    const builder = {
      select: (cols: string) => (calls.push(["select", cols]), builder),
      eq: (col: string, value: unknown) => (calls.push(["eq", col, value]), builder),
      gte: (col: string, value: unknown) => (calls.push(["gte", col, value]), builder),
      lt: (col: string, value: unknown) => (calls.push(["lt", col, value]), builder),
      order: () => builder,
      range: () => Promise.resolve({ data: rows, error: null }),
    };
    const db = { from: (table: string) => (calls.push(["from", table]), builder) };
    const result = await fetchCollectedKurus(db as never, "2026-10-01", "2026-11-01");
    expect(result).toEqual({ kurus: 14000, error: false });
    expect(calls).toContainEqual(["eq", "status", "odendi"]);
    expect(calls).toContainEqual(["gte", "paid_at", "2026-09-30T21:00:00.000Z"]);
    expect(calls).toContainEqual(["lt", "paid_at", "2026-10-31T21:00:00.000Z"]);
  });
});
