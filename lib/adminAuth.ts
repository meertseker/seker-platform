import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'seker_admin';

export function adminSessionToken(): string {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  if (!secret) return '';
  return createHmac('sha256', secret).update('seker-admin-session').digest('hex');
}

export function isValidAdminSession(cookie: string | undefined): boolean {
  const expected = adminSessionToken();
  if (!cookie || !expected || cookie.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};
