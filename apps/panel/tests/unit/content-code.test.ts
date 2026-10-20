import { describe, it, expect } from "vitest";
import { parseContentCode, CONTENT_CODE_RE } from "@/lib/ads/content-code";

describe("parseContentCode", () => {
  it("baştaki kodu ayıklar", () => {
    expect(parseContentCode("R-2645-A · Bir günümüz")).toBe("R-2645-A");
    expect(parseContentCode("S-2646-G")).toBe("S-2646-G");
    expect(parseContentCode("R-2645-A - x")).toBe("R-2645-A");
    expect(parseContentCode("R-2645-A:x")).toBe("R-2645-A");
  });

  it("kodsuz, küçük harfli ya da bozuk ad null", () => {
    expect(parseContentCode("Bir günümüz")).toBeNull();
    expect(parseContentCode("r-2645-a · x")).toBeNull();
    expect(parseContentCode("R-2645-AB")).toBeNull();
    expect(parseContentCode(null)).toBeNull();
    expect(parseContentCode(undefined)).toBeNull();
  });

  it("CONTENT_CODE_RE tam eşleşme ister", () => {
    expect(CONTENT_CODE_RE.test("R-2645-A")).toBe(true);
    expect(CONTENT_CODE_RE.test("R-2645-A x")).toBe(false);
  });
});
