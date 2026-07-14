import { describe, it, expect } from "vitest";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";
import { statusVisual, STATUS_BADGE_STYLE } from "@/components/status-badge";

const ALL_STATUSES = Object.keys(LEAD_STATUSES) as LeadStatus[];

describe("statusVisual (durum → renk + ikon + Türkçe etiket eşlemesi)", () => {
  it("8 durumun tamamını kapsar (beklemede dahil)", () => {
    expect(ALL_STATUSES).toHaveLength(8);
    expect(ALL_STATUSES).toContain("beklemede");
    for (const status of ALL_STATUSES) {
      expect(STATUS_BADGE_STYLE[status]).toBeDefined();
    }
  });

  it("her durum için gerçek Türkçe etiketi döndürür (renk tek başına yeterli değil)", () => {
    expect(statusVisual("beklemede").label).toBe("Beklemede");
    expect(statusVisual("kazanildi").label).toBe("Kazanıldı");
    expect(statusVisual("kaybedildi").label).toBe("Kaybedildi");
    for (const status of ALL_STATUSES) {
      expect(statusVisual(status).label).toBe(LEAD_STATUSES[status]);
    }
  });

  it("her durum için boş olmayan bir ikon tanımlar", () => {
    for (const status of ALL_STATUSES) {
      const { icon } = statusVisual(status);
      expect(icon).toBeDefined();
      expect(icon).not.toBeNull();
    }
  });

  it("her durum için token tabanlı zemin/metin sınıfları tanımlar (ham hex yok)", () => {
    for (const status of ALL_STATUSES) {
      const style = STATUS_BADGE_STYLE[status];
      expect(style.bg).toMatch(/^bg-status-[a-z]+-soft$/);
      expect(style.fg).toMatch(/^text-status-[a-z]+$/);
      expect(style.bg).not.toMatch(/#/);
      expect(style.fg).not.toMatch(/#/);
    }
  });
});
