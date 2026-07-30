import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { leadSchema } from '@/lib/leadSchema';
import { SITE } from '@/lib/site';

export const runtime = 'nodejs';

const PROGRAM_LABELS: Record<string, string> = {
  'tam-gun': 'Tam Gün',
  'yarim-gun': 'Yarım Gün',
  'yaz-okulu': 'Yaz Okulu',
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Geçersiz istek' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const lead = parsed.data;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFICATION_EMAIL ?? SITE.email;

  // Anahtar yoksa lead'i kaybetme — logla ve başarı dön.
  if (!apiKey) {
    console.warn('[lead] RESEND_API_KEY tanımsız, lead yalnızca loglandı:', lead);
    return NextResponse.json({ ok: true });
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'Şeker Anaokulu Web <onboarding@resend.dev>', // TODO: doğrulanmış alan adıyla değiştir
      to,
      replyTo: lead.email || undefined,
      subject: `Yeni ön görüşme talebi — ${lead.parentName} (${lead.childAge} yaş)`,
      text: [
        `Veli: ${lead.parentName}`,
        `Telefon: ${lead.phone}`,
        `E-posta: ${lead.email || '—'}`,
        `Çocuk yaş grubu: ${lead.childAge}`,
        `Program: ${PROGRAM_LABELS[lead.program] ?? lead.program}`,
        `Başlangıç dönemi: ${lead.startTerm}`,
        '',
        `Mesaj: ${lead.message || '—'}`,
        '',
        `⏱ Hedef yanıt süresi: 15 dakika`,
      ].join('\n'),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[lead] e-posta gönderilemedi:', error, lead);
    return NextResponse.json(
      { ok: false, message: 'Talebiniz alınamadı, lütfen telefonla ulaşın.' },
      { status: 500 },
    );
  }
}
