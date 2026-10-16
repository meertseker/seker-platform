import { describe, it, expect } from "vitest";
import { summarizeVisits } from "@/lib/queries/site-visits";

describe("summarizeVisits", () => {
  it("girişleri ziyaret, görüntülemeleri sayfa olarak toplar; iç gezinme kaynak listesine girmez", () => {
    const s = summarizeVisits([
      { path: "/", source: "arama", device: "mobil", pageviews: 10, entrances: 8 },
      { path: "/", source: "google_ads", device: "masaustu", pageviews: 4, entrances: 4 },
      { path: "/lp/kres", source: "google_ads", device: "mobil", pageviews: 6, entrances: 6 },
      { path: "/sss", source: "site_ici", device: "mobil", pageviews: 5, entrances: 0 },
    ]);
    expect(s.visits).toBe(18);
    expect(s.pageViews).toBe(25);
    expect(s.mobileShare).toBeCloseTo(14 / 18);
    expect(s.sources).toEqual([
      { label: "Google Ads reklamı", visits: 10 },
      { label: "Arama motoru (Google vb., ücretsiz)", visits: 8 },
    ]);
    expect(s.pages[0]).toEqual({ path: "/", views: 14, entrances: 12 });
    expect(s.pages.find((p) => p.path === "/sss")).toEqual({ path: "/sss", views: 5, entrances: 0 });
  });

  it("boş veride oran yok", () => {
    expect(summarizeVisits([])).toEqual({ visits: 0, pageViews: 0, mobileShare: null, sources: [], pages: [] });
  });
});
