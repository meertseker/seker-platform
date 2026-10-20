import { describe, it, expect } from "vitest";
import { formatTurkishPhone, normalizeTurkishPhone, telHref } from "@/lib/phone";

describe("normalizeTurkishPhone", () => {
  it.each([
    ["0536 656 33 96", "+905366563396"],
    ["+90 534 034 44 46", "+905340344446"],
    ["05315248234", "+905315248234"],
    ["90 541 977 66 21", "+905419776621"],
    ["5366563396", "+905366563396"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeTurkishPhone(raw)).toBe(expected);
  });
  it.each([["123"], ["02123456789"], [""], ["+4915112345678"]])(
    "geçersiz: %s -> null",
    (raw) => expect(normalizeTurkishPhone(raw)).toBeNull()
  );
});

describe("formatTurkishPhone", () => {
  it.each([
    ["+905325554120", "0532 555 41 20"],
    ["05325554120", "0532 555 41 20"],
    ["90 541 977 66 21", "0541 977 66 21"],
  ])("%s -> %s", (raw, expected) => {
    expect(formatTurkishPhone(raw)).toBe(expected);
  });
  it("geçersiz numarayı olduğu gibi döner", () => {
    expect(formatTurkishPhone("123")).toBe("123");
  });
});

describe("telHref", () => {
  it("E.164 ile tel: bağlantısı üretir", () => {
    expect(telHref("0532 555 41 20")).toBe("tel:+905325554120");
  });
  it("geçersiz numarada null (düğme gösterilmez)", () => {
    expect(telHref("123")).toBeNull();
  });
});
