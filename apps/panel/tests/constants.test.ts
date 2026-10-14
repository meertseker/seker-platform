import { describe, it, expect } from "vitest";
import {
  APPOINTMENT_TYPES, LEAD_SOURCES, LEAD_STATUSES,
  INSTALLMENT_STATUSES, DISCOUNT_TYPES, label,
} from "@/lib/constants";

describe("0003 domain uyum sabitleri", () => {
  it("randevu tipleri demo ve oryantasyon içerir", () => {
    expect(APPOINTMENT_TYPES.demo).toBe("Demo Dersi");
    expect(APPOINTMENT_TYPES.oryantasyon).toBe("Oryantasyon");
  });
  it("kaynak etkinlik içerir", () => {
    expect(LEAD_SOURCES.etkinlik).toBe("Etkinlik");
  });
  it("lead durumu beklemede içerir", () => {
    expect(LEAD_STATUSES.beklemede).toBe("Beklemede");
  });
  it("taksit ve indirim tipleri tanımlı", () => {
    expect(INSTALLMENT_STATUSES.iptal).toBe("İptal");
    expect(DISCOUNT_TYPES.yuzde_10).toBe("%10 Kardeş");
  });
  it("label bilinmeyen değeri aynen döndürür", () => {
    expect(label(LEAD_STATUSES, "yok_boyle")).toBe("yok_boyle");
  });
});
