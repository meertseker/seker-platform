import { describe, it, expect } from "vitest";
import { applyPaymentDay, inferPaymentDay, paymentDayLabel } from "@/lib/payment-day";

describe("applyPaymentDay", () => {
  it("vadeyi aynı ayda verilen güne taşır", () => {
    expect(applyPaymentDay("2026-10-05", 16)).toBe("2026-10-16");
    expect(applyPaymentDay("2026-10-31", 5)).toBe("2026-10-05");
  });

  it("ay sonu ve kısa aylar", () => {
    expect(applyPaymentDay("2027-02-05", "son")).toBe("2027-02-28");
    expect(applyPaymentDay("2026-11-05", 31)).toBe("2026-11-30");
    expect(applyPaymentDay("2026-12-05", "son")).toBe("2026-12-31");
  });
});

describe("inferPaymentDay", () => {
  it("hepsi ayın son günüyse ay sonu", () => {
    expect(inferPaymentDay(["2026-10-31", "2026-11-30", "2027-02-28"])).toBe("son");
  });

  it("aksi hâlde en sık gün", () => {
    expect(inferPaymentDay(["2026-10-16", "2026-11-16", "2026-12-05"])).toBe(16);
  });

  it("vade yoksa null", () => {
    expect(inferPaymentDay([])).toBeNull();
  });
});

describe("paymentDayLabel", () => {
  it("okunur ad", () => {
    expect(paymentDayLabel("son")).toBe("Ay sonu");
    expect(paymentDayLabel(16)).toBe("Her ayın 16. günü");
    expect(paymentDayLabel(null)).toBe("Belirtilmedi");
  });
});
