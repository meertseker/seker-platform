import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const YON_ID = "00000000-0000-0000-0000-000000000001";
const DAN_ID = "00000000-0000-0000-0000-000000000002";

// Her test kendi numarasını kullanır; temizlik bu önekle yapılır.
const PREFIX = "+90500777";
let seq = 0;
const nextPhone = () => `${PREFIX}${String(++seq).padStart(4, "0")}`;

function args(over: Record<string, unknown> = {}) {
  return {
    p_parent_name: "Web Test Veli",
    p_phone: nextPhone(),
    p_gclid: "",
    p_utm: {},
    p_landing_path: "/kayit",
    p_consent_at: new Date().toISOString(),
    ...over,
  };
}

async function notificationsFor(leadId: string) {
  const { data } = await admin
    .from("notifications")
    .select("user_id, type, payload")
    .eq("type", "web_basvuru")
    .eq("payload->>leadId", leadId);
  return data ?? [];
}

async function eventsFor(leadId: string, type: string) {
  const { data } = await admin
    .from("events")
    .select("id, payload")
    .eq("entity_type", "lead")
    .eq("entity_id", leadId)
    .eq("event_type", type);
  return data ?? [];
}

let dan: SupabaseClient;

beforeAll(async () => {
  dan = await clientFor("danisman@test.local");
  await admin.from("app_settings").update({ value: "" }).eq("key", "web_lead_assignee");
});

afterAll(async () => {
  const { data } = await admin.from("leads").select("id").like("phone", `${PREFIX}%`);
  const ids = (data ?? []).map((l) => l.id);
  for (const id of ids) {
    await admin.from("notifications").delete().eq("payload->>leadId", id);
  }
  await admin.from("leads").delete().like("phone", `${PREFIX}%`);
  await admin.from("app_settings").update({ value: "" }).eq("key", "web_lead_assignee");
});

describe("create_web_lead yetkileri", () => {
  it("publishable anahtarla (ziyaretçi) çağrılamaz", async () => {
    const anon = createClient(url, publishable, { auth: { persistSession: false } });
    const { error } = await anon.rpc("create_web_lead", args());
    expect(error).not.toBeNull();
  });

  it("giriş yapmış personel de doğrudan çağıramaz", async () => {
    const { error } = await dan.rpc("create_web_lead", args());
    expect(error).not.toBeNull();
  });
});

