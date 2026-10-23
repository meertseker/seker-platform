import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { LP_SLUG_RE } from '@seker/shared/landing';

/**
 * Panel bir reklam sayfasını yayınlayınca/arşivleyince çağırır: `lp:<slug>` etiketini (lib/landing/db.ts
 * getPublishedLandingPage) anında düşürür. Sır `WEB_REVALIDATE_SECRET` (web ve panelde aynı değer).
 *
 * `revalidateTag(tag, { expire: 0 })`: dış sistemlerin çağırdığı route handler'larda anında süre dolumu biçimi.
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md (son "Good to know")
 * https://nextjs.org/docs/app/api-reference/functions/revalidateTag
 */
function reply(status: number, body: { ok: boolean }) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function authorized(header: string | null, secret: string): boolean {
  const match = header?.match(/^Bearer (.+)$/);
  if (!match) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.WEB_REVALIDATE_SECRET;
  if (!secret) return reply(503, { ok: false });
  if (!authorized(request.headers.get('authorization'), secret)) return reply(401, { ok: false });

  let slug: unknown;
  try {
    slug = ((await request.json()) as { slug?: unknown } | null)?.slug;
  } catch {
    return reply(400, { ok: false });
  }
  if (typeof slug !== 'string' || !LP_SLUG_RE.test(slug)) return reply(400, { ok: false });

  revalidateTag(`lp:${slug}`, { expire: 0 });
  return reply(200, { ok: true });
}
