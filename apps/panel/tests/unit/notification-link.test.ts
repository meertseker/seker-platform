import { describe, it, expect } from "vitest";
import { notificationHref } from "@/lib/notifications/link";

const today = "2026-10-20";
const href = (type: string, payload: Record<string, unknown> = {}) => notificationHref({ type, payload }, today);

describe("notificationHref", () => {
  it("sabit hedefler", () => {
    expect(href("geciken_ozet")).toBe("/odemeler/gecikenler");
    expect(href("teklif_onay_bekliyor", { leadId: "L1" })).toBe("/teklifler");
    expect(href("wa_baglanti_koptu")).toBe("/ayarlar#whatsapp");
    expect(href("ads_senkron_hata")).toBe("/pazarlama");
    expect(href("santral_senkron_hata")).toBe("/ayarlar");
  });
  it("randevu_bugun", () => {
    expect(href("randevu_bugun", { tarih: today, leadId: "L1" })).toBe("/bugun#ziyaretler");
    expect(href("randevu_bugun", { tarih: "2026-10-19", leadId: "L1" })).toBe("/leads/L1");
    expect(href("randevu_bugun", { tarih: "2026-10-19" })).toBe("/bildirimler");
  });
  it("geri_bildirim", () => {
    expect(href("geri_bildirim", { feedbackId: "f1" })).toBe("/geri-bildirim#gb-f1");
    expect(href("geri_bildirim")).toBe("/geri-bildirim");
  });
  it("lead türleri", () => {
    for (const t of ["web_basvuru", "veli_bekliyor", "teklifiniz_onaylandi", "teklif_reddedildi", "teklif_revize_edildi", "teklif_karsi_onaylandi", "cevapsiz_arama"]) {
      expect(href(t, { leadId: "L1" })).toBe("/leads/L1");
      expect(href(t)).toBe("/bildirimler");
    }
  });
  it("bilinmeyen tür", () => {
    expect(href("kayit_yenileme", { leadId: "L1" })).toBe("/bildirimler");
  });
});
