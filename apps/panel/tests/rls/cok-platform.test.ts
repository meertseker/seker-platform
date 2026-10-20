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
    const lead = await newLead({ p_utm: metaUtm, p_meta: { fbc: "fb.1.1.C", meta_event_id: "ev-c", consent_version: 2 } });
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

describe("çok platform: final düzeltmeleri", () => {
  const LONG_FBCLID = "IwAR" + "aB9_-".repeat(59) + "Zz"; // 301 karakter

  it("tarayıcı bilgisi (client_user_agent) yeni velide yazılır, mükerrerde boşsa doldurulur, doluysa ezilmez (I-2)", async () => {
    const lead = await newLead({ p_utm: metaUtm, p_meta: { ad_cookie_consent: true, client_user_agent: "UA-ILK" } });
    expect(lead.client_user_agent).toBe("UA-ILK");
    await newLead({ p_phone: lead.phone, p_utm: metaUtm, p_meta: { client_user_agent: "UA-IKINCI" } });
    const { data: after } = await admin.from("leads").select("client_user_agent").eq("id", lead.id).single();
    expect(after!.client_user_agent).toBe("UA-ILK");

    const bos = await newLead({ p_utm: metaUtm, p_meta: {} });
    expect(bos.client_user_agent).toBeNull();
    await newLead({ p_phone: bos.phone, p_utm: metaUtm, p_meta: { client_user_agent: "UA-SONRA" } });
    const { data: filled } = await admin.from("leads").select("client_user_agent").eq("id", bos.id).single();
    expect(filled!.client_user_agent).toBe("UA-SONRA");
  });

  it("client_user_agent 400 karakterde kesilir ve olay yüküne kopyalanmaz (I-2)", async () => {
    const lead = await newLead({ p_utm: metaUtm, p_meta: { client_user_agent: "u".repeat(700) } });
    expect(lead.client_user_agent).toHaveLength(400);
    expect(JSON.stringify(lead.web_payload)).not.toContain("uuuu");
  });

  it("meta listPending velinin tarayıcı bilgisini döner (I-2)", async () => {
    const { supabaseMetaStore } = await import("@/lib/ads/store");
    const lead = await newLead({
      p_utm: metaUtm,
      p_meta: { meta_event_id: "ev-ua", consent_version: 2, ad_cookie_consent: true, client_user_agent: "UA-LIST" },
    });
    const list = await supabaseMetaStore(admin).listPending(1000);
    const mine = list.find((p) => p.leadId === lead.id);
    expect(mine?.lead.clientUserAgent).toBe("UA-LIST");
  });

  it("300 karakterlik fbclid ve fbc create_web_lead'den değişmeden geçer (I-4)", async () => {
    const fbc = `fb.1.1760000000000.${LONG_FBCLID}`;
    const lead = await newLead({ p_utm: metaUtm, p_meta: { fbclid: LONG_FBCLID, fbc } });
    expect(lead.fbclid).toBe(LONG_FBCLID);
    expect(lead.fbc).toBe(fbc);
    const long = await newLead({ p_meta: { fbclid: "f".repeat(700), fbc: "c".repeat(700), fbp: "p".repeat(700) } });
    expect(long.fbclid).toHaveLength(500);
    expect(long.fbc).toHaveLength(500);
    expect(long.fbp).toHaveLength(200);
  });

  it("platformsuz (organik) velinin aşaması hiç kuyruk satırı açmaz (M-1)", async () => {
    const lead = await newLead({ p_meta: { fbclid: "ORG" } });
    expect(lead.ad_platform).toBeNull();
    const { error } = await admin.from("leads").update({ status: "randevu" }).eq("id", lead.id);
    expect(error).toBeNull();
    expect(await uploadsFor(lead.id)).toHaveLength(0);
  });

  it("sonradan gclid alan meta velisi yalnız Google'a bildirilir (M-2)", async () => {
    const lead = await newLead({ p_utm: metaUtm, p_meta: { fbc: "fb.1.1.M2", meta_event_id: "ev-m2" } });
    expect(lead.ad_platform).toBe("meta");
    const g = await admin.from("leads").update({ gclid: "G-SONRA" }).eq("id", lead.id);
    expect(g.error).toBeNull();
    const { error } = await admin.from("leads").update({ status: "randevu" }).eq("id", lead.id);
    expect(error).toBeNull();
    const ups = (await uploadsFor(lead.id)).filter((u) => u.conversion_action === "randevu");
    expect(ups.map((u) => u.platform)).toEqual(["google"]);
  });
});

describe("çok platform: eski onay sürümü kuyruğu (C-3)", () => {
  const REASON = "onay sürümü eski (Meta yok)";

  it.each([[{}], [{ consent_version: 1 }]])("v2 olmayan Meta velisinin Lead satırı atlandi açılır (%j)", async (extra) => {
    const lead = await newLead({ p_utm: metaUtm, p_meta: { meta_event_id: "ev-c3", ...extra } });
    const ups = await uploadsFor(lead.id);
    expect(ups).toHaveLength(1);
    expect(ups[0]).toMatchObject({ platform: "meta", conversion_action: "lead", status: "atlandi", error: REASON });
  });

  it("v2 olmayan Meta velisinin Schedule/Enrolled satırları atlandi açılır", async () => {
    const lead = await newLead({ p_utm: metaUtm, p_meta: { consent_version: 1 } });
    const { error } = await admin.from("leads").update({ status: "kazanildi" }).eq("id", lead.id);
    expect(error).toBeNull();
    const stages = (await uploadsFor(lead.id)).filter((u) => u.conversion_action !== "lead");
    expect(stages.map((u) => u.conversion_action).sort()).toEqual(["kayit", "randevu"]);
    for (const u of stages) expect(u).toMatchObject({ platform: "meta", status: "atlandi", error: REASON });
  });

  it("v2 Meta velisinin satırları bekliyor açılır", async () => {
    const lead = await newLead({ p_utm: metaUtm, p_meta: { consent_version: 2 } });
    const { error } = await admin.from("leads").update({ status: "randevu" }).eq("id", lead.id);
    expect(error).toBeNull();
    const ups = await uploadsFor(lead.id);
    expect(ups.map((u) => u.status)).toEqual(["bekliyor", "bekliyor"]);
  });
});
