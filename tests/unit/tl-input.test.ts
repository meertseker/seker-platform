import { describe, it, expect } from "vitest";
import { parseTlInput, formatTlInput } from "@/lib/tl-input";

describe("parseTlInput", () => {
  it("düz tam sayıyı ayrıştırır", () => {
    expect(parseTlInput("22000")).toBe(22000);
  });

  it("nokta ile binlik ayracı kullanılan tutarı ayrıştırır", () => {
    expect(parseTlInput("22.000")).toBe(22000);
  });

  it("Türkçe tam format (binlik nokta + virgül ondalık) ayrıştırır", () => {
    expect(parseTlInput("22.000,50")).toBe(22000.5);
  });

  it("virgülü ondalık ayraç olarak ayrıştırır", () => {
    expect(parseTlInput("22000,5")).toBe(22000.5);
  });

  it("tek başına nokta ondalık ayraç olduğunda (2 basamağa kadar) doğru ayrıştırır - regresyon: 22000.5 220005'e donusmemeli", () => {
    expect(parseTlInput("22000.5")).toBe(22000.5);
    expect(parseTlInput("22000.05")).toBe(22000.05);
  });

  it("birden fazla nokta içeren binlik gruplamayı ayrıştırır", () => {
    expect(parseTlInput("1.234.567")).toBe(1234567);
  });

  it("boş girdi için null döner", () => {
    expect(parseTlInput("")).toBeNull();
    expect(parseTlInput("   ")).toBeNull();
  });

  it("geçersiz girdi için null döner", () => {
    expect(parseTlInput("abc")).toBeNull();
    expect(parseTlInput("12abc")).toBeNull();
  });

  it("negatif değerler için null döner", () => {
    expect(parseTlInput("-500")).toBeNull();
    expect(parseTlInput("-22.000,50")).toBeNull();
  });
});

describe("formatTlInput", () => {
  it("tam sayıyı olduğu gibi yazar", () => {
    expect(formatTlInput(22000)).toBe("22000");
  });

  it("ondalıklı tutarı virgülle yazar (nokta değil)", () => {
    expect(formatTlInput(22000.5)).toBe("22000,5");
  });

  it("formatTlInput çıktısı parseTlInput ile kayıpsız geri okunur (regresyon: silent 100x fiyat bozulması)", () => {
    expect(parseTlInput(formatTlInput(22000.5))).toBe(22000.5);
    expect(parseTlInput(formatTlInput(22000))).toBe(22000);
    expect(parseTlInput(formatTlInput(5000.25))).toBe(5000.25);
  });
});
