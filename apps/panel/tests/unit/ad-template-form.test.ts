import { describe, it, expect } from "vitest";
import { validateAdTemplate } from "@/lib/ads/ad-template";
import type { AdSetup } from "@/lib/ads/ad-setup";
import { formToTemplateInput, setupCardState, templateUpdatedText } from "@/lib/ads/ad-template-form";

const form = (over: Record<string, string | boolean> = {}): Record<string, string | boolean> => ({
  okulAdres: "  Beykent, Beylikdüzü, İstanbul ",
  lat: "41,0123",
  lng: "28,6401",
  yaricapKm: "8",
  yasMin: "25",
  yasMax: "45",
  testGunlukTl: "200",
  buyutmeGunlukTl: "400",
  haftalikYeniReklam: "4",
  mevcutVelileriHaricTut: true,
  ...over,
});

const setup: AdSetup = {
  testCampaignId: "1",
  testAdsetId: "2",
  scaleCampaignId: "3",
  scaleAdsetId: "4",
  exclusionAudienceId: null,
  createdAt: "2026-10-23T08:00:00.000Z",
  createdBy: "u1",
};

describe("formToTemplateInput", () => {
  it("virgüllü ondalığı noktaya çevirir ve sayıları okur", () => {
    const v = formToTemplateInput(form());
    expect(v).toEqual({
      okulAdres: "Beykent, Beylikdüzü, İstanbul",
      lat: 41.0123,
      lng: 28.6401,
      yaricapKm: 8,
      yasMin: 25,
      yasMax: 45,
      testGunlukTl: 200,
      buyutmeGunlukTl: 400,
      haftalikYeniReklam: 4,
      mevcutVelileriHaricTut: true,
    });
    expect("ok" in validateAdTemplate(v)).toBe(true);
  });

  it("noktalı ondalık da kabul edilir", () => {
    const v = formToTemplateInput(form({ lat: "41.0123", lng: " 28.6401 " }));
    expect(v.lat).toBe(41.0123);
    expect(v.lng).toBe(28.6401);
  });

  it("boş enlem/boylam null olur ve doğrulama reddeder", () => {
    const v = formToTemplateInput(form({ lat: "", lng: "  " }));
    expect(v.lat).toBeNull();
    expect(v.lng).toBeNull();
    expect(validateAdTemplate(v)).toEqual({ error: expect.stringContaining("Okul konumu") });
  });

  it("boş ya da sayı olmayan tam sayı alanı NaN olur (0 değil), doğrulama reddeder", () => {
    const v = formToTemplateInput(form({ testGunlukTl: "", yaricapKm: "sekiz" }));
    expect(Number.isNaN(v.testGunlukTl)).toBe(true);
    expect(Number.isNaN(v.yaricapKm)).toBe(true);
    expect("error" in validateAdTemplate(v)).toBe(true);
  });

  it("binlik ayırıcı noktalı bütçe tam sayıya çevrilir (100.000 → 100000)", () => {
    const v = formToTemplateInput(form({ buyutmeGunlukTl: "1.500", testGunlukTl: "100.000" }));
    expect(v.buyutmeGunlukTl).toBe(1500);
    expect(v.testGunlukTl).toBe(100000);
  });

  it("anahtar alanı boolean ya da metin olabilir", () => {
    expect(formToTemplateInput(form({ mevcutVelileriHaricTut: false })).mevcutVelileriHaricTut).toBe(false);
    expect(formToTemplateInput(form({ mevcutVelileriHaricTut: "true" })).mevcutVelileriHaricTut).toBe(true);
    expect(formToTemplateInput(form({ mevcutVelileriHaricTut: "" })).mevcutVelileriHaricTut).toBe(false);
  });

  it("eksik adres boş metin olur", () => {
    const f = form();
    delete f.okulAdres;
    expect(formToTemplateInput(f).okulAdres).toBe("");
  });
});

describe("setupCardState", () => {
  it("kurulum varsa Hazır, kurma yok", () => {
    expect(setupCardState(setup, true)).toEqual({
      label: "Hazır",
      sub: "Meta'da tek seferlik kuruldu · 2 kampanya",
      canSetup: false,
    });
    expect(setupCardState(setup, false).label).toBe("Hazır");
    expect(setupCardState(setup, false).canSetup).toBe(false);
  });

  it("kurulum yok, canlı yazım açık: Kurulmadı, kurulabilir", () => {
    const s = setupCardState(null, true);
    expect(s.label).toBe("Kurulmadı");
    expect(s.canSetup).toBe(true);
  });

  it("kurulum yok, canlı yazım kapalı: Kurulmadı, kurulamaz, not gösterilir", () => {
    expect(setupCardState(null, false)).toEqual({
      label: "Kurulmadı",
      sub: "Canlı yazım kapalı: yalnız 'Sadece göster' çalışır.",
      canSetup: false,
    });
  });
});

describe("templateUpdatedText", () => {
  it("ad ve İstanbul tarihini yazar", () => {
    expect(templateUpdatedText("Mert Şeker", "2026-10-23T22:30:00.000Z")).toBe("Son değişiklik: Mert Şeker · 24 Ekim");
  });

  it("ad yoksa yalnız tarih; tarih yoksa null", () => {
    expect(templateUpdatedText(null, "2026-10-24T09:00:00.000Z")).toBe("Son değişiklik: 24 Ekim");
    expect(templateUpdatedText("Mert Şeker", null)).toBeNull();
    expect(templateUpdatedText("Mert Şeker", "bozuk")).toBeNull();
  });
});
