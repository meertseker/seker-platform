import { describe, it, expect, beforeAll } from "vitest";
import { clientFor, admin } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

let yon: SupabaseClient, dan: SupabaseClient;
let leadId: string, offerId: string, instId: string, eventId: string;
const DAN_ID = "00000000-0000-0000-0000-000000000002";

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
  // Fixture'lar service key ile kurulur
  const { data: lead } = await admin.from("leads").insert({
    parent_name: "RLS Test Veli", phone: "+905000000001",
    source: "referans", assigned_to: DAN_ID,
  }).select().single();
  leadId = lead!.id;
  const { data: offer } = await admin.from("offers").insert({
    lead_id: leadId, created_by: DAN_ID, program: "tam_gun",
    list_price: 22000, offered_price: 18000, status: "onay_bekliyor",
  }).select().single();
  offerId = offer!.id;
  const { data: student } = await admin.from("students").insert({
    full_name: "RLS Öğrenci", parent_name: "RLS Test Veli",
    phone: "+905000000001", season: "2026-2027", program: "tam_gun",
  }).select().single();
  const { data: plan } = await admin.from("payment_plans").insert({
    student_id: student!.id, season: "2026-2027", item_type: "aidat",
    total_amount: 180000, installment_count: 1,
  }).select().single();
  const { data: inst } = await admin.from("installments").insert({
    plan_id: plan!.id, due_date: "2026-09-01", amount: 180000,
    status: "odendi", paid_at: new Date().toISOString(), paid_amount: 180000,
    payment_method: "havale", marked_by: DAN_ID,
  }).select().single();
  instId = inst!.id;
  const { data: ev } = await admin.from("events").insert({
    entity_type: "lead", entity_id: leadId, event_type: "durum_degisti",
  }).select().single();
  eventId = ev!.id;
});

describe("RLS", () => {
  it("danışman teklif onaylayamaz", async () => {
    const { data, error } = await dan.from("offers")
      .update({ status: "onaylandi" }).eq("id", offerId).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
  it("yönetici teklif onaylayabilir", async () => {
    const { data, error } = await yon.from("offers")
      .update({ status: "onaylandi", decided_by: "00000000-0000-0000-0000-000000000001", decided_at: new Date().toISOString() })
      .eq("id", offerId).select();
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });
  it("danışman ödenmiş taksiti geri alamaz", async () => {
    const { data, error } = await dan.from("installments")
      .update({ status: "bekliyor", paid_at: null, paid_amount: null, payment_method: null, marked_by: null })
      .eq("id", instId).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
  it("danışman fiyat listesi değiştiremez", async () => {
    const { data } = await dan.from("price_list_items")
      .update({ monthly_fee: 1 }).eq("program", "tam_gun").select();
    expect(data).toEqual([]);
  });
  it("events UPDATE herkese kapalı (yönetici dahil)", async () => {
    const { data } = await yon.from("events")
      .update({ event_type: "degistirildi" }).eq("id", eventId).select();
    expect(data).toEqual([]);
  });
  it("events DELETE herkese kapalı", async () => {
    const { data } = await yon.from("events").delete().eq("id", eventId).select();
    expect(data).toEqual([]);
  });
  it("kaybedildi durumu lost_reason olmadan yazılamaz (CHECK)", async () => {
    const { error } = await yon.from("leads")
      .update({ status: "kaybedildi" }).eq("id", leadId);
    expect(error).not.toBeNull();
  });
  it("aynı lead'e ikinci onay_bekliyor teklif eklenemez (partial unique)", async () => {
    await admin.from("offers").insert({
      lead_id: leadId, created_by: DAN_ID, program: "tam_gun",
      list_price: 22000, offered_price: 19000, status: "onay_bekliyor",
    });
    const { error } = await admin.from("offers").insert({
      lead_id: leadId, created_by: DAN_ID, program: "tam_gun",
      list_price: 22000, offered_price: 20000, status: "onay_bekliyor",
    });
    expect(error).not.toBeNull();
  });
});
