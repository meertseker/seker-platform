import { describe, it, expect } from "vitest";
import { attributionLines } from "@/lib/lead-attribution";

const empty = { gclid: null, utm_source: null, utm_medium: null, utm_campaign: null, landing_path: null };

describe("attributionLines", () => {
  it("web dışı lead için boş liste döner", () => {
    expect(attributionLines(empty)).toEqual([]);
  });

  it("reklamdan gelen lead için kampanya, kaynak, sayfa ve Google Ads satırı verir", () => {
    expect(
      attributionLines({
        gclid: "Cj0ABC", utm_source: "google", utm_medium: "cpc",
        utm_campaign: "beylikduzu", landing_path: "/lp/beylikduzu-anaokulu",
      }),
    ).toEqual([
      "Kampanya: beylikduzu",
      "Kaynak: google / cpc",
      "İniş sayfası: /lp/beylikduzu-anaokulu",
      "Google Ads tıklaması (dönüşüm geri bildirilebilir)",
    ]);
  });

  it("yalnız sayfa bilgisi olan organik başvuru", () => {
    expect(attributionLines({ ...empty, landing_path: "/iletisim" })).toEqual(["İniş sayfası: /iletisim"]);
  });
});
