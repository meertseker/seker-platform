import { describe, expect, it } from "vitest";
import { LOGIN_REASON_PARAM, hasAuthCookie, loginReasonMessage } from "@/lib/login-reason";

describe("hasAuthCookie", () => {
  it("Supabase oturum çerezi (parçalı dahil) varsa true", () => {
    expect(hasAuthCookie(["sb-abc-auth-token"])).toBe(true);
    expect(hasAuthCookie(["sb-abc-auth-token.0", "sb-abc-auth-token.1"])).toBe(true);
    expect(hasAuthCookie(["theme", "sb-abc-auth-token-code-verifier"])).toBe(true);
  });

  it("oturum çerezi yoksa false (ilk ziyaret, çıkış sonrası)", () => {
    expect(hasAuthCookie([])).toBe(false);
    expect(hasAuthCookie(["theme", "seker_bugun_yardim"])).toBe(false);
  });
});

describe("loginReasonMessage", () => {
  it("başka cihaz nedenini Türkçe açıklar", () => {
    expect(LOGIN_REASON_PARAM).toBe("neden");
    expect(loginReasonMessage("baska-cihaz")).toBe(
      "Hesabınıza başka bir cihazdan giriş yapıldı, bu oturum kapatıldı.",
    );
  });

  it("bilinmeyen ya da boş nedende mesaj yok", () => {
    expect(loginReasonMessage(null)).toBeNull();
    expect(loginReasonMessage(undefined)).toBeNull();
    expect(loginReasonMessage("x")).toBeNull();
  });
});
