import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversionAction } from "@/lib/constants";
import { adUserDataFor } from "./consent";
import type { AdsStore, PendingConversion, PlatformSpendRow, UploadOutcome } from "./types";

interface LeadRow {
  consent_at: string | null;
  ad_consent_revoked_at: string | null;
  web_payload: Record<string, unknown> | null;
  created_at: string;
}

interface PendingRow {
  id: string;
  lead_id: string;
  gclid: string | null;
  conversion_action: Exclude<ConversionAction, "lead">; // sorgu platform=google ile süzülür
  conversion_at: string;
  value: number | string | null;
  lead: LeadRow | LeadRow[] | null;
}

interface ClickEventRow {
  entity_id: string;
  created_at: string;
  gclid: string | null;
}

const CLICK_EVENT_TYPES = ["web_basvuru", "web_tekrar_basvuru"];

export function supabaseAdsStore(db: SupabaseClient): AdsStore {
  return {
    async upsertSpend(rows) {
      const { error } = await db.from("ad_spend_daily").upsert(
        rows.map((row) => ({
          date: row.date,
          platform: "google",
          level: "campaign",
          object_id: row.campaignId,
          campaign_id: row.campaignId,
          campaign_name: row.campaignName,
          cost_micros: row.costMicros,
          clicks: row.clicks,
          impressions: row.impressions,
        })),
        { onConflict: "platform,date,level,object_id" },
      );
      if (error) throw new Error(`ad_spend_daily yazılamadı: ${error.message}`);
    },

    async listPending(limit) {
      const { data, error } = await db
        .from("conversion_uploads")
        .select(
          "id, lead_id, gclid, conversion_action, conversion_at, value, lead:leads(consent_at, ad_consent_revoked_at, web_payload, created_at)",
        )
        .eq("platform", "google") // Meta satırı gclid taşısa bile Google kuyruğuna girmez
        .eq("status", "bekliyor")
        .not("gclid", "is", null)
        .order("conversion_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`conversion_uploads okunamadı: ${error.message}`);
      const rows = (data ?? []) as unknown as PendingRow[];
      if (rows.length === 0) return [];

      // Tek sorguda tüm bekleyen adayların tıklama olayları (N+1 yok).
      const { data: events, error: eventsError } = await db
        .from("events")
        .select("entity_id, created_at, gclid:payload->>gclid")
        .eq("entity_type", "lead")
        .in("entity_id", [...new Set(rows.map((r) => r.lead_id))])
        .in("event_type", CLICK_EVENT_TYPES)
        .order("created_at", { ascending: true });
      if (eventsError) throw new Error(`events okunamadı: ${eventsError.message}`);
      const firstClick = new Map<string, string>();
      for (const event of (events ?? []) as unknown as ClickEventRow[]) {
        if (!event.gclid) continue;
        const key = `${event.entity_id}|${event.gclid}`;
        if (!firstClick.has(key)) firstClick.set(key, event.created_at); // en erken olay önce gelir
      }

      return rows.map((row): PendingConversion => {
        const lead = Array.isArray(row.lead) ? row.lead[0] : row.lead;
        const gclid = row.gclid ?? "";
        const clickAt = firstClick.get(`${row.lead_id}|${gclid}`) ?? lead?.created_at ?? row.conversion_at;
        return {
          id: row.id,
          leadId: row.lead_id,
          gclid,
          action: row.conversion_action,
          conversionAt: row.conversion_at,
          clickAt: new Date(clickAt).toISOString(),
          value: row.value == null ? null : Number(row.value),
          adUserData: adUserDataFor(lead),
        };
      });
    },

    async saveOutcomes(outcomes) {
      const now = new Date().toISOString();
      for (const outcome of outcomes) {
        const { error } = await db
          .from("conversion_uploads")
          .update({
            status: outcome.status,
            error: outcome.error,
            uploaded_at: outcome.status === "gonderildi" ? now : null,
          })
          .eq("id", outcome.id);
        if (error) throw new Error(`conversion_uploads güncellenemedi: ${error.message}`);
      }
    },
  };
}

export interface MetaPendingEvent {
  id: string;
  leadId: string;
  action: "lead" | "randevu" | "kayit";
  eventId: string;
  conversionAt: string; // ISO (DB timestamptz)
  value: number | null; // TL
  lead: {
    phone: string;
    createdAt: string;
    fbc: string | null;
    fbp: string | null;
    consentVersion: number | null;
    adCookieConsent: boolean | null;
    /** Başvuru isteğinin tarayıcı bilgisi; yalnız çerez onayı varsa yazılır (CAPI Lead için zorunlu). */
    clientUserAgent: string | null;
    consentAt: string | null;
    adConsentRevokedAt: string | null;
    webPayload: Record<string, unknown> | null;
    landingPath: string | null;
  };
}

export interface MetaStore {
  upsertSpend(rows: PlatformSpendRow[]): Promise<void>;
  listPending(limit: number): Promise<MetaPendingEvent[]>;
  saveOutcomes(outcomes: UploadOutcome[]): Promise<void>;
}

interface MetaLeadRow {
  phone: string;
  created_at: string;
  fbc: string | null;
  fbp: string | null;
  consent_version: number | null;
  ad_cookie_consent: boolean | null;
  client_user_agent: string | null;
  consent_at: string | null;
  ad_consent_revoked_at: string | null;
  web_payload: Record<string, unknown> | null;
  landing_path: string | null;
}

interface MetaPendingRow {
  id: string;
  lead_id: string;
  conversion_action: "lead" | "randevu" | "kayit";
  event_id: string | null;
  conversion_at: string;
  value: number | string | null;
  lead: MetaLeadRow | MetaLeadRow[] | null;
}

export function supabaseMetaStore(db: SupabaseClient): MetaStore {
  return {
    async upsertSpend(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from("ad_spend_daily").upsert(
        rows.map((row) => ({
          date: row.date,
          platform: row.platform,
          level: row.level,
          object_id: row.objectId,
          campaign_id: row.campaignId,
          campaign_name: row.campaignName,
          cost_micros: row.costMicros,
          clicks: row.clicks,
          impressions: row.impressions,
          adset_id: row.adsetId,
          adset_name: row.adsetName,
          ad_id: row.adId,
          ad_name: row.adName,
          content_code: row.contentCode,
          reach: row.reach,
          frequency: row.frequency,
          platform_results: row.platformResults,
        })),
        { onConflict: "platform,date,level,object_id" },
      );
      if (error) throw new Error(`ad_spend_daily yazılamadı: ${error.message}`);
    },

    async listPending(limit) {
      const { data, error } = await db
        .from("conversion_uploads")
        .select(
          "id, lead_id, conversion_action, event_id, conversion_at, value, lead:leads(phone, created_at, fbc, fbp, consent_version, ad_cookie_consent, client_user_agent, consent_at, ad_consent_revoked_at, web_payload, landing_path)",
        )
        .eq("platform", "meta")
        .eq("status", "bekliyor")
        .order("conversion_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`conversion_uploads okunamadı: ${error.message}`);
      const rows = (data ?? []) as unknown as MetaPendingRow[];
      return rows.flatMap((row): MetaPendingEvent[] => {
        const lead = Array.isArray(row.lead) ? row.lead[0] : row.lead;
        if (!lead) return [];
        return [
          {
            id: row.id,
            leadId: row.lead_id,
            action: row.conversion_action,
            eventId: row.event_id ?? "",
            conversionAt: row.conversion_at,
            value: row.value == null ? null : Number(row.value),
            lead: {
              phone: lead.phone,
              createdAt: lead.created_at,
              fbc: lead.fbc,
              fbp: lead.fbp,
              consentVersion: lead.consent_version,
              adCookieConsent: lead.ad_cookie_consent,
              clientUserAgent: lead.client_user_agent,
              consentAt: lead.consent_at,
              adConsentRevokedAt: lead.ad_consent_revoked_at,
              webPayload: lead.web_payload,
              landingPath: lead.landing_path,
            },
          },
        ];
      });
    },

    async saveOutcomes(outcomes) {
      const now = new Date().toISOString();
      for (const outcome of outcomes) {
        const { error } = await db
          .from("conversion_uploads")
          .update({
            status: outcome.status,
            error: outcome.error,
            uploaded_at: outcome.status === "gonderildi" ? now : null,
          })
          .eq("id", outcome.id);
        if (error) throw new Error(`conversion_uploads güncellenemedi: ${error.message}`);
      }
    },
  };
}
