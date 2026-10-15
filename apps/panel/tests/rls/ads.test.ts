import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const DAN_ID = "00000000-0000-0000-0000-000000000002";
let yon: SupabaseClient;
let dan: SupabaseClient;

async function makeLead(fields: Record<string, unknown>) {
  const { data, error } = await admin
    .from("leads")
    .insert({ parent_name: "Ads Test Veli", phone: `+90555${Math.floor(1000000 + Math.random() * 8999999)}`, source: "reklam", assigned_to: DAN_ID, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

async function uploadTimes(leadId: string) {
  const { data } = await admin.from("conversion_uploads").select("conversion_at").eq("lead_id", leadId);
  return (data ?? []).map((r) => new Date(r.conversion_at as string).getTime());
}

async function uploadsFor(leadId: string) {
  const { data } = await admin
    .from("conversion_uploads")
    .select("conversion_action, status, error, value, gclid")
    .eq("lead_id", leadId)
    .order("conversion_action");
  return data ?? [];
}

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
});

afterAll(async () => {
  const { data } = await admin.from("leads").select("id").eq("parent_name", "Ads Test Veli");
  const ids = (data ?? []).map((l) => l.id as string);
  if (ids.length) {
    await admin.from("offers").delete().in("lead_id", ids);
    await admin.from("events").delete().eq("entity_type", "lead").in("entity_id", ids);
    await admin.from("leads").delete().in("id", ids);
  }
});

describe("conversion_uploads kuyruğu", () => {
  it("danışman randevuya aldığında gclid'li aday için 'bekliyor' satırı oluşur", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-1" });
    const { error } = await dan.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(error).toBeNull();
    expect(await uploadsFor(id)).toEqual([
      { conversion_action: "randevu", status: "bekliyor", error: null, value: null, gclid: "TEST-GCLID-1" },
    ]);
  });

  it("tekrar randevu ikinci satır üretmez", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-2" });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    await admin.from("leads").update({ status: "ulasildi" }).eq("id", id);
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toHaveLength(1);
  });

  it("reklam kaynaklı ama gclid'siz aday 'atlandi' olur", async () => {
    const id = await makeLead({ gclid: null });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "gclid yok" }]);
  });

  it("reklamsız ve gclid'siz aday için satır yazılmaz", async () => {
    const id = await makeLead({ source: "referans", gclid: null });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toHaveLength(0);
  });

  it("89 günden eski aday 'atlandi' olur", async () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    const id = await makeLead({ gclid: "TEST-GCLID-OLD", created_at: old });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "tıklama 90 günden eski" }]);
  });

  it("kazanıldı satırı onaylı teklifin aylık ücretini değer olarak alır", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-3" });
    const { error: offerError } = await admin.from("offers").insert({
      lead_id: id, created_by: DAN_ID, program: "tam_gun", list_price: 22000,
      offered_price: 19500, status: "onaylandi", decided_at: new Date().toISOString(),
    });
    expect(offerError).toBeNull();
    await admin.from("leads").update({ status: "kazanildi" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([
      { conversion_action: "kayit", status: "bekliyor", value: 19500 },
      { conversion_action: "randevu", status: "bekliyor", value: null },
    ]);
  });

  it("eski aktarım (old_web_lead_id) adayı atlandi olur", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-IMP", web_payload: { old_web_lead_id: "x1", gclid: "TEST-GCLID-IMP" } });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "onay yalnızca arama için" }]);
  });

  it("consent_scope=arama adayı atlandi olur", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-ARAMA", web_payload: { consent_scope: "arama" } });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "onay yalnızca arama için" }]);
  });

  it("doğrudan teklife geçen aday randevu satırı alır", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-5" });
    await admin.from("leads").update({ status: "teklif" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ conversion_action: "randevu", status: "bekliyor" }]);
  });

  it("kazanıldı hem randevu hem kayit satırı üretir", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-6" });
    await admin.from("leads").update({ status: "kazanildi" }).eq("id", id);
    const rows = await uploadsFor(id);
    expect(rows.map((r) => r.conversion_action)).toEqual(["kayit", "randevu"]);
    expect(rows.every((r) => r.status === "bekliyor")).toBe(true);
  });

  it("sonradan gclid gelirse 'gclid yok' satırı sonraki durum değişiminde bekliyor olur", async () => {
    const id = await makeLead({ gclid: null });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "gclid yok" }]);
    await admin.from("leads").update({ gclid: "TEST-GCLID-LATE" }).eq("id", id);
    await admin.from("leads").update({ status: "gorusme_yapildi" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([
      { conversion_action: "randevu", status: "bekliyor", error: null, gclid: "TEST-GCLID-LATE" },
    ]);
  });

  it("revive: conversion_at yeni zamana ve değer onaylı teklife güncellenir", async () => {
    const id = await makeLead({ gclid: null });
    await admin.from("leads").update({ status: "kazanildi" }).eq("id", id);
    const before = await uploadsFor(id);
    expect(before.every((r) => r.status === "atlandi" && r.error === "gclid yok")).toBe(true);
    const oldAt = Math.max(...(await uploadTimes(id)));
    await admin.from("offers").insert({
      lead_id: id, created_by: DAN_ID, program: "tam_gun", list_price: 22000,
      offered_price: 18000, status: "onaylandi", decided_at: new Date().toISOString(),
    });
    await admin.from("leads").update({ gclid: "TEST-GCLID-REVIVE" }).eq("id", id);
    await admin.from("leads").update({ status: "teklif" }).eq("id", id);
    await admin.from("leads").update({ status: "kazanildi" }).eq("id", id);
    const after = await uploadsFor(id);
    expect(after).toMatchObject([
      { conversion_action: "kayit", status: "bekliyor", error: null, value: 18000 },
      { conversion_action: "randevu", status: "bekliyor", error: null },
    ]);
    for (const t of await uploadTimes(id)) expect(t).toBeGreaterThan(oldAt);
  });

  it("89 günden eski aday 'atlandi' olur", async () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    const id = await makeLead({ gclid: "TEST-GCLID-OLD", created_at: old });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "tıklama 90 günden eski" }]);
  });

  it("kazanıldı satırı onaylı teklifin aylık ücretini değer olarak alır", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-3" });
    const { error: offerError } = await admin.from("offers").insert({
      lead_id: id, created_by: DAN_ID, program: "tam_gun", list_price: 22000,
      offered_price: 19500, status: "onaylandi", decided_at: new Date().toISOString(),
    });
    expect(offerError).toBeNull();
    await admin.from("leads").update({ status: "kazanildi" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([
      { conversion_action: "kayit", status: "bekliyor", value: 19500 },
      { conversion_action: "randevu", status: "bekliyor", value: null },
    ]);
  });

  it("eski aktarım (old_web_lead_id) adayı atlandi olur", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-IMP", web_payload: { old_web_lead_id: "x1", gclid: "TEST-GCLID-IMP" } });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "onay yalnızca arama için" }]);
  });

  it("consent_scope=arama adayı atlandi olur", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-ARAMA", web_payload: { consent_scope: "arama" } });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "onay yalnızca arama için" }]);
  });

  it("doğrudan teklife geçen aday randevu satırı alır", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-5" });
    await admin.from("leads").update({ status: "teklif" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ conversion_action: "randevu", status: "bekliyor" }]);
  });

  it("kazanıldı hem randevu hem kayit satırı üretir", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-6" });
    await admin.from("leads").update({ status: "kazanildi" }).eq("id", id);
    const rows = await uploadsFor(id);
    expect(rows.map((r) => r.conversion_action)).toEqual(["kayit", "randevu"]);
    expect(rows.every((r) => r.status === "bekliyor")).toBe(true);
  });

  it("sonradan gclid gelirse 'gclid yok' satırı sonraki durum değişiminde bekliyor olur", async () => {
    const id = await makeLead({ gclid: null });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "gclid yok" }]);
    await admin.from("leads").update({ gclid: "TEST-GCLID-LATE" }).eq("id", id);
    await admin.from("leads").update({ status: "gorusme_yapildi" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([
      { conversion_action: "randevu", status: "bekliyor", error: null, gclid: "TEST-GCLID-LATE" },
    ]);
  });

  it("revive: conversion_at yeni zamana ve değer onaylı teklife güncellenir", async () => {
    const id = await makeLead({ gclid: null });
    await admin.from("leads").update({ status: "kazanildi" }).eq("id", id);
    const before = await uploadsFor(id);
    expect(before.every((r) => r.status === "atlandi" && r.error === "gclid yok")).toBe(true);
    const oldAt = Math.max(...(await uploadTimes(id)));
    await admin.from("offers").insert({
      lead_id: id, created_by: DAN_ID, program: "tam_gun", list_price: 22000,
      offered_price: 18000, status: "onaylandi", decided_at: new Date().toISOString(),
    });
    await admin.from("leads").update({ gclid: "TEST-GCLID-REVIVE" }).eq("id", id);
    await admin.from("leads").update({ status: "teklif" }).eq("id", id);
    await admin.from("leads").update({ status: "kazanildi" }).eq("id", id);
    const after = await uploadsFor(id);
    expect(after).toMatchObject([
      { conversion_action: "kayit", status: "bekliyor", error: null, value: 18000 },
      { conversion_action: "randevu", status: "bekliyor", error: null },
    ]);
    for (const t of await uploadTimes(id)) expect(t).toBeGreaterThan(oldAt);
  });

  it("revive: arama kapsamlı/aktarılmış aday asla bekliyor olmaz", async () => {
    const id = await makeLead({ gclid: null, web_payload: { old_web_lead_id: "x9" } });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "onay yalnızca arama için" }]);
    await admin.from("leads").update({ gclid: "TEST-GCLID-IMP2" }).eq("id", id);
    await admin.from("leads").update({ status: "gorusme_yapildi" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "onay yalnızca arama için" }]);
  });

  it("89 gün kontrolü olay (event) tıklama zamanını kullanır", async () => {
    // Kayıt yeni, ama gclid'li ilk başvuru olayı 100 gün önce.
    const id = await makeLead({ gclid: "TEST-GCLID-EV" });
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    const { error } = await admin.from("events").insert({
      entity_type: "lead", entity_id: id, event_type: "web_basvuru", payload: { gclid: "TEST-GCLID-EV" }, created_at: old,
    });
    expect(error).toBeNull();
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "atlandi", error: "tıklama 90 günden eski" }]);
  });

  it("eski kayıt ama taze gclid'li olay: bekliyor", async () => {
    const oldCreated = new Date(Date.now() - 100 * 86400000).toISOString();
    const id = await makeLead({ gclid: "TEST-GCLID-EV2", created_at: oldCreated });
    const { error } = await admin.from("events").insert({
      entity_type: "lead", entity_id: id, event_type: "web_tekrar_basvuru", payload: { gclid: "TEST-GCLID-EV2" },
    });
    expect(error).toBeNull();
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);
    expect(await uploadsFor(id)).toMatchObject([{ status: "bekliyor", error: null }]);
  });
});

describe("RLS", () => {
  it("yönetici okur, danışman okuyamaz, kimse yazamaz", async () => {
    const id = await makeLead({ gclid: "TEST-GCLID-4" });
    await admin.from("leads").update({ status: "randevu" }).eq("id", id);

    const yonRead = await yon.from("conversion_uploads").select("id").eq("lead_id", id);
    expect(yonRead.data).toHaveLength(1);

    const danRead = await dan.from("conversion_uploads").select("id").eq("lead_id", id);
    expect(danRead.data).toEqual([]);

    const yonWrite = await yon.from("ad_spend_daily").insert({
      date: "2026-10-01", campaign_id: "1", campaign_name: "x", cost_micros: 1, clicks: 0, impressions: 0,
    });
    expect(yonWrite.error).not.toBeNull();

    const spendRead = await dan.from("ad_spend_daily").select("date");
    expect(spendRead.data).toEqual([]);
  });
});
