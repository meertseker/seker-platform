import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const PREFIX = "+90500555";
let seq = 0;
const nextPhone = () => `${PREFIX}${String(++seq).padStart(4, "0")}`;
const SPEND_DATE = "2031-03-05";

const metaUtm = {
  utm_source: "instagram",
  utm_medium: "paid_social",
  utm_campaign: "120200",
  utm_content: "R-2645-A",
};

function args(over: Record<string, unknown> = {}) {
  return {
    p_parent_name: "Çok Platform Veli",
    p_phone: nextPhone(),
    p_gclid: "",
    p_utm: {},
    p_landing_path: "/kayit",
    p_consent_at: new Date().toISOString(),
    p_meta: {},
    ...over,
  };
}

async function newLead(over: Record<string, unknown> = {}) {
  const { data, error } = await admin.rpc("create_web_lead", args(over));
  expect(error).toBeNull();
  const id = (data as { lead_id: string }).lead_id;
  const { data: lead } = await admin.from("leads").select("*").eq("id", id).single();
  return lead!;
}

async function uploadsFor(leadId: string) {
  const { data } = await admin
    .from("conversion_uploads")
    .select("*")
    .eq("lead_id", leadId)
    .order("conversion_action");
  return data ?? [];
}

let dan: SupabaseClient;

beforeAll(async () => {
  dan = await clientFor("danisman@test.local");
});

afterAll(async () => {
  await admin.from("leads").delete().like("phone", `${PREFIX}%`);
  await admin.from("ad_spend_daily").delete().eq("date", SPEND_DATE);
});

describe("çok platform: web başvurusu", () => {
  it("instagram reklam UTM'si meta platformu ve Lead kuyruğu açar", async () => {
    const lead = await newLead({
      p_utm: metaUtm,
      p_meta: {
        fbclid: "IwAR1",
        fbc: "fb.1.1760000000000.IwAR1",
        fbp: "fb.1.1760000000000.123",
        meta_event_id: "ev-1",
        consent_version: 2,
        ad_cookie_consent: true,
      },
    });
    expect(lead.source).toBe("instagram");
    expect(lead.ad_platform).toBe("meta");
    expect(lead.fbc).toBe("fb.1.1760000000000.IwAR1");
    expect(lead.consent_version).toBe(2);
    expect(lead.content_code).toBe("R-2645-A");
    const ups = await uploadsFor(lead.id);
    expect(ups).toHaveLength(1);
    expect(ups[0]).toMatchObject({
      platform: "meta",
      conversion_action: "lead",
      event_id: "ev-1",
      click_id_type: "fbc",
      status: "bekliyor",
    });
  });

  it("yalnız fbclid organik instagram sayılır", async () => {
    const lead = await newLead({ p_meta: { fbclid: "X" } });
    expect(lead.source).toBe("instagram");
    expect(lead.ad_platform).toBeNull();
    expect(await uploadsFor(lead.id)).toHaveLength(0);
  });

  it("gclid her zaman Google kazanır", async () => {
    const lead = await newLead({ p_gclid: "G-1", p_utm: metaUtm, p_meta: { fbclid: "Y" } });
    expect(lead.source).toBe("reklam");
    expect(lead.ad_platform).toBe("google");
    const ups = await uploadsFor(lead.id);
    expect(ups.filter((u) => u.platform === "meta")).toHaveLength(0);
  });

  it("mükerrer başvuru meta alanlarını ezmez", async () => {
    const phone = nextPhone();
    const first = await newLead({
      p_phone: phone,
      p_utm: metaUtm,
      p_meta: { fbc: "fb.1.1.A", meta_event_id: "ev-a", consent_version: 2, ad_cookie_consent: true },
    });
    await newLead({
      p_phone: phone,
      p_utm: metaUtm,
      p_meta: { fbc: "fb.1.1.B", meta_event_id: "ev-b", consent_version: 3, ad_cookie_consent: false },
    });
    const { data: after } = await admin.from("leads").select("*").eq("id", first.id).single();
    expect(after!.fbc).toBe("fb.1.1.A");
    expect(after!.meta_event_id).toBe("ev-a");
    expect(after!.consent_version).toBe(2);
    expect(after!.ad_cookie_consent).toBe(true);
    expect(after!.ad_platform).toBe("meta");
    const ups = (await uploadsFor(first.id)).filter((u) => u.conversion_action === "lead");
    expect(ups).toHaveLength(1);
  });
});

describe("çok platform: kuyruk", () => {
  it("randevuya geçen meta velisi Schedule satırı açar, Google satırı açmaz", async () => {
    const lead = await newLead({ p_utm: metaUtm, p_meta: { fbc: "fb.1.1.C", meta_event_id: "ev-c" } });
    const { error } = await admin.from("leads").update({ status: "randevu" }).eq("id", lead.id);
    expect(error).toBeNull();
    const ups = await uploadsFor(lead.id);
    const sched = ups.find((u) => u.conversion_action === "randevu");
    expect(sched).toMatchObject({
      platform: "meta",
      event_id: `${lead.id}:schedule`,
      click_id_type: "fbc",
      status: "bekliyor",
    });
    expect(ups.filter((u) => u.platform === "google")).toHaveLength(0);
  });

  it("Google velisinin kuyruğu değişmedi", async () => {
    const lead = await newLead({ p_gclid: "G-2" });
    const { error } = await admin.from("leads").update({ status: "kazanildi" }).eq("id", lead.id);
    expect(error).toBeNull();
    const ups = (await uploadsFor(lead.id)).filter((u) => u.platform === "google");
    expect(ups.map((u) => u.conversion_action).sort()).toEqual(["kayit", "randevu"]);
    for (const u of ups) {
      expect(u.click_id_type).toBe("gclid");
      expect(u.status).toBe("bekliyor");
    }
  });
});

describe("çok platform: harcama", () => {
  it("ad_spend_daily aynı kampanya kimliği iki platformda ayrı satır", async () => {
    const base = { date: SPEND_DATE, campaign_id: "c1", campaign_name: "K", cost_micros: 5, clicks: 1, impressions: 2 };
    const g = await admin
      .from("ad_spend_daily")
      .insert({ ...base, platform: "google", level: "campaign", object_id: "1" });
    expect(g.error).toBeNull();
    const m = await admin
      .from("ad_spend_daily")
      .insert({ ...base, platform: "meta", level: "ad", object_id: "1" });
    expect(m.error).toBeNull();
    const { data } = await admin.from("ad_spend_daily").select("platform").eq("date", SPEND_DATE);
    expect((data ?? []).map((r) => r.platform).sort()).toEqual(["google", "meta"]);
  });

  it("danışman ad_spend_daily ve conversion_uploads okuyamaz", async () => {
    const a = await dan.from("ad_spend_daily").select("date");
    expect(a.data ?? []).toHaveLength(0);
    const b = await dan.from("conversion_uploads").select("id");
    expect(b.data ?? []).toHaveLength(0);
  });
});
