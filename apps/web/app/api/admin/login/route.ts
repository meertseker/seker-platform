import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, adminSessionToken } from '@/lib/adminAuth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const expected = process.env.ADMIN_PASSWORD ?? '';
  const origin = new URL(request.url).origin;

  if (!expected || password !== expected) {
    return NextResponse.redirect(new URL('/admin?error=1', origin), 303);
  }

  const response = NextResponse.redirect(new URL('/admin', origin), 303);
  response.cookies.set(ADMIN_COOKIE, adminSessionToken(), ADMIN_COOKIE_OPTIONS);
  return response;
}
