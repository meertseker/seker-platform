import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetweenInclusive,
  formatDayRange,
  isoBounds,
  istanbulDay,
  lastMonths,
  periodQuery,
  resolvePeriod,
  schoolYearStart,
} from "@/lib/report/period";

describe("resolvePeriod", () => {
  it("varsayılan bu ay: ayın 1'i → bugün, önceki dönem geçen ayın aynı günleri", () => {
    const p = resolvePeriod({}, "2026-10-20");
    expect(p.key).toBe("bu-ay");
    expect([p.from, p.to]).toEqual(["2026-10-01", "2026-10-20"]);
    expect([p.prev.from, p.prev.to]).toEqual(["2026-09-01", "2026-09-20"]);
    expect(p.days).toBe(20);
    expect(p.phrase).toBe("1–20 Ekim 2026 arasında");
  });

  it("bu ay, önceki ay kısaysa önceki dönem ay sonunda biter (31 Mart → 1–28 Şubat)", () => {
    const p = resolvePeriod({ donem: "bu-ay" }, "2027-03-31");
    expect([p.prev.from, p.prev.to]).toEqual(["2027-02-01", "2027-02-28"]);
  });

  it("bu ay, Ocak'ta önceki dönem geçen yılın Aralık'ı", () => {
    const p = resolvePeriod({}, "2027-01-05");
    expect([p.prev.from, p.prev.to]).toEqual(["2026-12-01", "2026-12-05"]);
  });

  it("geçen ay tam ay, önceki dönem ondan önceki tam ay", () => {
    const p = resolvePeriod({ donem: "gecen-ay" }, "2026-03-10");
    expect([p.from, p.to]).toEqual(["2026-02-01", "2026-02-28"]);
    expect([p.prev.from, p.prev.to]).toEqual(["2026-01-01", "2026-01-31"]);
    expect(p.label).toBe("Şubat 2026");
    expect(p.phrase).toBe("Şubat 2026 ayında");
  });

  it("eğitim yılı 1 Eylül'den bugüne, önceki dönem bir yıl önceki aynı günler", () => {
    const p = resolvePeriod({ donem: "egitim-yili" }, "2026-10-20");
    expect([p.from, p.to]).toEqual(["2026-09-01", "2026-10-20"]);
    expect([p.prev.from, p.prev.to]).toEqual(["2025-09-01", "2025-10-20"]);
    const spring = resolvePeriod({ donem: "egitim-yili" }, "2027-03-15");
    expect(spring.from).toBe("2026-09-01");
    expect(spring.label).toContain("2026–2027");
  });

  it("eğitim yılı 29 Şubat'ta önceki yılın 28 Şubat'ına düşer", () => {
    const p = resolvePeriod({ donem: "egitim-yili" }, "2028-02-29");
    expect(p.prev.to).toBe("2027-02-28");
  });

  it("özel aralık: ters sıra düzelir, önceki dönem hemen önceki aynı uzunluk", () => {
    const p = resolvePeriod({ donem: "ozel", bas: "2026-10-10", bit: "2026-10-01" }, "2026-10-20");
    expect([p.from, p.to]).toEqual(["2026-10-01", "2026-10-10"]);
    expect(p.days).toBe(10);
    expect([p.prev.from, p.prev.to]).toEqual(["2026-09-21", "2026-09-30"]);
  });

  it("özel aralık bugünden ileri gitmez ve en çok 366 gün", () => {
    const future = resolvePeriod({ donem: "ozel", bas: "2026-10-01", bit: "2027-01-01" }, "2026-10-20");
    expect(future.to).toBe("2026-10-20");
    const long = resolvePeriod({ donem: "ozel", bas: "2020-01-01", bit: "2026-10-20" }, "2026-10-20");
    expect(long.days).toBe(366);
    expect(long.to).toBe("2026-10-20");
  });

  it("geçersiz değerler bu aya düşer", () => {
    expect(resolvePeriod({ donem: "yil" }, "2026-10-20").key).toBe("bu-ay");
    expect(resolvePeriod({ donem: "ozel", bas: "2026-02-30", bit: "x" }, "2026-10-20").key).toBe("bu-ay");
    expect(resolvePeriod({ donem: ["gecen-ay", "bu-ay"] }, "2026-10-20").key).toBe("gecen-ay");
  });
});

describe("tarih yardımcıları", () => {
  it("eğitim yılı başlangıcı Eylül'de döner", () => {
    expect(schoolYearStart("2026-08-31")).toBe("2025-09-01");
    expect(schoolYearStart("2026-09-01")).toBe("2026-09-01");
  });

  it("İstanbul gün sınırları +03:00", () => {
    expect(isoBounds({ from: "2026-10-01", to: "2026-10-31" })).toEqual({
      start: "2026-09-30T21:00:00.000Z",
      end: "2026-10-31T21:00:00.000Z",
    });
    expect(istanbulDay("2026-09-30T21:30:00.000Z")).toBe("2026-10-01");
  });

  it("son 12 ay eskiden yeniye, yıl geçişiyle", () => {
    const months = lastMonths("2026-02-10", 12);
    expect(months[0]).toBe("2025-03");
    expect(months[11]).toBe("2026-02");
    expect(months).toHaveLength(12);
  });

  it("gün aralığı yazımı", () => {
    expect(formatDayRange("2026-10-01", "2026-10-20")).toBe("1–20 Ekim 2026");
    expect(formatDayRange("2026-09-25", "2026-10-02")).toBe("25 Eylül – 2 Ekim 2026");
    expect(formatDayRange("2025-12-25", "2026-01-02")).toBe("25 Aralık 2025 – 2 Ocak 2026");
    expect(daysBetweenInclusive("2026-01-01", "2026-12-31")).toBe(365);
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("URL parametresi: bu ay boş, özel aralık tarihleriyle", () => {
    expect(periodQuery(resolvePeriod({}, "2026-10-20"))).toBe("");
    expect(periodQuery(resolvePeriod({ donem: "gecen-ay" }, "2026-10-20"))).toBe("donem=gecen-ay");
    expect(periodQuery(resolvePeriod({ donem: "ozel", bas: "2026-10-01", bit: "2026-10-05" }, "2026-10-20"))).toBe(
      "donem=ozel&bas=2026-10-01&bit=2026-10-05",
    );
  });
});
