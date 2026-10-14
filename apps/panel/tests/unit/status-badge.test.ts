import { describe, it, expect } from "vitest";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants";
import { BADGE_BASE } from "@/lib/status-styles";
import { statusVisual } from "@/components/status-badge";

const ALL_STATUSES = Object.keys(LEAD_STATUSES) as LeadStatus[];

describe("statusVisual (durum → renk + ikon + Türkçe etiket eşlemesi)", () => {
  it("8 durumun tamamını kapsar (beklemede dahil)", () => {
    expect(ALL_STATUSES).toHaveLength(8);
    expect(ALL_STATUSES).toContain("beklemede");
  });

  it("her durum için gerçek Türkçe etiketi, tanımlı bir ikonu ve rozet sınıfını döndürür", () => {
    for (const status of ALL_STATUSES) {
      const { label, icon, className } = statusVisual(status);

      expect(label).toBe(LEAD_STATUSES[status]);
      expect(label.length).toBeGreaterThan(0);

      expect(icon).toBeDefined();
      expect(icon).not.toBeNull();

      expect(className).toContain(BADGE_BASE);
    }
  });

  it("beklemede/kazanildi/kaybedildi için beklenen Türkçe etiketleri döndürür", () => {
    expect(statusVisual("beklemede").label).toBe("Beklemede");
    expect(statusVisual("kazanildi").label).toBe("Kazanıldı");
    expect(statusVisual("kaybedildi").label).toBe("Kaybedildi");
  });
});
