import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/adminAuth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL('/admin', origin), 303);
  response.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
