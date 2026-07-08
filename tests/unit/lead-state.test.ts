import { describe, it, expect } from "vitest";
import { canTransition, requiresLostReason } from "@/lib/lead-state";

describe("lead durum makinesi (spec §6.1)", () => {
  it("ileri akış serbest", () => {
    expect(canTransition("yeni", "ulasildi", { converted: false }).ok).toBe(true);
    expect(canTransition("teklif", "kazanildi", { converted: false }).ok).toBe(true);
  });
  it("her aşamadan kaybedildi'ye geçilir ve neden zorunludur", () => {
    expect(canTransition("randevu", "kaybedildi", { converted: false }).ok).toBe(true);
    expect(requiresLostReason("kaybedildi")).toBe(true);
    expect(requiresLostReason("ulasildi")).toBe(false);
  });
  it("geri geçiş serbest", () => {
    expect(canTransition("teklif", "gorusme_yapildi", { converted: false }).ok).toBe(true);
  });
  it("kaybedildi'den yalnızca ulasildi'ya (yeniden aç)", () => {
    expect(canTransition("kaybedildi", "ulasildi", { converted: false }).ok).toBe(true);
    expect(canTransition("kaybedildi", "kazanildi", { converted: false }).ok).toBe(false);
  });
  it("dönüştürülmüş lead kilitli", () => {
    expect(canTransition("kazanildi", "teklif", { converted: true }).ok).toBe(false);
  });
});
