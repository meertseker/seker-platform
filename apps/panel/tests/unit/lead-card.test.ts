import { describe, it, expect } from "vitest";
import { cardTemplates, suppressCallStep } from "@/lib/lead-flow/card";
import { DEFAULT_TEMPLATES } from "@/lib/lead-flow/settings";
import type { NextStep } from "@/lib/next-step";

const callStep: NextStep = { key: "ilk_arama", title: "İlk aramayı yap", hint: "Veliyi ara", action: "call" };

describe("suppressCallStep", () => {
  it("takip sırası etkinken arama düğmesini kaldırır", () => {
    expect(suppressCallStep(callStep, true)).toEqual({
      ...callStep, action: null, hint: "Takip sırasındaki düğmelerle ara.",
    });
  });
  it("takip sırası etkin değilse ya da adım arama değilse dokunmaz", () => {
    expect(suppressCallStep(callStep, false)).toBe(callStep);
    const offer: NextStep = { ...callStep, action: "offer" };
    expect(suppressCallStep(offer, true)).toBe(offer);
  });
});

const keys = (ctx: Parameters<typeof cardTemplates>[1]) => cardTemplates(DEFAULT_TEMPLATES, ctx).map((t) => t.key);

describe("cardTemplates", () => {
  it("yeni veli: yalnız ulaşamadım ve ziyaret saatleri", () => {
    expect(keys({ status: "yeni", hasPendingAppointment: false })).toEqual(["ulasilamadi", "ziyaret_saatleri"]);
  });
  it("bekleyen randevu varsa randevu onayı eklenir", () => {
    expect(keys({ status: "randevu", hasPendingAppointment: true })).toEqual([
      "ulasilamadi", "ziyaret_saatleri", "randevu_onay",
    ]);
  });
  it("görüşme yapıldıktan sonra ziyaret teşekkürü", () => {
    expect(keys({ status: "gorusme_yapildi", hasPendingAppointment: false })).toContain("ziyaret_tesekkur");
    expect(keys({ status: "teklif", hasPendingAppointment: false })).toContain("ziyaret_tesekkur");
    expect(keys({ status: "kazanildi", hasPendingAppointment: false })).toContain("ziyaret_tesekkur");
    expect(keys({ status: "randevu", hasPendingAppointment: false })).not.toContain("ziyaret_tesekkur");
  });
  it("kontenjan yalnız kaybedilen velide", () => {
    expect(keys({ status: "kaybedildi", hasPendingAppointment: false })).toEqual([
      "ulasilamadi", "ziyaret_saatleri", "kontenjan",
    ]);
    expect(keys({ status: "ulasildi", hasPendingAppointment: false })).not.toContain("kontenjan");
  });
  it("okulun eklediği bilinmeyen şablonlar her zaman görünür", () => {
    const custom = [...DEFAULT_TEMPLATES, { key: "ozel", label: "Özel", text: "x" }];
    expect(cardTemplates(custom, { status: "yeni", hasPendingAppointment: false }).map((t) => t.key)).toContain("ozel");
  });
});