describe("create_web_lead davranışı (service role)", () => {
  it("yeni veli için 'yeni' durumunda web_sitesi kaynaklı lead, olay ve yönetici bildirimi oluşturur", async () => {
    const a = args({ p_landing_path: "/iletisim" });
    const { data, error } = await admin.rpc("create_web_lead", a);
    expect(error).toBeNull();
    expect(data.duplicate).toBe(false);

    const { data: lead } = await admin.from("leads").select("*").eq("id", data.lead_id).single();
    expect(lead.source).toBe("web_sitesi");
    expect(lead.status).toBe("yeni");
    expect(lead.phone).toBe(a.p_phone);
    expect(lead.landing_path).toBe("/iletisim");
    expect(lead.source_detail).toBe("/iletisim");
    expect(lead.consent_at).not.toBeNull();
    expect(lead.assigned_to).toBeNull();

    expect(await eventsFor(data.lead_id, "web_basvuru")).toHaveLength(1);
    const notes = await notificationsFor(data.lead_id);
    expect(notes.map((n) => n.user_id)).toContain(YON_ID);
    expect(notes.map((n) => n.user_id)).not.toContain(DAN_ID);
  });

  it("gclid varsa kaynak 'reklam' olur, gclid ve kampanya saklanır", async () => {
    const { data } = await admin.rpc(
      "create_web_lead",
      args({ p_gclid: "Cj0TEST", p_utm: { utm_source: "google", utm_campaign: "beylikduzu" }, p_landing_path: "/lp/beylikduzu-anaokulu" }),
    );
    const { data: lead } = await admin.from("leads").select("*").eq("id", data.lead_id).single();
    expect(lead.source).toBe("reklam");
    expect(lead.gclid).toBe("Cj0TEST");
    expect(lead.utm_source).toBe("google");
    expect(lead.utm_campaign).toBe("beylikduzu");
    expect(lead.source_detail).toBe("beylikduzu");
  });

  it("aynı telefonla açık lead varsa yeni kart açmaz; olay yazar, 10 dk içinde ikinci bildirim atmaz", async () => {
    const a = args();
    const first = await admin.rpc("create_web_lead", a);
    const second = await admin.rpc("create_web_lead", { ...a, p_gclid: "Cj0LATER" });
    expect(second.error).toBeNull();
    expect(second.data.duplicate).toBe(true);
    expect(second.data.lead_id).toBe(first.data.lead_id);

    const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("phone", a.p_phone);
    expect(count).toBe(1);
    expect(await eventsFor(first.data.lead_id, "web_tekrar_basvuru")).toHaveLength(1);
    expect(await notificationsFor(first.data.lead_id)).toHaveLength(1);

    // Önceden gclid'i olmayan karta sonradan gelen gclid eklenir (offline dönüşüm için).
    const { data: lead } = await admin.from("leads").select("gclid").eq("id", first.data.lead_id).single();
    if (!lead) throw new Error("lead bulunamadı");
    expect(lead.gclid).toBe("Cj0LATER");
  });

  it("aynı telefonun lead'i kaybedildi ise yeni lead açar", async () => {
    const a = args();
    await admin.from("leads").insert({
      parent_name: "Eski Veli", phone: a.p_phone, source: "referans",
      status: "kaybedildi", lost_reason: "fiyat",
    });
    const { data, error } = await admin.rpc("create_web_lead", a);
    expect(error).toBeNull();
    expect(data.duplicate).toBe(false);
    const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("phone", a.p_phone);
    expect(count).toBe(2);
  });

  it("çok uzun utm ve gclid değerlerini 200 karaktere kırpar", async () => {
    const { data, error } = await admin.rpc(
      "create_web_lead",
      args({ p_gclid: "g".repeat(300), p_utm: { utm_campaign: "c".repeat(1000), utm_bogus: "x" } }),
    );
    expect(error).toBeNull();
    const { data: lead } = await admin.from("leads").select("gclid, utm_campaign, web_payload").eq("id", data.lead_id).single();
    if (!lead) throw new Error("lead bulunamadı");
    expect(lead.gclid).toHaveLength(200);
    expect(lead.utm_campaign).toHaveLength(200);
    expect(lead.web_payload.utm).not.toHaveProperty("utm_bogus");
  });

  it("E.164 olmayan telefonu ve boş adı reddeder", async () => {
    expect((await admin.rpc("create_web_lead", args({ p_phone: "05301018875" }))).error).not.toBeNull();
    expect((await admin.rpc("create_web_lead", args({ p_phone: "+902122223344" }))).error).not.toBeNull();
    expect((await admin.rpc("create_web_lead", args({ p_parent_name: " " }))).error).not.toBeNull();
    expect((await admin.rpc("create_web_lead", args({ p_consent_at: null }))).error).not.toBeNull();
  });

  it("web_lead_assignee ayarlıysa lead'i ona atar ve ona da bildirir", async () => {
    await admin.from("app_settings").update({ value: DAN_ID }).eq("key", "web_lead_assignee");
    const { data } = await admin.rpc("create_web_lead", args());
    const { data: lead } = await admin.from("leads").select("assigned_to").eq("id", data.lead_id).single();
    if (!lead) throw new Error("lead bulunamadı");
    expect(lead.assigned_to).toBe(DAN_ID);
    const users = (await notificationsFor(data.lead_id)).map((n) => n.user_id);
    expect(users).toEqual(expect.arrayContaining([YON_ID, DAN_ID]));
    await admin.from("app_settings").update({ value: "" }).eq("key", "web_lead_assignee");
  });

  it("p_meta.silent ile bildirim üretmez, p_meta web_payload'a yazılır", async () => {
    const { data } = await admin.rpc("create_web_lead", args({ p_meta: { silent: true, old_web_lead_id: "old-1" } }));
    expect(await notificationsFor(data.lead_id)).toHaveLength(0);
    const { data: lead } = await admin.from("leads").select("web_payload").eq("id", data.lead_id).single();
    if (!lead) throw new Error("lead bulunamadı");
    expect(lead.web_payload.old_web_lead_id).toBe("old-1");
    expect(lead.web_payload).not.toHaveProperty("silent");
  });

  it("p_meta.consent_scope web_payload'a taşınır", async () => {
    const { data } = await admin.rpc("create_web_lead", args({ p_meta: { silent: true, consent_scope: "arama" } }));
    const { data: lead } = await admin.from("leads").select("web_payload").eq("id", data.lead_id).single();
    if (!lead) throw new Error("lead bulunamadı");
    expect(lead.web_payload.consent_scope).toBe("arama");
  });
});
