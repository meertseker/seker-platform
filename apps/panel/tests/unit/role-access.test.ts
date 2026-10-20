import { describe, expect, it } from "vitest";
import { canOpen, homeFor, TEACHER_HOME } from "@/lib/role-access";

describe("canOpen", () => {
  it("öğretmen yalnız /gorevim ve alt yollarını açar", () => {
    expect(canOpen("ogretmen", "/gorevim")).toBe(true);
    expect(canOpen("ogretmen", "/gorevim/abc")).toBe(true);
    expect(canOpen("ogretmen", "/leads/1")).toBe(false);
    expect(canOpen("ogretmen", "/pazarlama")).toBe(false);
    expect(canOpen("ogretmen", "/gorevimx")).toBe(false);
    expect(canOpen("ogretmen", "/")).toBe(false);
  });
  it("danışman ve yönetici bugünkü gibi her yolu açar; /reklam yalnız yönetici", () => {
    expect(canOpen("danisman", "/leads/1")).toBe(true);
    expect(canOpen("yonetici", "/reklam/icerik")).toBe(true);
    expect(canOpen("danisman", "/reklam/icerik")).toBe(false);
  });
  it("homeFor rolün ana ekranını verir", () => {
    expect(homeFor("ogretmen")).toBe(TEACHER_HOME);
    expect(homeFor("danisman")).toBe("/bugun");
  });
});
