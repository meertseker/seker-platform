import { describe, expect, it } from "vitest";
import { LOGIN_REASON_PARAM, hasAuthCookie, loginReasonFor, loginReasonMessage } from "@/lib/login-reason";

describe("hasAuthCookie", () => {
  it("Supabase oturum çerezi (parçalı dahil) varsa true", () => {
    expect(hasAuthCookie(["sb-abc-auth-token"])).toBe(true);
    expect(hasAuthCookie(["sb-abc-auth-token.0", "sb-abc-auth-token.1"])).toBe(true);
  });

  it("oturum çerezi yoksa false (ilk ziyaret, çıkış sonrası, yalnız PKCE doğrulayıcı)", () => {
    expect(hasAuthCookie([])).toBe(false);
    expect(hasAuthCookie(["theme", "seker_bugun_yardim"])).toBe(false);
    expect(hasAuthCookie(["sb-abc-auth-token-code-verifier"])).toBe(false);
  });
});

describe("loginReasonFor", () => {
  it("çerez varken oturum/yenileme anahtarı bulunamıyorsa başka cihaz (tek oturum kuralı)", () => {
    expect(loginReasonFor(true, "session_not_found")).toBe("baska-cihaz");
    expect(loginReasonFor(true, "refresh_token_not_found")).toBe("baska-cihaz");
  });

  it("çerez varken başka bir hata ya da hatasız geçersizlik: oturum bitti", () => {
    expect(loginReasonFor(true, "refresh_token_already_used")).toBe("oturum-bitti");
    expect(loginReasonFor(true, undefined)).toBe("oturum-bitti");
  });

  it("çerez yoksa neden yok", () => {
    expect(loginReasonFor(false, "session_not_found")).toBeNull();
    expect(loginReasonFor(false, undefined)).toBeNull();
  });
});

describe("loginReasonMessage", () => {
  it("nedenleri Türkçe açıklar", () => {
    expect(LOGIN_REASON_PARAM).toBe("neden");
    expect(loginReasonMessage("baska-cihaz")).toBe(
      "Hesabınıza başka bir cihazdan giriş yapıldı, bu oturum kapatıldı.",
    );
    expect(loginReasonMessage("oturum-bitti")).toBe("Oturumunuz sona erdi, tekrar giriş yapın.");
  });

  it("bilinmeyen ya da boş nedende mesaj yok", () => {
    expect(loginReasonMessage(null)).toBeNull();
    expect(loginReasonMessage(undefined)).toBeNull();
    expect(loginReasonMessage("x")).toBeNull();
  });
});
