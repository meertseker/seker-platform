import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversionAction } from "@/lib/constants";
import { adUserDataFor } from "./consent";
import type { AdsStore, PendingConversion } from "./types";

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
  conversion_action: ConversionAction;
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
          campaign_id: row.campaignId,
          campaign_name: row.campaignName,
          cost_micros: row.costMicros,
          clicks: row.clicks,
          impressions: row.impressions,
        })),
        { onConflict: "date,campaign_id" },
      );
      if (error) throw new Error(`ad_spend_daily yazılamadı: ${error.message}`);
    },

    async listPending(limit) {
      const { data, error } = await db
        .from("conversion_uploads")
        .select(
          "id, lead_id, gclid, conversion_action, conversion_at, value, lead:leads(consent_at, ad_consent_revoked_at, web_payload, created_at)",
        )
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
