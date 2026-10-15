import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { safeNext } from '@/lib/edit/safeNext';

export async function GET(request: Request) {
  const url = new URL(request.url);
  (await draftMode()).disable();
  const res = NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url.origin), 307);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
