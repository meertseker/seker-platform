import { describe, it, expect } from "vitest";
import { isAutoApproved, initialOfferStatus } from "@/lib/offer-rules";

describe("teklif kuralları (spec §5.6, §6.2)", () => {
  it("liste fiyatı ve üzeri otomatik onay", () => {
    expect(isAutoApproved(2200000, 2200000)).toBe(true);
    expect(isAutoApproved(2300000, 2200000)).toBe(true);
  });
  it("indirimli teklif onay bekler", () => {
    expect(isAutoApproved(1800000, 2200000)).toBe(false);
    expect(initialOfferStatus(1800000, 2200000)).toBe("onay_bekliyor");
    expect(initialOfferStatus(2200000, 2200000)).toBe("onaylandi");
  });
});
