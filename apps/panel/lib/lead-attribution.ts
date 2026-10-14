export type LeadAttribution = {
  gclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
};

export function attributionLines(lead: LeadAttribution): string[] {
  const lines: string[] = [];
  if (lead.utm_campaign) lines.push(`Kampanya: ${lead.utm_campaign}`);
  if (lead.utm_source) {
    lines.push(`Kaynak: ${lead.utm_medium ? `${lead.utm_source} / ${lead.utm_medium}` : lead.utm_source}`);
  }
  if (lead.landing_path) lines.push(`İniş sayfası: ${lead.landing_path}`);
  if (lead.gclid) lines.push("Google Ads tıklaması (dönüşüm geri bildirilebilir)");
  return lines;
}
