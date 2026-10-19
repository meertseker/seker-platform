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
