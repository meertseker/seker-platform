// /login sayfasına neden düşüldüğü: tek oturum kuralı başka cihazdan girişte bu oturumu düşürür (B7).

export const LOGIN_REASON_PARAM = "neden";

export const LOGIN_REASONS = {
  "baska-cihaz": "Hesabınıza başka bir cihazdan giriş yapıldı, bu oturum kapatıldı.",
  "oturum-bitti": "Oturumunuz sona erdi, tekrar giriş yapın.",
} as const;

export type LoginReason = keyof typeof LOGIN_REASONS;

/** Tek oturum kuralının düşürdüğü oturumda Auth'un döndürdüğü hata kodları. */
const KICKED_CODES = new Set(["session_not_found", "refresh_token_not_found"]);

export function loginReasonMessage(value: string | null | undefined): string | null {
  return value && Object.hasOwn(LOGIN_REASONS, value) ? LOGIN_REASONS[value as LoginReason] : null;
}

/**
 * Oturum çerezi vardı ama oturum doğrulanamadı: getClaims hatası oturum/yenileme anahtarı bulunamadı
 * diyorsa başka cihaz; başka her hata (ya da hatasız geçersizlik) oturum bitti. Çerez yoksa neden yok.
 */
export function loginReasonFor(hadSession: boolean, errorCode: string | undefined): LoginReason | null {
  if (!hadSession) return null;
  return errorCode && KICKED_CODES.has(errorCode) ? "baska-cihaz" : "oturum-bitti";
}

/**
 * İstekte Supabase oturum çerezi (sb-<ref>-auth-token ya da parçalı .0/.1) var mı. PKCE doğrulayıcısı
 * (-auth-token-code-verifier) oturum değildir.
 */
export function hasAuthCookie(cookieNames: string[]): boolean {
  return cookieNames.some((name) => /^sb-.+-auth-token(\.\d+)?$/.test(name));
}
