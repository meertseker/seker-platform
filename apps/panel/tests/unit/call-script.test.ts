import { describe, it, expect } from "vitest";
import { ageFromBirth, slotLabel, suggestSlots } from "@/lib/lead-flow/script";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/lead-flow/business-hours";

const hours = DEFAULT_BUSINESS_HOURS; // Pzt–Cum 08:30–18:00

describe("ageFromBirth (script.ts üzerinden)", () => {
  it("ageFromBirth Mart 2023 doğumluya Kasım 2026'da 3 der", () => {
    expect(ageFromBirth(3, 2023, new Date("2026-11-04T10:00:00+03:00"))).toBe(3);
  });

  it("doğum bilgisi yoksa null", () => {
    expect(ageFromBirth(null, 2023, new Date("2026-11-04T10:00:00+03:00"))).toBeNull();
  });
});

describe("suggestSlots", () => {
  // 2026-11-02 Pazartesi, 2026-11-06 Cuma.
  it("suggestSlots dolu saati atlar", () => {
    const now = new Date("2026-11-02T08:00:00+03:00");
    const slots = suggestSlots([{ scheduled_at: "2026-11-02T07:00:00.000Z" }], now, hours); // 10:00 İstanbul
    expect(slots[0]).toBe("2026-11-02T11:00");
    expect(slots).toEqual(["2026-11-02T11:00", "2026-11-02T16:30", "2026-11-03T10:00"]);
  });

  it("suggestSlots hafta sonunu atlar", () => {
    const now = new Date("2026-11-06T17:00:00+03:00"); // Cuma, son aday 16:30 geçti
    expect(suggestSlots([], now, hours)).toEqual(["2026-11-09T10:00", "2026-11-09T11:00", "2026-11-09T16:30"]);
  });

  it("geçmiş saatleri önermez", () => {
    const now = new Date("2026-11-02T10:30:00+03:00");
    expect(suggestSlots([], now, hours)[0]).toBe("2026-11-02T11:00");
  });

  it("cakisma penceresine uyar", () => {
    const now = new Date("2026-11-02T08:00:00+03:00");
    const existing = [{ scheduled_at: "2026-11-02T10:30:00+03:00" }];
    // 45 dk: 10:00 ve 11:00 30 dk uzakta, ikisi de çakışır.
    expect(suggestSlots(existing, now, hours, 3, 45)[0]).toBe("2026-11-02T16:30");
    // 20 dk: 30 dk uzaktaki saatler serbest.
    expect(suggestSlots(existing, now, hours, 3, 20)).toEqual([
      "2026-11-02T10:00",
      "2026-11-02T11:00",
      "2026-11-02T16:30",
    ]);
    // Pencere sınırı dahil (createAppointment gte/lte ile sayar): tam 30 dk da çakışır.
    expect(suggestSlots(existing, now, hours, 3, 30)[0]).toBe("2026-11-02T16:30");
  });

  it("varsayılan pencere 45 dakikadır", () => {
    const now = new Date("2026-11-02T08:00:00+03:00");
    const existing = [{ scheduled_at: "2026-11-02T10:40:00+03:00" }];
    // 11:00 20 dk, 10:00 40 dk uzakta: ikisi de 45 dk içinde.
    expect(suggestSlots(existing, now, hours)[0]).toBe("2026-11-02T16:30");
  });

  it("yalnız önümüzdeki 5 iş gününe bakar", () => {
    const now = new Date("2026-11-02T08:00:00+03:00");
    expect(suggestSlots([], now, hours, 20)).toHaveLength(15);
    expect(suggestSlots([], now, hours, 20).at(-1)).toBe("2026-11-06T16:30");
  });
});

describe("slotLabel", () => {
  it("bugün, yarın ve gün adı", () => {
    const now = new Date("2026-11-02T08:00:00+03:00"); // Pazartesi
    expect(slotLabel("2026-11-02T16:30", now)).toBe("Bugün 16:30");
    expect(slotLabel("2026-11-03T10:00", now)).toBe("Yarın 10:00");
    expect(slotLabel("2026-11-05T11:00", now)).toBe("Perşembe 11:00");
  });
});
