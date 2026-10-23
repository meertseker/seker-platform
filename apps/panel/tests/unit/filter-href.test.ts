import { describe, expect, it } from "vitest";
import { filterHref } from "@/lib/filter-href";

describe("filterHref", () => {
  it("boş alanları adrese yazmaz", () => {
    expect(filterHref("/odemeler", [["q", ""], ["sezon", "2026-2027"]])).toBe("/odemeler?sezon=2026-2027");
  });

  it("yalnız boşluk olan aramayı yok sayar", () => {
    expect(filterHref("/ogrenciler", [["q", "   "], ["durum", ""]])).toBe("/ogrenciler");
  });

  it("gizli alanları korur ve Türkçe karakterleri kodlar", () => {
    expect(filterHref("/odemeler", [["q", "Güneş"], ["filtre", "geciken"], ["gecmis", "1"]])).toBe(
      "/odemeler?q=G%C3%BCne%C5%9F&filtre=geciken&gecmis=1",
    );
  });
});
