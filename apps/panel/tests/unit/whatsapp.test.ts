import { describe, it, expect } from "vitest";
import { waMeUrl } from "@/lib/whatsapp";

describe("waMeUrl", () => {
  it.each([
    ["0532 123 45 67", "https://wa.me/905321234567"],
    ["+90 532 123 45 67", "https://wa.me/905321234567"],
    ["90 532 123 45 67", "https://wa.me/905321234567"],
    ["5321234567", "https://wa.me/905321234567"],
  ])("%s -> %s", (raw, expected) => {
    expect(waMeUrl(raw)).toBe(expected);
  });

  it.each([["123"], [""], ["+4915112345678"], ["02123456789"]])(
    "geçersiz: %s -> null",
    (raw) => expect(waMeUrl(raw)).toBeNull(),
  );

  it("mesaj verildiğinde encode edilmiş ?text= ekler", () => {
    expect(waMeUrl("0532 123 45 67", "Merhaba, bilgi almak için ulaşıyorum")).toBe(
      "https://wa.me/905321234567?text=Merhaba%2C%20bilgi%20almak%20i%C3%A7in%20ula%C5%9F%C4%B1yorum",
    );
  });

  it("mesaj verilmediğinde ?text= eklemez", () => {
    expect(waMeUrl("0532 123 45 67")).toBe("https://wa.me/905321234567");
  });
});
