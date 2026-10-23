import { describe, expect, it } from "vitest";
import { hostOf, publishStateLine, titleMaxFromChecks } from "@/lib/pages/view";

const base = "https://yeni.sekeranaokulu.com";

describe("hostOf", () => {
  it("adresin yalnız host kısmını verir", () => {
    expect(hostOf("https://yeni.sekeranaokulu.com")).toBe("yeni.sekeranaokulu.com");
    expect(hostOf("http://localhost:3000/")).toBe("localhost:3000");
  });
  it("geçersiz adreste şemayı ve sondaki eğik çizgiyi atar", () => {
    expect(hostOf("yeni.sekeranaokulu.com/")).toBe("yeni.sekeranaokulu.com");
  });
});

describe("publishStateLine", () => {
  it("yayındaki sayfa", () => {
    expect(
      publishStateLine({ slug: "ilk-hafta-uyum", status: "yayinda", publishedAt: "2026-10-23T06:42:00Z" }, base),
    ).toBe("Yayında · yeni.sekeranaokulu.com/lp/ilk-hafta-uyum");
  });
  it("arşivdeki sayfa", () => {
    expect(
      publishStateLine({ slug: "ilk-hafta-uyum", status: "arsiv", publishedAt: "2026-10-23T06:42:00Z" }, base),
    ).toBe("Arşivde · adres /lp/az-mevcutlu-anaokulu'ya yönleniyor");
  });
  it("satır yoksa ya da taslaksa", () => {
    expect(publishStateLine(null, base)).toBe("Yayınlanmadı");
    expect(publishStateLine({ slug: null, status: "taslak", publishedAt: null }, base)).toBe("Yayınlanmadı");
  });
});

describe("titleMaxFromChecks", () => {
  it("Başlık kontrolünün sayacından üst sınırı okur", () => {
    expect(
      titleMaxFromChecks([{ label: "Başlık", summary: "x", count: "28 / 30", ok: true, message: "" }]),
    ).toBe(30);
  });
  it("bulunamazsa null", () => {
    expect(titleMaxFromChecks([])).toBeNull();
  });
});
