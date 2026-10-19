import { createAdminSupabase } from '@seker/auth/admin';
import type { Lead } from './leadSchema';

export type CreateWebLeadResult =
  | { status: 'saved'; leadId: string; duplicate: boolean }
  | { status: 'failed' };

/** Yalnız qualify açıkken nitelik cevapları RPC'ye gider; ana sayfa formu boş p_meta gönderir. */
function qualifyMeta(lead: Lead): { [key: string]: string | number | boolean } {
  if (!lead.qualify) return {};
  const meta: { [key: string]: string | number | boolean } = {};
  if (lead.childBirthMonth !== undefined) meta.child_birth_month = lead.childBirthMonth;
  if (lead.childBirthYear !== undefined) meta.child_birth_year = lead.childBirthYear;
  if (lead.district !== undefined) meta.district = lead.district;
  if (lead.startWindow !== undefined) meta.start_window = lead.startWindow;
  if (lead.wantsWhatsapp !== undefined) meta.wants_whatsapp = lead.wantsWhatsapp;
  return meta;
}

export async function createWebLead(
  lead: Lead,
  consentAt: Date = new Date(),
): Promise<CreateWebLeadResult> {
  try {
    const db = createAdminSupabase();
    const { data, error } = await db.rpc('create_web_lead', {
      p_parent_name: lead.parentName,
      p_phone: lead.phone,
      p_gclid: lead.gclid,
      p_utm: lead.utm,
      p_landing_path: lead.landingPath,
      p_consent_at: consentAt.toISOString(),
      p_meta: qualifyMeta(lead),
    });
    if (error || !data) {
      console.error('[lead] create_web_lead failed:', error?.code ?? 'no-data');
      return { status: 'failed' };
    }
    const result = data as { lead_id: string; duplicate: boolean };
    return { status: 'saved', leadId: result.lead_id, duplicate: result.duplicate };
  } catch (error) {
    console.error('[lead] create_web_lead threw:', error instanceof Error ? error.message : 'unknown');
    return { status: 'failed' };
  }
}
