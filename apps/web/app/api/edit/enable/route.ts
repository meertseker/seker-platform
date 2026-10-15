import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { getEditor } from '@seker/auth/editor';
import { safeNext } from '@/lib/edit/safeNext';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const editor = await getEditor();
  if (!editor) {
    return NextResponse.redirect(`${process.env.PANEL_URL}/login`, 307);
  }
  (await draftMode()).enable();
  const res = NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url.origin), 307);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
