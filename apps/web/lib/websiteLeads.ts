import type { Lead } from './leadSchema';
import { supabaseRest } from './supabase';

export type WebsiteLeadRow = {
  id: string;
  parent_name: string;
  phone: string;
  landing_path: string;
  gclid: string;
  created_at: string;
};

export async function insertWebsiteLead(
  lead: Lead,
): Promise<'saved' | 'skipped' | 'failed'> {
  const response = await supabaseRest('/rest/v1/rpc/insert_seker_website_lead', {
    method: 'POST',
    body: JSON.stringify({
      p_parent_name: lead.parentName,
      p_phone: lead.phone,
      p_landing_path: lead.landingPath ?? '',
      p_gclid: lead.gclid ?? '',
    }),
  });
  if (!response) return 'skipped';
  if (!response.ok) {
    console.error('[lead] supabase insert failed:', response.status, await response.text());
    return 'failed';
  }
  return 'saved';
}

export async function listWebsiteLeads(adminToken: string): Promise<WebsiteLeadRow[]> {
  const response = await supabaseRest('/rest/v1/rpc/list_seker_website_leads', {
    method: 'POST',
    body: JSON.stringify({ p_admin_token: adminToken }),
  });
  if (!response) throw new Error('Supabase yapılandırılmamış');
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as WebsiteLeadRow[];
}
