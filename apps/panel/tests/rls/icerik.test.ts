import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { clientFor, admin } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Öğretmen rolü (0017): öğretmen yalnız kendi içeriğini görür; veli, öğrenci,
// ödeme, reklam ve görev verisi ona kapalıdır (K1).
const YON_ID = "00000000-0000-0000-0000-000000000001";
const DAN_ID = "00000000-0000-0000-0000-000000000002";
const OGR_ID = "00000000-0000-0000-0000-000000000004";
const OGR2_ID = "00000000-0000-0000-0000-000000000005";
const WEEK = "2026-10-19"; // Pazartesi
const CAMPAIGN = "ICERIK-RLS-TEST";

let ogr: SupabaseClient, dan: SupabaseClient;
let leadId: string, studentId: string, offerId: string;

// Test kodları 99xx haftasında; önceki yarım kalmış koşuların artığı başta silinir.
let seq = 0;
function nextCode(prefix: "R" | "S", letter = "A") {
  seq += 1;
  return `${prefix}-${9900 + seq}-${letter}`;
}
async function cleanupContent() {
  await admin.from("content_items").delete().like("code", "_-99%");
}
async function newReels(owner: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin.from("content_items").insert({
    code: nextCode("R"), kind: "reels", platform: "instagram", week_start: WEEK,
    topic: "RLS test konusu", owner_id: owner, created_by: YON_ID, ...extra,
  }).select().single();
  if (error) throw error;
  return data as { id: string; owner_id: string; code: string };
}

beforeAll(async () => {
  await cleanupContent();
  ogr = await clientFor("ogretmen@test.local");
  dan = await clientFor("danisman@test.local");

  // Her korunan tabloda en az bir satır olsun ki "öğretmen boş görür" anlamlı olsun.
  const { data: lead, error: le } = await admin.from("leads").insert({
    parent_name: "İçerik RLS Veli", phone: "+905000000917", source: "referans", assigned_to: DAN_ID,
  }).select().single();
  if (le) throw le;
  leadId = lead!.id;
  const { data: student, error: se } = await admin.from("students").insert({
    full_name: "İçerik RLS Öğrenci", parent_name: "İçerik RLS Veli",
    phone: "+905000000917", season: "2026-2027", program: "tam_gun",
  }).select().single();
  if (se) throw se;
  studentId = student!.id;
  const { data: plan, error: pe } = await admin.from("payment_plans").insert({
    student_id: studentId, season: "2026-2027", item_type: "aidat", total_amount: 1000, installment_count: 1,
  }).select().single();
  if (pe) throw pe;
  const ins = await admin.from("installments").insert({ plan_id: plan!.id, due_date: "2026-09-01", amount: 1000 });
  if (ins.error) throw ins.error;
  const { data: offer, error: oe } = await admin.from("offers").insert({
    lead_id: leadId, created_by: DAN_ID, program: "tam_gun", list_price: 22000, offered_price: 20000,
    status: "revize_edildi", counter_price: 21000, decided_by: YON_ID, decided_at: new Date().toISOString(),
  }).select().single();
  if (oe) throw oe;
  offerId = offer!.id;
  for (const [table, row] of [
    ["lead_notes", { lead_id: leadId, author_id: DAN_ID, body: "içerik rls notu" }],
    ["appointments", { lead_id: leadId, scheduled_at: "2026-11-02T09:00:00Z", type: "okul_ziyareti", created_by: DAN_ID }],
    ["tasks", { lead_id: leadId, assigned_to: DAN_ID, due_date: "2026-11-02", title: "içerik rls görevi" }],
    ["events", { entity_type: "lead", entity_id: leadId, event_type: "durum_degisti" }],
    ["conversion_uploads", { lead_id: leadId, gclid: "G-ICERIK", conversion_action: "randevu" }],
    ["ad_spend_daily", { date: "2026-10-01", campaign_id: CAMPAIGN, campaign_name: "x", object_id: CAMPAIGN }],
  ] as const) {
    const r = await admin.from(table).insert(row);
    if (r.error) throw new Error(`${table}: ${r.error.message}`);
  }
});

