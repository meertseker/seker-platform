import { describe, it, expect } from "vitest";
import { parseFilter } from "@/lib/notifications/filter";

describe("parseFilter", () => {
  it("okunmamis kabul edilir", () => {
    expect(parseFilter("okunmamis")).toBe("okunmamis");
  });
  it("tumu, boş ve bilinmeyen değer tumu olur", () => {
    expect(parseFilter("tumu")).toBe("tumu");
    expect(parseFilter(undefined)).toBe("tumu");
    expect(parseFilter("x")).toBe("tumu");
    expect(parseFilter("")).toBe("tumu");
  });
  it("dizi gelirse ilk değer kullanılır", () => {
    expect(parseFilter(["okunmamis", "tumu"])).toBe("okunmamis");
    expect(parseFilter([])).toBe("tumu");
  });
});
