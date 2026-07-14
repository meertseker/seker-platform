import { describe, it, expect, beforeAll } from "vitest";
import { clientFor, admin } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

let yon: SupabaseClient, dan: SupabaseClient;
let leadId: string, offerId: string, instId: string, eventId: string;
let rejectedOfferId: string, approvedOfferId: string, convertedLeadId: string;
let counterLeadId: string, counterOfferId: string;
let pendingInsertLeadId: string, autoApproveLeadId: string;
let familyStudentId: string;
const DAN_ID = "00000000-0000-0000-0000-000000000002";
const YON_ID = "00000000-0000-0000-0000-000000000001";

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
  familyStudentId = student!.id;
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

  // Sonlanmış teklif kilidi testleri için: reddedilmiş ve onaylanmış birer teklif
  const { data: rejectedOffer } = await admin.from("offers").insert({
    lead_id: leadId, created_by: DAN_ID, program: "tam_gun",
    list_price: 22000, offered_price: 15000, status: "reddedildi",
    decided_by: YON_ID, decided_at: new Date().toISOString(),
  }).select().single();
  rejectedOfferId = rejectedOffer!.id;

  const { data: approvedOffer } = await admin.from("offers").insert({
    lead_id: leadId, created_by: DAN_ID, program: "tam_gun",
    list_price: 22000, offered_price: 22000, status: "onaylandi",
    decided_by: YON_ID, decided_at: new Date().toISOString(),
  }).select().single();
  approvedOfferId = approvedOffer!.id;

  // Dönüştürülmüş lead kilidi testi için: kazanılmış, öğrenciye bağlı bir lead
  const { data: convertedStudent } = await admin.from("students").insert({
    full_name: "Dönüşüm Öğrenci", parent_name: "Dönüşüm Veli",
    phone: "+905000000099", season: "2026-2027", program: "tam_gun",
  }).select().single();
  const { data: convertedLead } = await admin.from("leads").insert({
    parent_name: "Dönüşüm Veli", phone: "+905000000099",
    source: "referans", assigned_to: DAN_ID,
    status: "kazanildi", converted_student_id: convertedStudent!.id,
  }).select().single();
  convertedLeadId = convertedLead!.id;

  // Karşı teklif kabulü (accept_counter_offer RPC) testleri için: yönetici
  // tarafından revize edilmiş (counter_price dolu), henüz kullanılmamış bir teklif.
  const { data: counterLead } = await admin.from("leads").insert({
    parent_name: "Karşı Teklif Veli", phone: "+905000000077",
    source: "referans", assigned_to: DAN_ID,
  }).select().single();
  counterLeadId = counterLead!.id;
  const { data: counterOffer } = await admin.from("offers").insert({
    lead_id: counterLeadId, created_by: DAN_ID, program: "tam_gun",
    list_price: 22000, offered_price: 18000, status: "revize_edildi",
    counter_price: 20000, decided_by: YON_ID, decided_at: new Date().toISOString(),
  }).select().single();
  counterOfferId = counterOffer!.id;

  // Danışmanın normal teklif akışlarının (onay_bekliyor insert, tam liste
  // fiyatında otomatik onay) 0002 sahtecilik korumasıyla hâlâ çalıştığını
  // doğrulamak için ayrı lead'ler (partial unique index bir lead'e tek
  // onay_bekliyor teklife izin verir).
  const { data: pendingLead } = await admin.from("leads").insert({
    parent_name: "Bekleyen Teklif Veli", phone: "+905000000078",
    source: "referans", assigned_to: DAN_ID,
  }).select().single();
  pendingInsertLeadId = pendingLead!.id;

  const { data: autoApproveLead } = await admin.from("leads").insert({
    parent_name: "Otomatik Onay Veli", phone: "+905000000079",
    source: "referans", assigned_to: DAN_ID,
  }).select().single();
  autoApproveLeadId = autoApproveLead!.id;
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

  // --- 0002: teklif sahteciliği ve sonuçlanmış teklif kilidi ---
  it("danışman düşük list_price ile sahte 'onaylandi' teklif ekleyemez", async () => {
    const { data, error } = await dan.from("offers").insert({
      lead_id: leadId, created_by: DAN_ID, program: "tam_gun",
      list_price: 1, offered_price: 1, status: "onaylandi",
    }).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("yönetici 'reddedildi' teklifi 'onaylandi'ya çeviremez (sonuçlanmış teklif kilidi)", async () => {
    const { data, error } = await yon.from("offers")
      .update({ status: "onaylandi" }).eq("id", rejectedOfferId).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("'onaylandi' teklif 'gecersiz'e çevrilebilir (supersede akışı serbest kalmalı)", async () => {
    const { data, error } = await yon.from("offers")
      .update({ status: "gecersiz", superseded_by_offer_id: offerId })
      .eq("id", approvedOfferId).select();
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  // --- 0002: dönüştürülmüş lead kilidi ---
  it("dönüştürülmüş lead'in parent_name alanı güncellenemez", async () => {
    const { data, error } = await yon.from("leads")
      .update({ parent_name: "Değiştirilmiş İsim" }).eq("id", convertedLeadId).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("dönüştürülmüş lead'de yalnızca last_activity_at güncellemesi geçer", async () => {
    const { data, error } = await yon.from("leads")
      .update({ last_activity_at: new Date().toISOString() }).eq("id", convertedLeadId).select();
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  // --- Karşı teklif kabulü: accept_counter_offer() RPC (danışman için atomik) ---
  let newCounterAcceptedOfferId: string;

  it("danışman karşı rakamı kabul edebilir: yeni 'onaylandi' teklif oluşur ve kaynak kapanır", async () => {
    const { data, error } = await dan.rpc("accept_counter_offer", {
      source_offer_id: counterOfferId,
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
    newCounterAcceptedOfferId = data as string;

    const { data: newOffer } = await admin.from("offers")
      .select("status, offered_price, lead_id, decided_by")
      .eq("id", newCounterAcceptedOfferId).single();
    expect(newOffer!.status).toBe("onaylandi");
    expect(Number(newOffer!.offered_price)).toBe(20000);
    expect(newOffer!.lead_id).toBe(counterLeadId);
    expect(newOffer!.decided_by).toBe(YON_ID);

    const { data: source } = await admin.from("offers")
      .select("status, superseded_by_offer_id")
      .eq("id", counterOfferId).single();
    expect(source!.superseded_by_offer_id).toBe(newCounterAcceptedOfferId);
    // Kaynağın durumu 'revize_edildi' olarak kalır (yalnızca supersede alanı değişir).
    expect(source!.status).toBe("revize_edildi");
  });

  it("aynı karşı teklif ikinci kez kabul edilemez (yeniden kullanım koruması)", async () => {
    const { data, error } = await dan.rpc("accept_counter_offer", {
      source_offer_id: counterOfferId,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.message).toContain("zaten kullanılmış");
  });

  it("danışman normal 'onay_bekliyor' teklif oluşturabilir", async () => {
    const { data, error } = await dan.from("offers").insert({
      lead_id: pendingInsertLeadId, created_by: DAN_ID, program: "tam_gun",
      list_price: 22000, offered_price: 19000, status: "onay_bekliyor",
    }).select();
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  it("danışman aktif liste fiyatına eşit teklifle gerçek otomatik onay oluşturabilir", async () => {
    const { data, error } = await dan.from("offers").insert({
      lead_id: autoApproveLeadId, created_by: DAN_ID, program: "tam_gun",
      list_price: 22000, offered_price: 22000, status: "onaylandi",
    }).select();
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].decided_by).toBeNull();
  });
});

describe("families & refunds RLS", () => {
  const FAMILY_CODE = "AILE-TEST-RLS-0004";

  it("danışman aile oluşturabilir ve okuyabilir", async () => {
    // Tekrar çalıştırmalara dayanıklı olmak için önceki fixture'ı temizle.
    await admin.from("families").delete().eq("family_code", FAMILY_CODE);

    const { data, error } = await dan
      .from("families")
      .insert({ family_code: FAMILY_CODE, primary_parent_name: "Test Veli" })
      .select("id").single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it("danışman iade kaydı OLUŞTURAMAZ (yalnız yönetici)", async () => {
    const { error } = await dan.from("refunds").insert({
      student_id: familyStudentId, amount: 100, method: "nakit",
      refund_date: "2026-07-14", created_by: DAN_ID,
    });
    expect(error).not.toBeNull(); // RLS reddeder
  });

  it("yönetici iade kaydı oluşturabilir", async () => {
    const { data, error } = await yon.from("refunds").insert({
      student_id: familyStudentId, amount: 100, method: "nakit",
      refund_date: "2026-07-14", created_by: YON_ID,
    }).select("id").single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });
});