afterAll(async () => {
  await cleanupContent();
  await admin.from("ad_spend_daily").delete().eq("campaign_id", CAMPAIGN);
  await admin.from("events").delete().eq("entity_id", leadId);
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
  if (studentId) await admin.from("students").delete().eq("id", studentId);
});

describe("öğretmen rolü: K1 görünürlük", () => {
  it("öğretmen veli, öğrenci, ödeme, reklam, görev, olay, randevu ve teklif göremez", async () => {
    const tables = [
      "leads", "students", "installments", "payment_plans", "ad_spend_daily", "conversion_uploads",
      "tasks", "events", "appointments", "offers", "lead_notes",
      // ek: aile, iade, fiyat, geciken taksit görünümü, geri bildirim, WhatsApp kuyruğu, ziyaret
      "families", "refunds", "price_lists", "price_list_items", "v_overdue_installments",
      "feedback", "wa_outbox", "site_visit_daily", "content_organic_stats",
    ];
    for (const t of [
      "leads", "students", "installments", "payment_plans", "ad_spend_daily", "conversion_uploads",
      "tasks", "events", "appointments", "offers", "lead_notes", "price_lists",
    ]) {
      const { count } = await admin.from(t).select("*", { count: "exact", head: true });
      expect(count, `${t} admin satır sayısı`).toBeGreaterThan(0);
    }
    for (const t of tables) {
      const { data, error } = await ogr.from(t).select("*").limit(5);
      expect(error, t).toBeNull();
      expect(data, t).toEqual([]);
    }
  });

  it("öğretmen veli ekleyemez ve karşı teklifi kabul edemez", async () => {
    const ins = await ogr.from("leads").insert({ parent_name: "x", phone: "+905000000999", source: "diger" });
    expect(ins.error).not.toBeNull();
    const rpc = await ogr.rpc("accept_counter_offer", { source_offer_id: offerId });
    expect(rpc.error).not.toBeNull();
    const { data: src } = await admin.from("offers").select("superseded_by_offer_id").eq("id", offerId).single();
    expect(src!.superseded_by_offer_id).toBeNull();
  });

  it("öğretmen kendi profilini okur, diğer profilleri okuyamaz", async () => {
    const { data, error } = await ogr.from("profiles").select("id, role");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: OGR_ID, role: "ogretmen" }]);
  });

  it("öğretmen kendi rolünü değiştiremez", async () => {
    const r = await ogr.from("profiles").update({ role: "yonetici" }).eq("id", OGR_ID).select();
    expect(r.data ?? []).toEqual([]);
    const { data } = await admin.from("profiles").select("role").eq("id", OGR_ID).single();
    expect(data!.role).toBe("ogretmen");
  });

  it("profil telefonu E.164 (+90 ve 10 hane) olmalı", async () => {
    const bad = await admin.from("profiles").update({ phone: "05321234567" }).eq("id", OGR2_ID);
    expect(bad.error?.code).toBe("23514");
    const ok = await admin.from("profiles").update({ phone: "+905321234567" }).eq("id", OGR2_ID);
    expect(ok.error).toBeNull();
    await admin.from("profiles").update({ phone: null }).eq("id", OGR2_ID);
  });

  it("öğretmen yasaklı ifadeleri okur ama mesai ayarını okuyamaz", async () => {
    const { data } = await ogr.from("app_settings").select("key, value").order("key");
    expect(data!.map((r) => r.key)).toEqual(["icerik_limitleri", "yasakli_ifadeler"]);
    const yasak = data!.find((r) => r.key === "yasakli_ifadeler")!;
    expect(yasak.value).toEqual(["en iyi", "bir numara", "en güvenli", "garanti"]);
    const mesai = await ogr.from("app_settings").select("key").eq("key", "mesai");
    expect(mesai.data).toEqual([]);
  });

  it("ayar tohumları: içerik limitleri ve reklam kuralları", async () => {
    const { data } = await admin.from("app_settings").select("key, value")
      .in("key", ["icerik_limitleri", "reklam_kurallari"]).order("key");
    // 0018 reklam_kurallari'na üç yeni alan ekler; 0017'nin dört alanı korunur. Birleşmiş nesnenin tamamı.
    expect(data).toEqual([
      { key: "icerik_limitleri", value: { reels_aciklama: 150, sayfa_baslik: 30, en_az: 10 } },
      {
        key: "reklam_kurallari",
        value: {
          hedef_nitelikli_tl: 1000,
          durdur_kat: 3,
          kazan_min_nitelikli: 5,
          sonucsuz_hafta: 3,
          buyutme_yuzde: 20,
          yorgunluk_siklik: 3,
          yorgunluk_ctr_dusus_yuzde: 30,
        },
      },
    ]);
  });

  it("danışman hâlâ velileri görür", async () => {
    const { data, error } = await dan.from("leads").select("id").eq("id", leadId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const p = await dan.from("profiles").select("id");
    expect(p.data!.length).toBeGreaterThanOrEqual(5);
    const s = await dan.from("app_settings").select("key").eq("key", "mesai");
    expect(s.data).toHaveLength(1);
  });
});

