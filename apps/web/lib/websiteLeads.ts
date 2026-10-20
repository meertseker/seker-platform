import { createAdminSupabase } from '@seker/auth/admin';
import type { Lead } from './leadSchema';
import { CONSENT_VERSION } from './metaClick';

export type CreateWebLeadResult =
  | { status: 'saved'; leadId: string; duplicate: boolean }
  | { status: 'failed' };

type Meta = { [key: string]: string | number | boolean };

/** Onay sürümü ve Meta kimlikleri her formda gider; boş Meta alanları eklenmez. */
function trackingMeta(lead: Lead): Meta {
  const meta: Meta = { consent_version: CONSENT_VERSION, ad_cookie_consent: lead.adCookieConsent };
  if (lead.fbclid) meta.fbclid = lead.fbclid;
  if (lead.fbc) meta.fbc = lead.fbc;
  if (lead.fbp) meta.fbp = lead.fbp;
  if (lead.metaEventId) meta.meta_event_id = lead.metaEventId;
  return meta;
}

/** Nitelik cevapları yalnız qualify açıkken RPC'ye gider; izleme alanları her formda gider. */
function qualifyMeta(lead: Lead): Meta {
  const meta: Meta = trackingMeta(lead);
  if (!lead.qualify) return meta;
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
