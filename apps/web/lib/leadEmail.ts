import { Resend } from 'resend';
import { SITE } from './site';
import type { Lead } from './leadSchema';
import type { CreateWebLeadResult } from './websiteLeads';

const FALLBACK_FROM = 'Şeker Anaokulu Web <onboarding@resend.dev>';

/** Asla throw etmez: e-posta hatası başvuruyu kaybettirmemeli. */
export async function sendLeadEmail(lead: Lead, result: CreateWebLeadResult): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const to = process.env.LEAD_NOTIFICATION_EMAIL ?? SITE.email;
  const from = process.env.LEAD_FROM_EMAIL || FALLBACK_FROM;
  const panelUrl = process.env.PANEL_URL ?? 'https://panel.sekeranaokulu.com';
  const saved = result.status === 'saved';
  const subject = saved && result.duplicate
    ? `Tekrar başvuru — ${lead.parentName}`
    : `Yeni geri arama talebi — ${lead.parentName}`;

  const text = [
    ...(saved ? [] : ['⚠ Panele kaydedilemedi. Lütfen bu başvuruyu panele elle girin.', '']),
    `Veli: ${lead.parentName}`,
    `Telefon: ${lead.phone}`,
    '',
    `Kaynak sayfa: ${lead.landingPath || '—'}`,
    `Kampanya: ${lead.utm.utm_campaign || '—'}`,
    `GCLID: ${lead.gclid || '—'}`,
    ...(saved ? [`Panelde aç: ${panelUrl}/leads/${result.leadId}`] : []),
    '',
    '⏱ Hedef yanıt süresi: 15 dakika',
  ].join('\n');

  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject, text });
    if (error) {
      console.error('[lead] e-posta gönderilemedi:', error.message ?? 'unknown');
      return false;
    }
    return true;
  } catch (error) {
    console.error('[lead] e-posta gönderilemedi:', error instanceof Error ? error.message : 'unknown');
    return false;
  }
}