describe("öğretmen rolü: içerik", () => {
  it("öğretmen yalnız kendi içeriğini görür", async () => {
    const mine = await newReels(OGR_ID);
    await newReels(OGR2_ID);
    const { data, error } = await ogr.from("content_items").select("id, owner_id").like("code", "_-99%");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: mine.id, owner_id: OGR_ID }]);
    const all = await dan.from("content_items").select("id").like("code", "_-99%");
    expect(all.data!.length).toBeGreaterThanOrEqual(2);
  });

  it("öğretmen içerik ekleyemez ve silemez", async () => {
    const ins = await ogr.from("content_items").insert({
      code: nextCode("R"), kind: "reels", platform: "instagram", week_start: WEEK, topic: "x", owner_id: OGR_ID,
    });
    expect(ins.error).not.toBeNull();
    const item = await newReels(OGR_ID);
    await ogr.from("content_items").delete().eq("id", item.id);
    const { count } = await admin.from("content_items").select("*", { count: "exact", head: true }).eq("id", item.id);
    expect(count).toBe(1);
  });

  it("öğretmen taslak içeriğin açıklamasını yazar, aşamasını değiştiremez", async () => {
    const item = await newReels(OGR_ID);
    const ok = await ogr.from("content_items").update({ caption: "Bahçede sonbahar" }).eq("id", item.id).select();
    expect(ok.error).toBeNull();
    expect(ok.data).toHaveLength(1);
    const bad = await ogr.from("content_items").update({ stage: "test" }).eq("id", item.id);
    expect(bad.error).not.toBeNull();
    const bad2 = await ogr.from("content_items").update({ owner_id: OGR2_ID }).eq("id", item.id);
    expect(bad2.error).not.toBeNull();
  });

  it("başka öğretmenin içeriğini değiştiremez", async () => {
    const other = await newReels(OGR2_ID);
    const r = await ogr.from("content_items").update({ caption: "x" }).eq("id", other.id).select();
    expect(r.data ?? []).toEqual([]);
  });

  it("teslim edilmiş içeriği öğretmen değiştiremez", async () => {
    const item = await newReels(OGR_ID);
    const up = await admin.from("content_items").update({
      status: "teslim", face_answer: false, media_path: `${OGR_ID}/${item.id}/v.mp4`,
    }).eq("id", item.id);
    expect(up.error).toBeNull();
    const r = await ogr.from("content_items").update({ caption: "sonradan" }).eq("id", item.id).select();
    expect(r.error).toBeNull();
    expect(r.data).toEqual([]);
    const back = await ogr.from("content_items").update({ status: "taslak" }).eq("id", item.id).select();
    expect(back.data ?? []).toEqual([]);
    const { data } = await admin.from("content_items").select("caption, status").eq("id", item.id).single();
    expect(data).toEqual({ caption: null, status: "teslim" });
  });

  it("öğretmen içeriği onaylandı yapamaz", async () => {
    const item = await newReels(OGR_ID);
    const r = await ogr.from("content_items").update({ status: "onaylandi" }).eq("id", item.id);
    expect(r.error).not.toBeNull();
  });

  it("öğretmen durumu ve teslim zamanını doğrudan değiştiremez (teslim yalnız submitContent ile)", async () => {
    for (const status of ["taslak", "duzeltme"]) {
      const item = await newReels(OGR_ID, { status, face_answer: false, media_path: null });
      const path = `${OGR_ID}/${item.id}/v.mp4`;
      const r = await ogr.from("content_items")
        .update({ status: "teslim", face_answer: false, media_path: path }).eq("id", item.id).select();
      expect(r.error, status).not.toBeNull();
      const t = await ogr.from("content_items")
        .update({ submitted_at: "2020-01-01T00:00:00Z" }).eq("id", item.id).select();
      expect(t.error, status).not.toBeNull();
      const { data } = await admin.from("content_items").select("status, submitted_at").eq("id", item.id).single();
      expect(data).toEqual({ status, submitted_at: null });
    }
  });

  it("teslimde tetikleyici zamanı ve kontrol aşamasını damgalar", async () => {
    const item = await newReels(OGR_ID, { status: "duzeltme" });
    const before = Date.now();
    const r = await admin.from("content_items").update({
      status: "teslim", face_answer: false, media_path: `${OGR_ID}/${item.id}/v2.mp4`,
      submitted_at: "2020-01-01T00:00:00Z", stage: "gorev",
    }).eq("id", item.id).select("status, stage, submitted_at, stage_changed_at").single();
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ status: "teslim", stage: "kontrol" });
    expect(Date.parse(r.data!.submitted_at as string)).toBeGreaterThan(before - 60_000);
    expect(Date.parse(r.data!.stage_changed_at as string)).toBeGreaterThan(before - 60_000);
  });

  it("Reels teslimi yüz Evet, cevapsız ya da videosuzken veritabanında da reddedilir", async () => {
    const item = await newReels(OGR_ID);
    const path = `${OGR_ID}/${item.id}/v.mp4`;
    const yes = await admin.from("content_items").update({ status: "teslim", face_answer: true, media_path: path }).eq("id", item.id);
    expect(yes.error?.code).toBe("23514");
    const none = await admin.from("content_items").update({ status: "teslim", media_path: path }).eq("id", item.id);
    expect(none.error?.code).toBe("23514");
    const noVideo = await admin.from("content_items").update({ status: "teslim", face_answer: false, media_path: null }).eq("id", item.id);
    expect(noVideo.error?.code).toBe("23514");
    const no = await admin.from("content_items")
      .update({ status: "teslim", face_answer: false, media_path: path }).eq("id", item.id).select();
    expect(no.error).toBeNull();
    expect(no.data).toHaveLength(1);
  });

  it("servis anahtarı da yüz Evet iken Reels teslim edemez", async () => {
    const item = await newReels(OGR_ID);
    const r = await admin.from("content_items").update({
      status: "teslim", face_answer: true, media_path: `${OGR_ID}/${item.id}/v.mp4`,
    }).eq("id", item.id);
    expect(r.error?.code).toBe("23514");
  });

  it("media_path başka klasöre yazılamaz", async () => {
    const item = await newReels(OGR_ID);
    for (const p of ["baskasi/x/v.mp4", `${OGR2_ID}/${item.id}/v.mp4`, `${OGR_ID}/${item.id}/`, `${OGR_ID}/${item.id}/a/b.mp4`]) {
      const r = await ogr.from("content_items").update({ media_path: p }).eq("id", item.id);
      expect(r.error, p).not.toBeNull();
    }
  });

  it("öğretmen videoyu doğrudan değiştirirse eski yüz cevabı silinir", async () => {
    const fresh = await newReels(OGR_ID, { face_answer: null });
    const first = `${OGR_ID}/${fresh.id}/ilk.mp4`;
    // Video ve cevap aynı güncellemede değişirse cevap korunur.
    const both = await ogr.from("content_items").update({ media_path: first, face_answer: false }).eq("id", fresh.id).select("face_answer").single();
    expect(both.error).toBeNull();
    expect(both.data!.face_answer).toBe(false);
    // Yalnız video değişirse "Hayır" yeni videoyu kapsamaz.
    const only = await ogr.from("content_items").update({ media_path: `${OGR_ID}/${fresh.id}/yeni.mp4` })
      .eq("id", fresh.id).select("face_answer").single();
    expect(only.error).toBeNull();
    expect(only.data!.face_answer).toBeNull();
    // Yazı kaydı cevabı silmez.
    await admin.from("content_items").update({ face_answer: false }).eq("id", fresh.id);
    const text = await ogr.from("content_items").update({ caption: "x" }).eq("id", fresh.id).select("face_answer").single();
    expect(text.data!.face_answer).toBe(false);
  });

  it("kod, tür ve platform tutarlı olmalı", async () => {
    const base = { week_start: WEEK, topic: "x", owner_id: OGR_ID };
    const bad = [
      { ...base, code: nextCode("S", "G"), kind: "reels", platform: "instagram" },
      { ...base, code: nextCode("R"), kind: "reels", platform: "google" },
      { ...base, code: nextCode("S", "G"), kind: "sayfa", platform: "instagram" },
      { ...base, code: nextCode("S", "A"), kind: "sayfa", platform: "google" },
      { ...base, code: "R-26-A", kind: "reels", platform: "instagram" },
      { ...base, code: nextCode("R"), kind: "reels", platform: "instagram", week_start: "2026-10-20" },
    ];
    for (const row of bad) {
      const r = await admin.from("content_items").insert(row);
      expect(r.error, JSON.stringify(row)).not.toBeNull();
    }
    const ok = await admin.from("content_items").insert([
      { ...base, code: nextCode("S", "G"), kind: "sayfa", platform: "google" },
      { ...base, code: nextCode("S", "I"), kind: "sayfa", platform: "instagram" },
    ]);
    expect(ok.error).toBeNull();
  });

  it("organik sayıları yalnız personel okur", async () => {
    const item = await newReels(OGR_ID);
    const ins = await admin.from("content_organic_stats").insert({ content_id: item.id, day: "2026-10-20", views: 10 });
    expect(ins.error).toBeNull();
    const o = await ogr.from("content_organic_stats").select("*").eq("content_id", item.id);
    expect(o.data).toEqual([]);
    const d = await dan.from("content_organic_stats").select("views").eq("content_id", item.id);
    expect(d.data).toEqual([{ views: 10 }]);
    const w = await dan.from("content_organic_stats").insert({ content_id: item.id, day: "2026-10-21", views: 1 });
    expect(w.error).not.toBeNull();
  });
});

describe("icerik kovası", () => {
  it("icerik kovası gizli ve 200 MB sınırlı", async () => {
    const { data, error } = await admin.storage.getBucket("icerik");
    expect(error).toBeNull();
    expect(data!.public).toBe(false);
    expect(data!.file_size_limit).toBe(209715200);
    expect([...(data!.allowed_mime_types ?? [])].sort()).toEqual(["video/mp4", "video/quicktime"]);
  });

  it("öğretmen kovaya doğrudan yükleyemez ve listeleyemez", async () => {
    const up = await ogr.storage.from("icerik").upload(`${OGR_ID}/x/v.mp4`, new Blob(["x"], { type: "video/mp4" }));
    expect(up.error).not.toBeNull();
    const ls = await ogr.storage.from("icerik").list(OGR_ID);
    expect(ls.data ?? []).toEqual([]);
  });
});
