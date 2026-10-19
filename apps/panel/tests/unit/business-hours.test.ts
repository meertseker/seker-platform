import { describe, it, expect } from "vitest";
import {
  DEFAULT_BUSINESS_HOURS,
  clockStart,
  nextBusinessMoment,
  elapsedMinutes,
  timerTone,
  istanbulAt,
} from "@/lib/lead-flow/business-hours";

const H = DEFAULT_BUSINESS_HOURS;

describe("business-hours", () => {
  it("mesai içindeki form hemen başlar", () => {
    const t = istanbulAt("2026-11-03", "10:12");
    expect(clockStart(t, H).toISOString()).toBe(t.toISOString());
  });
  it("akşam gelen form ertesi sabah başlar", () => {
    const t = istanbulAt("2026-11-03", "22:40");
    expect(clockStart(t, H).toISOString()).toBe(istanbulAt("2026-11-04", "08:30").toISOString());
  });
  it("cuma akşamı gelen form pazartesi başlar", () => {
    const t = istanbulAt("2026-11-06", "18:05");
    expect(clockStart(t, H).toISOString()).toBe(istanbulAt("2026-11-09", "08:30").toISOString());
  });
  it("sabah erken gelen form aynı gün açılışta başlar", () => {
    const t = istanbulAt("2026-11-03", "07:00");
    expect(nextBusinessMoment(t, H).toISOString()).toBe(istanbulAt("2026-11-03", "08:30").toISOString());
  });
  it("tam kapanış anı mesai dışıdır", () => {
    const t = istanbulAt("2026-11-03", "18:00");
    expect(nextBusinessMoment(t, H).toISOString()).toBe(istanbulAt("2026-11-04", "08:30").toISOString());
  });
  it("hafta sonu pazartesiye kayar", () => {
    const t = istanbulAt("2026-11-07", "11:00");
    expect(nextBusinessMoment(t, H).toISOString()).toBe(istanbulAt("2026-11-09", "08:30").toISOString());
  });
  it("istanbulAt +03:00 üretir", () => {
    expect(istanbulAt("2026-11-04", "10:00").toISOString()).toBe("2026-11-04T07:00:00.000Z");
  });
  it("timerTone sınırları", () => {
    expect(timerTone(5)).toBe("ok");
    expect(timerTone(6)).toBe("warn");
    expect(timerTone(15)).toBe("warn");
    expect(timerTone(16)).toBe("late");
  });
  it("başlangıç gelecekteyse geçen süre 0", () => {
    expect(elapsedMinutes(istanbulAt("2026-11-04", "08:30"), istanbulAt("2026-11-03", "23:00"))).toBe(0);
  });
  it("geçen süre tam dakikaya yuvarlanır (aşağı)", () => {
    const s = istanbulAt("2026-11-03", "10:00");
    expect(elapsedMinutes(s, new Date(s.getTime() + 7 * 60000 + 59000))).toBe(7);
  });
});

import { formatDayTime, parseIstanbulDateTime } from "@/lib/lead-flow/business-hours";

describe("parseIstanbulDateTime / formatDayTime", () => {
  it("yerel saati İstanbul (+03:00) olarak okur", () => {
    expect(parseIstanbulDateTime("2026-11-05T10:00")?.toISOString()).toBe("2026-11-05T07:00:00.000Z");
    expect(parseIstanbulDateTime("2026-11-05T10:00:30")?.toISOString()).toBe("2026-11-05T07:00:30.000Z");
  });
  it("saat dilimli ISO'yu olduğu gibi çözer, geçersizde null", () => {
    expect(parseIstanbulDateTime("2026-11-05T07:00:00Z")?.toISOString()).toBe("2026-11-05T07:00:00.000Z");
    expect(parseIstanbulDateTime("yarın")).toBeNull();
  });
  it("gün saat biçimi", () => {
    expect(formatDayTime(new Date("2026-11-04T07:00:00Z"))).toBe("Çarşamba 4 Kasım 10:00");
  });
});

import { businessMinutesBetween } from "@/lib/lead-flow/business-hours";

describe("businessMinutesBetween (R14)", () => {
  const H = { days: [1, 2, 3, 4, 5], start: "08:30", end: "18:00" };
  const at = (s: string) => new Date(`${s}+03:00`);

  it("Salı 17:55 → 18:30 = 5, Çarşamba 08:40 = 15", () => {
    expect(businessMinutesBetween(at("2026-10-20T17:55:00"), at("2026-10-20T18:30:00"), H)).toBe(5);
    expect(businessMinutesBetween(at("2026-10-20T17:55:00"), at("2026-10-21T08:40:00"), H)).toBe(15);
  });

  it("Cuma 17:50 → Pazartesi 08:35 = 15", () => {
    expect(businessMinutesBetween(at("2026-10-23T17:50:00"), at("2026-10-26T08:35:00"), H)).toBe(15);
  });

  it("mesai içinde düz fark", () => {
    expect(businessMinutesBetween(at("2026-10-20T10:03:00"), at("2026-10-20T10:20:30"), H)).toBe(17);
  });

  it("22:40 gelen form ertesi gün 08:30'da hâlâ 0", () => {
    expect(businessMinutesBetween(at("2026-10-19T22:40:00"), at("2026-10-20T08:30:00"), H)).toBe(0);
    expect(businessMinutesBetween(at("2026-10-19T22:40:00"), at("2026-10-20T08:31:00"), H)).toBe(1);
  });

  it("ters sırada 0", () => {
    expect(businessMinutesBetween(at("2026-10-20T11:00:00"), at("2026-10-20T10:00:00"), H)).toBe(0);
  });
});
