import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Site ve panel aynı Supabase oturumunu paylaşsın diye çerez ortak üst alan
 * adına (.sekeranaokulu.com) yazılır. Yerelde boş bırakılır: localhost'ta
 * domain'li çerez tarayıcı tarafından reddedilir.
 */
export function authCookieOptions(): CookieOptionsWithName {
  return {
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}
