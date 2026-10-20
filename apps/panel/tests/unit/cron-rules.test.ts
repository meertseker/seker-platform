import { describe, it, expect } from "vitest";
import {
  STALE_LEAD_STATUSES,
  dropLeadsWithFutureVisit,
  futureVisitLeadIds,
  staleCutoffIso,
  istanbulDateString,
  isIstanbulMonday,
  overdueTotalKurus,
} from "@/lib/cron-rules";

describe("STALE_LEAD_STATUSES (spec §8.1)", () => {
  it("takipsizlik kuralına giren açık lead durumlarını listeler", () => {
    // randevu da listede: ziyaret sonrası ya da iptal sonrası sessiz kalan veli görünsün (H1/H7).
    expect(STALE_LEAD_STATUSES).toEqual([
      "yeni",
      "ulasildi",
      "randevu",
      "gorusme_yapildi",
      "teklif",
    ]);
  });
});

describe("staleCutoffIso", () => {
  it("gün sayısı kadar geriye giden ISO zaman damgası üretir", () => {
    const now = new Date("2026-07-11T09:00:00.000Z");
    expect(staleCutoffIso(now, 3)).toBe(
      new Date("2026-07-08T09:00:00.000Z").toISOString(),
    );
  });
  it("ISO string girdisini de kabul eder", () => {
    expect(staleCutoffIso("2026-07-11T09:00:00.000Z", 1)).toBe(
      new Date("2026-07-10T09:00:00.000Z").toISOString(),
    );
  });
  it("0 gün verilirse aynı ana denk gelir", () => {
    const now = new Date("2026-07-11T09:00:00.000Z");
    expect(staleCutoffIso(now, 0)).toBe(now.toISOString());
  });
});

describe("istanbulDateString", () => {
  it("İstanbul saatine göre YYYY-MM-DD üretir (UTC gece yarısını geçen saat)", () => {
    // 2026-07-10 23:30 UTC = 2026-07-11 02:30 Europe/Istanbul (+03:00)
    expect(istanbulDateString(new Date("2026-07-10T23:30:00.000Z"))).toBe(
      "2026-07-11",
    );
  });
  it("gün içindeki bir saat için aynı günü döner", () => {
    expect(istanbulDateString(new Date("2026-07-11T10:00:00.000Z"))).toBe(
      "2026-07-11",
    );
  });
});

describe("isIstanbulMonday (spec §8.5)", () => {
  it("İstanbul saatiyle pazartesi olan bir anı doğru tanır", () => {
    // 2026-07-13 Pazartesi, 08:00 İstanbul (05:00 UTC)
    expect(isIstanbulMonday(new Date("2026-07-13T05:00:00.000Z"))).toBe(true);
  });
  it("UTC'de pazar olsa da İstanbul'da pazartesiye geçmişse true döner", () => {
    // 2026-07-12 22:00 UTC = 2026-07-13 01:00 Europe/Istanbul (Pazartesi)
    expect(isIstanbulMonday(new Date("2026-07-12T22:00:00.000Z"))).toBe(true);
  });
  it("salı günü false döner", () => {
    expect(isIstanbulMonday(new Date("2026-07-14T05:00:00.000Z"))).toBe(false);
  });
});

describe("overdueTotalKurus (spec §8.5)", () => {
  it("TL tutarlarını kuruş cinsinden toplar", () => {
    expect(
      overdueTotalKurus([{ amount: 1500.5 }, { amount: 2000 }, { amount: 0.5 }]),
    ).toBe(350100);
  });
  it("boş listede 0 döner", () => {
    expect(overdueTotalKurus([])).toBe(0);
  });
  it("string tutarları da destekler (DB numeric -> string dönüşü)", () => {
    expect(overdueTotalKurus([{ amount: "1200.25" }])).toBe(120025);
  });
});

describe("ileri tarihli ziyareti olan veli takipsiz değildir", () => {
  const now = new Date("2026-11-03T07:00:00Z");

  it("randevu durumundaki veli, bekleyen randevusu ilerideyse listeden düşer", () => {
    const ids = futureVisitLeadIds(
      [
        { lead_id: "L1", scheduled_at: "2026-11-05T07:00:00Z" }, // ileride
        { lead_id: "L2", scheduled_at: "2026-11-01T07:00:00Z" }, // geçmiş, sonuç girilmemiş
        { lead_id: "L3", scheduled_at: "2026-11-03T07:00:00Z" }, // tam şimdi: ileride sayılmaz
      ],
      now,
    );
    expect([...ids]).toEqual(["L1"]);
    const kept = dropLeadsWithFutureVisit(
      [{ id: "L1", status: "randevu" }, { id: "L2", status: "randevu" }, { id: "L4", status: "ulasildi" }],
      ids,
    );
    expect(kept.map((l) => l.id)).toEqual(["L2", "L4"]);
  });

  it("randevu yoksa liste olduğu gibi kalır", () => {
    const leads = [{ id: "L1" }];
    expect(dropLeadsWithFutureVisit(leads, new Set())).toEqual(leads);
  });
});
