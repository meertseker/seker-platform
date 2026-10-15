import { draftMode } from 'next/headers';
import { safeNext } from '@/lib/edit/safeNext';

export async function GET(request: Request) {
  const url = new URL(request.url);
  (await draftMode()).disable();
  return new Response(null, {
    status: 307,
    headers: { Location: safeNext(url.searchParams.get('next')), 'Cache-Control': 'private, no-store' },
  });
}
