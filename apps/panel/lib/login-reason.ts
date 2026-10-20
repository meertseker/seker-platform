// /login sayfasına neden düşüldüğü: tek oturum kuralı başka cihazdan girişte bu oturumu düşürür (B7).

export const LOGIN_REASON_PARAM = "neden";

export const LOGIN_REASONS = {
  "baska-cihaz": "Hesabınıza başka bir cihazdan giriş yapıldı, bu oturum kapatıldı.",
} as const;

export type LoginReason = keyof typeof LOGIN_REASONS;

export function loginReasonMessage(value: string | null | undefined): string | null {
  return value && Object.hasOwn(LOGIN_REASONS, value) ? LOGIN_REASONS[value as LoginReason] : null;
}

/**
 * İstekte Supabase oturum çerezi (sb-<ref>-auth-token, parçalı .0/.1 dahil) var mı. Çerez varken oturum
 * doğrulanamıyorsa kullanıcı giriş yapmıştı ve oturumu düşürüldü; hiç çerez yoksa ilk ziyarettir.
 */
export function hasAuthCookie(cookieNames: string[]): boolean {
  return cookieNames.some((name) => name.startsWith("sb-") && name.includes("-auth-token"));
}
