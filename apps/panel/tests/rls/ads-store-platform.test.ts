import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin } from "./helpers";
import { supabaseAdsStore, supabaseMetaStore } from "@/lib/ads/store";
import type { PlatformSpendRow } from "@/lib/ads/types";

const DAN_ID = "00000000-0000-0000-0000-000000000002";
const DAY = "2020-02-02";
const google = supabaseAdsStore(admin);
const meta = supabaseMetaStore(admin);
const leadIds: string[] = [];
let metaLeadId = "";
let gclidMetaLeadId = "";

async function mkLead(fields: Record<string, unknown>) {
  const { data, error } = await admin
    .from("leads")
    .insert({
      parent_name: "Platform Store Veli",
      phone: `+90500544${Math.floor(1000 + Math.random() * 8999)}`,
      source: "instagram",
      assigned_to: DAN_ID,
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  leadIds.push(data!.id as string);
  return data!.id as string;
}

beforeAll(async () => {
  metaLeadId = await mkLead({
    ad_platform: "meta",
    fbc: "fb.1.1700000000000.ABC",
    fbp: "fb.1.1700000000000.123",
    meta_event_id: "evt-platform-1",
    consent_version: 2,
    ad_cookie_consent: true,
    consent_at: new Date().toISOString(),
    landing_path: "/kayit?x=1",
    web_payload: { utm_source: "instagram" },
  });
  gclidMetaLeadId = await mkLead({ ad_platform: "meta", gclid: "G-META-LEAK", consent_at: new Date().toISOString() });
  // tetikleyici satırlarını temizle, elle kur
  await admin.from("conversion_uploads").delete().in("lead_id", leadIds);
  const ins = await admin.from("conversion_uploads").insert([
    {
      lead_id: metaLeadId,
      platform: "meta",
      click_id_type: "fbc",
      event_id: "evt-platform-1",
      conversion_action: "lead",
      conversion_at: "2026-10-01T10:00:00Z",
    },
    {
      lead_id: gclidMetaLeadId,
      platform: "meta",
      gclid: "G-META-LEAK",
      conversion_action: "randevu",
      conversion_at: "2026-10-01T11:00:00Z",
      value: 1500.5,
    },
  ]);
  if (ins.error) throw ins.error;
});

afterAll(async () => {
  await admin.from("ad_spend_daily").delete().eq("date", DAY);
  await admin.from("conversion_uploads").delete().in("lead_id", leadIds);
  await admin.from("leads").delete().in("id", leadIds);
});

const adRow: PlatformSpendRow = {
  date: DAY,
  campaignId: "MC1",
  campaignName: "Meta Kampanya",
  costMicros: 12_500_000,
  clicks: 7,
  impressions: 900,
  platform: "meta",
  level: "ad",
  objectId: "AD1",
  adsetId: "AS1",
  adsetName: "Küme",
  adId: "AD1",
  adName: "R-2645-A · x",
  contentCode: "R-2645-A",
  reach: 800,
  frequency: 1.12,
  platformResults: 3,
};

describe("platformlu depo", () => {
  it("google upsertSpend eski satırlara yazar", async () => {
    const row = { date: DAY, campaignId: "GC1", campaignName: "A", costMicros: 5, clicks: 1, impressions: 2 };
    await google.upsertSpend([row]);
    await google.upsertSpend([{ ...row, campaignName: "B", costMicros: 9 }]);
    const { data } = await admin.from("ad_spend_daily").select("*").eq("date", DAY).eq("campaign_id", "GC1");
    expect(data).toHaveLength(1);
    expect(data![0].platform).toBe("google");
    expect(data![0].campaign_name).toBe("B");
    expect(data![0].cost_micros).toBe(9);
  });

  it("meta upsertSpend reklam satırı yazar ve google satırını ezmez", async () => {
    await meta.upsertSpend([adRow]);
    await meta.upsertSpend([{ ...adRow, costMicros: 20_000_000 }]);
    const { data } = await admin.from("ad_spend_daily").select("*").eq("date", DAY).eq("platform", "meta");
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      level: "ad",
      object_id: "AD1",
      campaign_id: "MC1",
      adset_id: "AS1",
      adset_name: "Küme",
      ad_id: "AD1",
      ad_name: "R-2645-A · x",
      content_code: "R-2645-A",
      cost_micros: 20_000_000,
      clicks: 7,
      impressions: 900,
      reach: 800,
      platform_results: 3,
    });
    const g = await admin.from("ad_spend_daily").select("*").eq("date", DAY).eq("platform", "google");
    expect(g.data).toHaveLength(1);
    expect(g.data![0].campaign_name).toBe("B");
  });

  it("google listPending meta satırını görmez (gclid'li olsa bile)", async () => {
    const list = await google.listPending(500);
    expect(list.find((p) => p.leadId === gclidMetaLeadId)).toBeUndefined();
    const metaList = await meta.listPending(500);
    expect(metaList.find((p) => p.leadId === gclidMetaLeadId)).toBeDefined();
  });

  it("meta listPending velinin fbc, onay sürümü ve telefonunu döner", async () => {
    const list = await meta.listPending(500);
    const mine = list.find((p) => p.leadId === metaLeadId)!;
    expect(mine.action).toBe("lead");
    expect(mine.eventId).toBe("evt-platform-1");
    expect(mine.value).toBeNull();
    expect(mine.lead.phone).toMatch(/^\+90500544/);
    expect(mine.lead.fbc).toBe("fb.1.1700000000000.ABC");
    expect(mine.lead.fbp).toBe("fb.1.1700000000000.123");
    expect(mine.lead.consentVersion).toBe(2);
    expect(mine.lead.adCookieConsent).toBe(true);
    expect(mine.lead.landingPath).toBe("/kayit?x=1");
    expect(mine.lead.webPayload).toEqual({ utm_source: "instagram" });
    const other = list.find((p) => p.leadId === gclidMetaLeadId)!;
    expect(other.value).toBe(1500.5);
    // conversion_at artan sıra
    expect(list.findIndex((p) => p.leadId === metaLeadId)).toBeLessThan(list.findIndex((p) => p.leadId === gclidMetaLeadId));
  });

  it("meta saveOutcomes durumu yazar; gönderilenler listeden çıkar", async () => {
    const pending = (await meta.listPending(500)).find((p) => p.leadId === metaLeadId)!;
    await meta.saveOutcomes([{ id: pending.id, status: "gonderildi", error: null }]);
    const list = await meta.listPending(500);
    expect(list.find((p) => p.leadId === metaLeadId)).toBeUndefined();
    const { data } = await admin.from("conversion_uploads").select("status, uploaded_at").eq("id", pending.id).single();
    expect(data!.status).toBe("gonderildi");
    expect(data!.uploaded_at).not.toBeNull();
  });
});
