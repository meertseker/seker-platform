import { createAdminSupabase } from '@seker/auth/admin';
import type { Lead } from './leadSchema';

export type CreateWebLeadResult =
  | { status: 'saved'; leadId: string; duplicate: boolean }
  | { status: 'failed' };

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
