import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@seker/auth/admin';
import { isBotUserAgent, parseVisitPayload } from '@/lib/visits';

/**
 * Çerezsiz anonim ziyaret sayacı (VisitBeacon gönderir). IP, çerez ve kimlik saklanmaz;
 * yalnızca gün × sayfa × kaynak × cihaz toplamı artırılır. Her durumda 204 döner (ziyaretçiye hata gösterilmez).
 */
const done = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  // Başka sitelerden sahte sayım engeli: Origin varsa bu sitenin kendisi olmalı.
  const origin = request.headers.get('origin');
  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      return done();
    }
    if (originHost !== request.nextUrl.host && originHost !== request.headers.get('host')) return done();
  }
  if (isBotUserAgent(request.headers.get('user-agent'))) return done();
  // Panele giriş yapmış personel (alan adı genelindeki Supabase oturum çerezi) sayılmaz.
  if (request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))) return done();

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return done();
  }
  const visit = parseVisitPayload(body);
  if (!visit) return done();

  try {
    const { error } = await createAdminSupabase().rpc('record_site_visit', {
      p_path: visit.p,
      p_source: visit.s,
      p_device: visit.d,
      p_entrance: visit.e,
    });
    if (error) console.error('[visit] record_site_visit failed:', error.code);
  } catch (error) {
    console.error('[visit] threw:', error instanceof Error ? error.name : 'unknown');
  }
  return done();
}
