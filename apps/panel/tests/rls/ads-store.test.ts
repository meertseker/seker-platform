import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin } from "./helpers";
import { supabaseAdsStore } from "@/lib/ads/store";

const DAN_ID = "00000000-0000-0000-0000-000000000002";
const DAY = "2020-01-01";
const store = supabaseAdsStore(admin);
let leadId = "";
let oldLeadId = "";

async function mkLead(fields: Record<string, unknown>) {
  const { data, error } = await admin
    .from("leads")
    .insert({
      parent_name: "Ads Store Veli",
      phone: `+90555${Math.floor(1000000 + Math.random() * 8999999)}`,
      source: "reklam",
      assigned_to: DAN_ID,
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

beforeAll(async () => {
  leadId = await mkLead({ gclid: "G-STORE", consent_at: new Date().toISOString() });
  oldLeadId = await mkLead({
    gclid: "G-OLD",
    consent_at: new Date().toISOString(),
    web_payload: { old_web_lead_id: "x" },
  });
  // tetikleyicinin kuyruğa attığı satırlar varsa temizle, test satırlarını elle kur
  await admin.from("conversion_uploads").delete().in("lead_id", [leadId, oldLeadId]);
  const ins = await admin.from("conversion_uploads").insert([
    { lead_id: leadId, gclid: "G-STORE", conversion_action: "randevu", conversion_at: "2026-10-01T10:00:00Z", value: 1500.5 },
    { lead_id: oldLeadId, gclid: "G-OLD", conversion_action: "randevu", conversion_at: "2026-10-01T10:00:00Z" },
  ]);
  if (ins.error) throw ins.error;
  const base = { entity_type: "lead", entity_id: leadId, event_type: "web_basvuru" };
  const ev = await admin.from("events").insert([
    { ...base, payload: { gclid: "G-STORE" }, created_at: "2026-09-30T08:00:00Z" },
    { ...base, event_type: "web_tekrar_basvuru", payload: { gclid: "G-STORE" }, created_at: "2026-09-29T08:00:00Z" },
    { ...base, payload: { gclid: "BASKA" }, created_at: "2026-09-01T08:00:00Z" },
  ]);
  if (ev.error) throw ev.error;
});

afterAll(async () => {
  await admin.from("ad_spend_daily").delete().eq("date", DAY);
  await admin.from("events").delete().eq("entity_type", "lead").in("entity_id", [leadId, oldLeadId]);
  await admin.from("leads").delete().in("id", [leadId, oldLeadId]);
});

describe("supabaseAdsStore", () => {
  it("upsertSpend (date,campaign_id) üzerine yazar ve cost_micros bigint'i tam korur", async () => {
    const big = 9007199254740991; // 2^53 - 1
    const row = { date: DAY, campaignId: "C1", campaignName: "A", costMicros: 1234567890123, clicks: 1, impressions: 2 };
    await store.upsertSpend([row]);
    await store.upsertSpend([{ ...row, campaignName: "B", costMicros: big }]);
    const { data } = await admin.from("ad_spend_daily").select("*").eq("date", DAY).eq("campaign_id", "C1");
    expect(data).toHaveLength(1);
    expect(data![0].campaign_name).toBe("B");
    expect(data![0].cost_micros).toBe(big);
  });

  it("listPending onayı adUserDataFor ile eşler, clickAt eşleşen en erken olaydır", async () => {
    const list = await store.listPending(500);
    const mine = list.find((p) => p.leadId === leadId)!;
    expect(mine.adUserData).toBe("granted");
    expect(mine.clickAt).toBe(new Date("2026-09-29T08:00:00Z").toISOString());
    expect(mine.value).toBe(1500.5);
    const old = list.find((p) => p.leadId === oldLeadId)!;
    expect(old.adUserData).toBe("denied");
    // olay yok: lead created_at'e düşer
    expect(Number.isNaN(Date.parse(old.clickAt))).toBe(false);
  });

  it("saveOutcomes durumu ve uploaded_at'i yazar; gönderilenler listeden çıkar", async () => {
    const list = await store.listPending(500);
    const id = list.find((p) => p.leadId === leadId)!.id;
    await store.saveOutcomes([{ id, status: "gonderildi", error: null }]);
    const { data } = await admin.from("conversion_uploads").select("status, uploaded_at").eq("id", id).single();
    expect(data!.status).toBe("gonderildi");
    expect(data!.uploaded_at).not.toBeNull();
    expect((await store.listPending(500)).some((p) => p.id === id)).toBe(false);
  });
});
