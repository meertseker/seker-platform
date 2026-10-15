export type AdConsentInput = {
  consent_at: string | null;
  ad_consent_revoked_at?: string | null;
  web_payload: Record<string, unknown> | null;
};

/**
 * Bir lead'in Google'a gönderilecek reklam verisi onay durumu (KVKK).
 * Tek doğruluk kaynağı: dönüşüm yükleme bu fonksiyonun sonucuna göre `consent.adUserData` alanını doldurur.
 *
 * Kurallar, sırayla:
 *  1. web_payload'da old_web_lead_id varsa veya consent_scope "arama" ise → "denied"
 *  2. ad_consent_revoked_at dolu ise → "denied"
 *  3. consent_at dolu ise → "granted"
 *  4. Aksi halde → null (onay kaydı yok)
 */
export function adUserDataFor(
  lead: AdConsentInput | null | undefined,
): "granted" | "denied" | null {
  if (!lead) return null;

  const payload = lead.web_payload;
  if (payload && ("old_web_lead_id" in payload || payload.consent_scope === "arama")) {
    return "denied";
  }
  if (lead.ad_consent_revoked_at) return "denied";
  if (lead.consent_at) return "granted";
  return null;
}
