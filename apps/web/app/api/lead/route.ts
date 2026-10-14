import { NextResponse } from 'next/server';
import { leadSchema } from '@/lib/leadSchema';
import { createWebLead } from '@/lib/websiteLeads';
import { sendLeadEmail } from '@/lib/leadEmail';
import { clientIp, createRateLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });
const FAILED = 'Talebiniz alınamadı, lütfen telefonla ulaşın.';

export async function POST(request: Request) {
  // clientIp yalnızca Caddy tek uç (edge) olduğu sürece güvenilirdir (CDN yok).
  if (!limiter.allow(clientIp(request.headers))) {
    return NextResponse.json(
      { ok: false, message: 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin veya bizi arayın.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: {}, message: 'Geçersiz istek' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const lead = parsed.data;
  if (lead.website) {
    // Honeypot: bot'a başarı gibi görün, hiçbir şey kaydetme (kişisel veri yazmadan logla).
    console.warn('[lead] honeypot');
    return NextResponse.json({ ok: true });
  }

  // Kayıt önce, e-posta sonra.
  const saved = await createWebLead(lead);
  const emailed = await sendLeadEmail(lead, saved);

  if (saved.status === 'saved' || emailed) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, message: FAILED }, { status: 500 });
}
