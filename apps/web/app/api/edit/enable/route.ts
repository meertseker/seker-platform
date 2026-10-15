import { draftMode } from 'next/headers';
import { getEditor } from '@seker/auth/editor';
import { safeNext } from '@/lib/edit/safeNext';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const editor = await getEditor();
  if (!editor) {
    const panelUrl = process.env.PANEL_URL || 'https://panel.sekeranaokulu.com';
    return new Response(null, {
      status: 307,
      headers: { Location: `${panelUrl}/login`, 'Cache-Control': 'private, no-store' },
    });
  }
  (await draftMode()).enable();
  return new Response(null, {
    status: 307,
    headers: { Location: safeNext(url.searchParams.get('next')), 'Cache-Control': 'private, no-store' },
  });
}
