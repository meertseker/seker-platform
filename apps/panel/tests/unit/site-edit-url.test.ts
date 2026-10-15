import { describe, it, expect } from "vitest";
import { siteEditUrl } from "@/lib/site-edit-url";

describe("siteEditUrl", () => {
  it("SITE_URL'den düzenleme modunu açan adresi üretir", () => {
    expect(siteEditUrl("https://sekeranaokulu.com")).toBe("https://sekeranaokulu.com/api/edit/enable?next=%2F");
    expect(siteEditUrl("https://sekeranaokulu.com/", "/kayit")).toBe(
      "https://sekeranaokulu.com/api/edit/enable?next=%2Fkayit",
    );
  });
  it("SITE_URL yoksa null", () => {
    expect(siteEditUrl(undefined)).toBeNull();
  });
});
