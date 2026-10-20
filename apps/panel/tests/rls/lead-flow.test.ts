import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

// Sunucu eylemi gerçek DB'ye karşı, danışmanın oturum istemcisiyle çalışır.
let current: SupabaseClient;
const DAN_ID = "00000000-0000-0000-0000-000000000002";
const DAN2_ID = "00000000-0000-0000-0000-000000000003";
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => current }));
vi.mock("@/lib/auth", () => ({
  getSessionProfile: async () => ({ id: DAN_ID, full_name: "Danışman (Test)", role: "danisman", can_edit_site: false }),
}));

import { claimLeadAs } from "@/lib/lead-flow/claim";
import { recordCall } from "@/actions/lead-flow";
import { loadCallQueue, loadFollowupTasks } from "@/lib/queries/call-queue";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/lead-flow/business-hours";

const PREFIX = "+90500666"; // web-leads.test.ts +90500777 kullanır; paralel silmeler çakışmasın
let seq = 0;
let danA: SupabaseClient, danB: SupabaseClient;

async function newLead(over: Record<string, unknown> = {}) {
  const { data, error } = await admin.from("leads").insert({
    parent_name: "Üstlenme Test Veli", phone: `${PREFIX}${String(++seq).padStart(4, "0")}`,
    source: "web_sitesi", ...over,
  }).select("id").single();
  expect(error).toBeNull();
  return data!.id as string;
}

beforeAll(async () => {
  danA = await clientFor("danisman@test.local");
  danB = await clientFor("danisman2@test.local");
});

afterAll(async () => {
  await admin.from("leads").delete().like("phone", `${PREFIX}%`);
});

