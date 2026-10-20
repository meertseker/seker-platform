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
  it("dört /reklam yolu yalnız yöneticiye açık", () => {
    for (const path of ["/reklam/hafta", "/reklam/icerik", "/reklam/kampanyalar", "/reklam/ayarlar"]) {
      expect(canOpen("yonetici", path)).toBe(true);
      expect(canOpen("danisman", path)).toBe(false);
      expect(canOpen("ogretmen", path)).toBe(false);
    }
  });
  it("homeFor rolün ana ekranını verir", () => {
    expect(homeFor("ogretmen")).toBe(TEACHER_HOME);
    expect(homeFor("danisman")).toBe("/bugun");
  });
});

import { teacherRedirectTarget, gateTeacher } from "@/lib/role-access";

describe("teacherRedirectTarget", () => {
  it("öğretmeni izinsiz yoldan /gorevim'e yollar", () => {
    expect(teacherRedirectTarget("ogretmen", "/leads/1")).toBe("/gorevim");
    expect(teacherRedirectTarget("ogretmen", "/")).toBe("/gorevim");
    expect(teacherRedirectTarget("ogretmen", "/odemeler/excel")).toBe("/gorevim");
  });
  it("izinli yol, login, api ve diğer roller için null", () => {
    expect(teacherRedirectTarget("ogretmen", "/gorevim/x")).toBeNull();
    expect(teacherRedirectTarget("ogretmen", "/login")).toBeNull();
    expect(teacherRedirectTarget("ogretmen", "/api/x")).toBeNull();
    expect(teacherRedirectTarget("danisman", "/leads/1")).toBeNull();
    expect(teacherRedirectTarget("yonetici", "/pazarlama")).toBeNull();
    expect(teacherRedirectTarget(null, "/leads/1")).toBeNull();
  });
});

function fakeClient(role: string | null, fail = false) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => (fail ? { data: null, error: { message: "x" } } : { data: role ? { role } : null, error: null }),
        }),
      }),
    }),
  } as never;
}

describe("gateTeacher (middleware dalı)", () => {
  it("öğretmen + izinsiz yol -> /gorevim", async () => {
    expect(await gateTeacher(fakeClient("ogretmen"), "u1", "/leads/abc")).toBe("/gorevim");
  });
  it("öğretmen + /gorevim -> null; danışman -> null", async () => {
    expect(await gateTeacher(fakeClient("ogretmen"), "u1", "/gorevim")).toBeNull();
    expect(await gateTeacher(fakeClient("danisman"), "u1", "/leads/abc")).toBeNull();
  });
  it("profil okunamazsa null (layout ikinci katman)", async () => {
    expect(await gateTeacher(fakeClient(null, true), "u1", "/leads/abc")).toBeNull();
  });
  it("login/api yollarında profil okumaz", async () => {
    const boom = { from: () => { throw new Error("okunmamalı"); } } as never;
    expect(await gateTeacher(boom, "u1", "/login")).toBeNull();
    expect(await gateTeacher(boom, "u1", "/api/x")).toBeNull();
  });
});