describe("veli üstlenme", () => {
  it("iki danışman aynı anda üstlenirse yalnız biri kazanır", async () => {
    const id = await newLead();
    const results = await Promise.all([
      claimLeadAs(danA, id, DAN_ID, 15),
      claimLeadAs(danB, id, DAN2_ID, 15),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok);
    const { data: row } = await admin.from("leads").select("assigned_to, claimed_at").eq("id", id).single();
    expect([DAN_ID, DAN2_ID]).toContain(row!.assigned_to);
    expect(row!.claimed_at).not.toBeNull();
    expect(loser).toEqual({
      ok: false,
      claimedBy: row!.assigned_to === DAN_ID ? "Danışman (Test)" : "Danışman 2 (Test)",
    });
  });

  it("15 dakikayı geçmiş üstlenme başkasına açılır", async () => {
    const id = await newLead();
    expect(await claimLeadAs(danA, id, DAN_ID, 15)).toEqual({ ok: true, claimed: true });
    expect(await claimLeadAs(danB, id, DAN2_ID, 15)).toEqual({ ok: false, claimedBy: "Danışman (Test)" });
    await admin.from("leads")
      .update({ claimed_at: new Date(Date.now() - 16 * 60_000).toISOString() }).eq("id", id);
    expect(await claimLeadAs(danB, id, DAN2_ID, 15)).toEqual({ ok: true, claimed: true });
    const { data: row } = await admin.from("leads").select("assigned_to").eq("id", id).single();
    expect(row!.assigned_to).toBe(DAN2_ID);
  });

  it("otomatik atanmış ama kimsenin aramadığı veliyi başkası üstlenebilir", async () => {
    const id = await newLead({ assigned_to: DAN_ID });
    expect(await claimLeadAs(danB, id, DAN2_ID, 15)).toEqual({ ok: true, claimed: true });
    const { data: row } = await admin.from("leads").select("assigned_to, claimed_at").eq("id", id).single();
    expect(row!.assigned_to).toBe(DAN2_ID);
    expect(row!.claimed_at).not.toBeNull();
  });

  it("R24: üstlenme yalnız ilk teması yönetir; ilk temastan sonra takibi başkası da arar, veli sahibinde kalır", async () => {
    const claimedAt = new Date(Date.now() - 60_000).toISOString();
    const id = await newLead({ assigned_to: DAN_ID, first_contact_at: new Date(Date.now() - 3_600_000).toISOString(),
      claimed_at: claimedAt });
    expect(await claimLeadAs(danB, id, DAN2_ID, 15)).toEqual({ ok: true, claimed: false });
    expect(await claimLeadAs(danA, id, DAN_ID, 15)).toEqual({ ok: true, claimed: false });
    const { data: row } = await admin.from("leads").select("assigned_to, claimed_at").eq("id", id).single();
    expect(row!.assigned_to).toBe(DAN_ID);
    expect(new Date(row!.claimed_at).toISOString()).toBe(claimedAt);
  });

  it("R26: durumu yeni olmayan veli ilk temas boş olsa da üstlenilmez; sahibi değişmez", async () => {
    const id = await newLead({ assigned_to: DAN_ID, status: "ulasildi" });
    expect(await claimLeadAs(danB, id, DAN2_ID, 15)).toEqual({ ok: true, claimed: false });
    const { data: row } = await admin.from("leads").select("assigned_to, claimed_at, first_contact_at").eq("id", id).single();
    expect(row).toMatchObject({ assigned_to: DAN_ID, claimed_at: null, first_contact_at: null });
  });
});

describe("Takip aramaları listesi (R27)", () => {
  it("kapanmış ya da öğrenciye dönmüş velinin açık takip/geri görevi listelenmez", async () => {
    const open = await newLead({ assigned_to: DAN_ID, status: "ulasildi" });
    const won = await newLead({ assigned_to: DAN_ID, status: "kazanildi" });
    const lost = await newLead({ assigned_to: DAN_ID, status: "kaybedildi", lost_reason: "ulasilamadi" });
    const due = { due_date: "2026-10-20", due_at: "2026-10-20T07:00:00Z", auto_generated: true, assigned_to: DAN_ID };
    await admin.from("tasks").insert([
      { ...due, lead_id: open, title: "açık", rule_key: `takip:${open}:2` },
      { ...due, lead_id: won, title: "kazanıldı", rule_key: `takip:${won}:2` },
      { ...due, lead_id: lost, title: "kaybedildi", rule_key: `geri:${lost}` },
      { ...due, lead_id: lost, title: "kontenjan", rule_key: `kontenjan:${lost}` },
    ]);
    const items = await loadFollowupTasks(danA, DAN_ID, "danisman", "2026-10-20", new Date("2026-10-20T08:00:00Z"));
    const mine = items.filter((t) => [open, won, lost].includes(t.leadId ?? "")).map((t) => t.title);
    expect(mine.sort()).toEqual(["açık", "kontenjan"]);
  });
});

describe("arama kaydı", () => {
  it("ulaşıldığında açık takip görevleri kapanır", async () => {
    current = danA;
    const id = await newLead({ assigned_to: DAN_ID });
    const other = await newLead({ assigned_to: DAN_ID });
    const due = { due_date: "2026-11-03", due_at: "2026-11-03T10:00:00Z", auto_generated: true, assigned_to: DAN_ID };
    await admin.from("tasks").insert([
      { ...due, lead_id: id, title: "2. deneme", rule_key: `takip:${id}:2` },
      { ...due, lead_id: other, title: "başka veli", rule_key: `takip:${other}:2` },
    ]);

    const r = await recordCall({
      leadId: id, result: "geri_ara", quals: { age: true, area: true, timing: false, reached: true },
      note: "Akşam aranmak istiyor", callbackAt: "2026-11-04T17:00",
    });
    expect(r).toHaveProperty("done");

    const { data: tasks } = await admin.from("tasks").select("rule_key, status, due_at, assigned_to").in("lead_id", [id, other]);
    const byKey = Object.fromEntries((tasks ?? []).map((t) => [t.rule_key, t]));
    expect(byKey[`takip:${id}:2`].status).toBe("tamamlandi");
    expect(byKey[`takip:${other}:2`].status).toBe("acik");
    expect(byKey[`geri:${id}`]).toMatchObject({ status: "acik", assigned_to: DAN_ID });
    expect(new Date(byKey[`geri:${id}`].due_at).toISOString()).toBe(new Date("2026-11-04T17:00:00+03:00").toISOString());

    const { data: lead } = await admin.from("leads")
      .select("status, first_contact_at, q_reached, q_timing_ok, contact_note, assigned_to").eq("id", id).single();
    expect(lead).toMatchObject({ status: "ulasildi", q_reached: true, q_timing_ok: false, contact_note: "Akşam aranmak istiyor", assigned_to: DAN_ID });
    expect(lead!.first_contact_at).not.toBeNull();
    const { data: ev } = await admin.from("events").select("event_type").eq("entity_id", id).eq("event_type", "arama_kaydi");
    expect(ev).toHaveLength(1);
    const { data: notes } = await admin.from("lead_notes").select("body").eq("lead_id", id);
    expect(notes).toHaveLength(1);
  });
});

describe("takibi başka danışman arar (R24)", () => {
  it("ilk teması yapılmış veliyi arayan meslektaş veliyi devralmaz", async () => {
    current = danA; // oturum: DAN_ID; veli DAN2'nin
    const id = await newLead({ assigned_to: DAN2_ID, status: "ulasildi",
      first_contact_at: new Date(Date.now() - 86_400_000).toISOString() });
    await admin.from("tasks").insert({
      lead_id: id, title: "2. deneme", rule_key: `takip:${id}:2`, due_date: "2026-11-03",
      due_at: "2026-11-03T10:00:00Z", auto_generated: true, assigned_to: DAN2_ID,
    });
    const r = await recordCall({
      leadId: id, result: "geri_ara", quals: { age: true, area: true, timing: true, reached: true },
      callbackAt: "2026-11-05T11:00",
    });
    expect(r).toHaveProperty("done");
    const { data: lead } = await admin.from("leads").select("assigned_to").eq("id", id).single();
    expect(lead!.assigned_to).toBe(DAN2_ID);
    const { data: geri } = await admin.from("tasks").select("assigned_to").eq("rule_key", `geri:${id}`).single();
    expect(geri!.assigned_to).toBe(DAN2_ID);
  });

  it("sahibi olmayan veliyi arayan danışman sahibi olur", async () => {
    current = danA;
    const id = await newLead({ assigned_to: null, status: "ulasildi",
      first_contact_at: new Date(Date.now() - 86_400_000).toISOString() });
    const r = await recordCall({
      leadId: id, result: "geri_ara", quals: { age: true, area: true, timing: true, reached: true },
      callbackAt: "2026-11-05T11:00",
    });
    expect(r).toHaveProperty("done");
    const { data: lead } = await admin.from("leads").select("assigned_to").eq("id", id).single();
    expect(lead!.assigned_to).toBe(DAN_ID);
  });

  it("R26: durumu yeni olmayan, ilk teması boş veliyi arayan meslektaş devralmaz", async () => {
    current = danA;
    const id = await newLead({ assigned_to: DAN2_ID, status: "ulasildi" });
    const r = await recordCall({
      leadId: id, result: "geri_ara", quals: { age: true, area: true, timing: true, reached: true },
      callbackAt: "2026-11-05T11:00",
    });
    expect(r).toHaveProperty("done");
    const { data: lead } = await admin.from("leads").select("assigned_to, first_contact_at").eq("id", id).single();
    expect(lead!.assigned_to).toBe(DAN2_ID);
    expect(lead!.first_contact_at).not.toBeNull();
  });
});

describe("aday hattı açılışı (R23)", () => {
  it("açılıştan 20 gün önce gelen kanıtsız veli listede yok, 10 gün önce gelen var", async () => {
    const launchAt = new Date();
    const before = (d: number) => new Date(launchAt.getTime() - d * 86_400_000).toISOString();
    const old = await newLead({ created_at: before(20) });
    const recent = await newLead({ created_at: before(10) });
    const queue = await loadCallQueue(danA, DAN_ID, new Date(), {
      claimMinutes: 15, hours: DEFAULT_BUSINESS_HOURS, launchAt,
    });
    const ids = queue.map((l) => l.id);
    expect(ids).toContain(recent);
    expect(ids).not.toContain(old);
    // Açılış ayarı yoksa sınır uygulanmaz.
    const all = await loadCallQueue(danA, DAN_ID, new Date(), {
      claimMinutes: 15, hours: DEFAULT_BUSINESS_HOURS, launchAt: null,
    });
    expect(all.map((l) => l.id)).toEqual(expect.arrayContaining([old, recent]));
  });

  it("0014 açılış anını tohumlar", async () => {
    const { data } = await admin.from("app_settings").select("value").eq("key", "aday_hatti_acilis").single();
    expect(Number.isFinite(Date.parse(data!.value as string))).toBe(true);
  });
});
