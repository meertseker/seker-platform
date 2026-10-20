import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/lead-flow/business-hours";
import {
  adPlatformOf,
  buildReport,
  discountOf,
  sectionTables,
  wonLeadIdOf,
  type ManagerInput,
  type RawLead,
  type ReportInput,
} from "@/lib/report/build";
import { resolvePeriod } from "@/lib/report/period";

const T = (local: string) => new Date(`${local}+03:00`).toISOString();

function lead(over: Partial<RawLead> & Pick<RawLead, "id" | "created_at">): RawLead {
  return {
    first_contact_at: null,
    last_activity_at: null,
    status: "yeni",
    lost_reason: null,
    source: "diger",
    channel: null,
    ad_platform: null,
    gclid: null,
    utm_campaign: null,
    utm_term: null,
    landing_path: null,
    assigned_to: null,
    is_qualified: null,
    q_reached: null,
    converted_student_id: null,
    ...over,
  };
}

const Z = "00000000-0000-0000-0000-00000000000a";
const R = "00000000-0000-0000-0000-00000000000b";
const M = "00000000-0000-0000-0000-00000000000c";
const TEACHER = "00000000-0000-0000-0000-00000000000d";

const manager: ManagerInput = {
  installments: [
    { amount: 1000, due_date: "2026-10-05", status: "odendi", paid_at: T("2026-10-04T10:00:00"), paid_amount: 1000, item_type: "aidat" },
    { amount: 500, due_date: "2026-10-15", status: "bekliyor", paid_at: null, paid_amount: null, item_type: "aidat" },
    { amount: 2000, due_date: "2026-09-15", status: "odendi", paid_at: T("2026-10-01T10:00:00"), paid_amount: 2000, item_type: "servis" },
    { amount: 700, due_date: "2026-10-10", status: "iptal", paid_at: null, paid_amount: null, item_type: "aidat" },
  ],
  overdue: [{ amount: 500, days_overdue: 5, item_type: "aidat" }],
  refunds: [{ amount: 250, refund_date: "2026-10-12" }],
  spend: [
    { date: "2026-10-02", platform: "google", campaign_id: "c1", campaign_name: "Arama", cost_micros: 300_000_000, clicks: 40, impressions: 900 },
    { date: "2026-10-05", platform: "meta", campaign_id: "m1", campaign_name: "Reels", cost_micros: 100_000_000, clicks: 10, impressions: 500 },
    { date: "2026-09-05", platform: "google", campaign_id: "c1", campaign_name: "Arama", cost_micros: 50_000_000, clicks: 5, impressions: 100 },
  ],
  activeCampaigns: 1,
  adsConnected: { google: true, meta: false },
  visits: [
    { day: "2026-10-03", path: "/", source: "arama", device: "mobil", pageviews: 20, entrances: 10 },
    { day: "2026-09-03", path: "/", source: "arama", device: "masaustu", pageviews: 8, entrances: 5 },
  ],
  content: [
    { owner_id: TEACHER, created_at: T("2026-10-01T09:00:00"), due_at: T("2026-10-08T17:00:00"), status: "onaylandi", submitted_at: T("2026-10-07T12:00:00"), approved_at: T("2026-10-09T12:00:00") },
    { owner_id: TEACHER, created_at: T("2026-10-10T09:00:00"), due_at: T("2026-10-15T17:00:00"), status: "taslak", submitted_at: null, approved_at: null },
  ],
  wa: [
    { status: "gonderildi", created_at: T("2026-10-02T10:00:00") },
    { status: "gonderildi", created_at: T("2026-10-03T10:00:00") },
    { status: "hata", created_at: T("2026-10-04T10:00:00") },
    { status: "gonderildi", created_at: T("2026-09-04T10:00:00") },
  ],
  uploads: [{ platform: "google", status: "gonderildi", conversion_at: T("2026-10-07T10:00:00") }],
  pendingOffers: 2,
};

function input(viewer: ReportInput["viewer"] = { id: M, role: "yonetici" }): ReportInput {
  return {
    now: new Date(T("2026-10-20T12:00:00")),
    period: resolvePeriod({}, "2026-10-20"),
    hours: DEFAULT_BUSINESS_HOURS,
    viewer,
    leads: [
      lead({
        id: "L1",
        created_at: T("2026-10-02T10:00:00"),
        first_contact_at: T("2026-10-02T10:30:00"),
        status: "kazanildi",
        converted_student_id: "S1",
        source: "reklam",
        gclid: "g",
        utm_campaign: "c1",
        utm_term: "Anaokulu Fiyat",
        landing_path: "/lp/fiyat",
        assigned_to: Z,
      }),
      lead({ id: "L2", created_at: T("2026-10-05T09:00:00"), last_activity_at: T("2026-10-19T09:00:00"), source: "instagram", ad_platform: "meta", assigned_to: R }),
      lead({
        id: "L3",
        created_at: T("2026-10-06T09:00:00"),
        first_contact_at: T("2026-10-06T09:10:00"),
        status: "kaybedildi",
        lost_reason: "uzaklik",
        source: "referans",
        assigned_to: Z,
      }),
      lead({
        id: "L4",
        created_at: T("2026-09-10T09:00:00"),
        first_contact_at: T("2026-09-10T09:20:00"),
        status: "ulasildi",
        source: "reklam",
        gclid: "g2",
        utm_term: "anaokulu   fiyat",
        assigned_to: Z,
      }),
      lead({ id: "L5", created_at: T("2025-01-01T09:00:00"), last_activity_at: T("2026-10-01T09:00:00"), status: "teklif", source: "telefon" }),
    ],
    appts: [
      { lead_id: "L1", created_at: T("2026-10-03T10:00:00"), scheduled_at: T("2026-10-05T10:00:00"), outcome: "geldi" },
      { lead_id: "L3", created_at: T("2026-10-07T10:00:00"), scheduled_at: T("2026-10-08T10:00:00"), outcome: "iptal" },
    ],
    offers: [{ lead_id: "L1", created_at: T("2026-10-06T10:00:00"), status: "onaylandi", list_price: 10000, offered_price: 9000, created_by: M }],
    events: [
      { entity_type: "lead", entity_id: "L3", event_type: "durum_degisti", payload: { from: "ulasildi", to: "randevu" }, created_at: T("2026-10-07T10:00:00") },
      { entity_type: "lead", entity_id: "L3", event_type: "durum_degisti", payload: { from: "randevu", to: "kaybedildi", lostReason: "fiyat" }, created_at: T("2026-10-10T10:00:00") },
      { entity_type: "lead", entity_id: "L1", event_type: "durum_degisti", payload: { from: "teklif", to: "kazanildi" }, created_at: T("2026-10-07T10:00:00") },
      { entity_type: "student", entity_id: "S1", event_type: "ogrenciye_donusturuldu", payload: { leadId: "L1" }, created_at: T("2026-10-07T10:05:00") },
    ],
    profiles: [
      { id: Z, full_name: "Zehra", role: "danisman", is_active: true },
      { id: R, full_name: "Rüya", role: "danisman", is_active: true },
      { id: M, full_name: "Mehtap", role: "yonetici", is_active: true },
      { id: TEACHER, full_name: "Ayşe Öğretmen", role: "ogretmen", is_active: true },
    ],
    openTasks: [
      { assigned_to: Z, due_date: "2026-10-18", due_at: null },
      { assigned_to: Z, due_date: "2026-10-25", due_at: null },
    ],
    students: [
      { id: "S1", status: "aktif", program: "tam_gun", left_date: null },
      { id: "S2", status: "aktif", program: "tam_gun", left_date: null },
      { id: "S3", status: "aktif", program: "yarim_gun", left_date: null },
      { id: "S4", status: "ayrildi", program: "tam_gun", left_date: "2026-10-03" },
    ],
    capacities: [{ program: "tam_gun", capacity: 20 }],
    manager,
  };
}

const rowsOf = (t: { rows: Record<string, unknown>[] }, key: string) => Object.fromEntries(t.rows.map((r) => [r[key], r]));

describe("veli aşaması", () => {
  it("K10: gclid ya da source=reklam Google, ad_platform=meta Instagram", () => {
    expect(adPlatformOf({ gclid: "x", source: "diger", ad_platform: "meta" })).toBe("google");
    expect(adPlatformOf({ gclid: null, source: "instagram", ad_platform: "meta" })).toBe("meta");
    expect(adPlatformOf({ gclid: null, source: "referans", ad_platform: null })).toBeNull();
  });

  it("kazanma olayı: durum değişimi ya da öğrenciye dönüştürme", () => {
    expect(wonLeadIdOf({ entity_type: "lead", entity_id: "a", event_type: "durum_degisti", payload: { to: "kazanildi" }, created_at: "" })).toBe("a");
    expect(wonLeadIdOf({ entity_type: "student", entity_id: "s", event_type: "ogrenciye_donusturuldu", payload: { leadId: "b" }, created_at: "" })).toBe("b");
    expect(wonLeadIdOf({ entity_type: "lead", entity_id: "a", event_type: "durum_degisti", payload: { to: "teklif" }, created_at: "" })).toBeNull();
  });

  it("indirim: liste fiyatına göre, liste 0 ise null", () => {
    expect(discountOf({ list_price: 10000, offered_price: 9000 })).toBeCloseTo(0.1);
    expect(discountOf({ list_price: 0, offered_price: 9000 })).toBeNull();
  });
});

describe("rapor (yönetici)", () => {
  const report = buildReport(input());

  it("özet: dönem ve önceki dönem, kayıt olayları tekilleşir", () => {
    const k = Object.fromEntries(report.summary.kpis.map((x) => [x.key, x]));
    expect(k.aday.value).toBe(3);
    expect(k.aday.change).toMatchObject({ previous: 1, diff: 2, pct: 2 });
    expect(k.randevu.value).toBe(1); // iptal sayılmaz
    expect(k.ziyaret.value).toBe(1);
    expect(k.kayit.value).toBe(1); // aynı veli için iki olay
    expect(k.kayit.change?.pct).toBeNull(); // önceki 0
    expect(k.ogrenci.value).toBe(3);
    expect(k.tahsilat.value).toBe(300_000);
    expect(k.harcama.value).toBe(40_000);
    expect(k.harcama.change).toMatchObject({ previous: 5_000 });
    expect(k.cpl.value).toBe(20_000); // 400 TL ÷ 2 reklam velisi
    expect(k.cpl.change).toMatchObject({ previous: 5_000 }); // 50 TL ÷ 1
    expect(report.summary.headline).toBe("1–20 Ekim 2026 arasında 3 aday geldi, 1 kayıt oldu; önceki döneme (1–20 Eylül 2026) göre 2 aday fazla.");
  });

  it("özet: son 12 ay", () => {
    const { months, series } = report.summary.trend;
    expect(months.at(-1)).toBe("2026-10");
    expect(series[0].values.at(-1)).toBe(3);
    expect(series[0].values.at(-2)).toBe(1);
    expect(series[1].values.at(-1)).toBe(1);
  });

  it("huni: en ileri aşama ve geçiş oranları, en büyük düşüş", () => {
    const steps = report.funnel.steps;
    expect(steps.map((s) => s.n)).toEqual([3, 2, 2, 1, 1, 1]);
    expect(steps.map((s) => s.prevN)).toEqual([1, 1, 0, 0, 0, 0]);
    expect(steps[1].fromPrev).toBeCloseTo(2 / 3);
    expect(steps[3].worst).toBe(true);
    expect(steps.filter((s) => s.worst)).toHaveLength(1);
    // L1: veli 10:00 → ilk arama 10:30 (0,02 gün); L3: 09:00 → 09:10.
    expect(steps[1].medianDaysFromPrev).toBeCloseTo((20 / 60 / 24 + 30 / 60 / 24) / 2);
    // Kayıt: teklif 6 Ekim 10:00 → kazanma 7 Ekim 10:00.
    expect(steps[5].medianDaysFromPrev).toBeCloseTo(1);
  });

  it("huni: şu an açık veliler ve bekleyenler", () => {
    const open = Object.fromEntries(report.funnel.open.map((o) => [o.status, o]));
    expect(open.yeni).toMatchObject({ n: 1, stale: 0 });
    expect(open.teklif).toMatchObject({ n: 1, stale: 1 });
    expect(open.ulasildi).toMatchObject({ n: 1, stale: 1 });
    expect(report.funnel.openTotal).toBe(3);
    expect(report.funnel.staleTotal).toBe(2);
  });

  it("kaynaklar ve kelimeler", () => {
    const src = rowsOf(report.sources.tables[0], "kaynak");
    expect(src["Google reklamı"]).toMatchObject({ aday: 1, kayit: 1, oran: 1 });
    expect(src["Instagram reklamı"]).toMatchObject({ aday: 1, kayit: 0, oran: 0 });
    expect(src["Referans"]).toMatchObject({ aday: 1, randevu: 1 });
    const kw = rowsOf(report.sources.tables.find((t) => t.id === "kelimeler")!, "kelime");
    expect(kw["anaokulu fiyat"]).toMatchObject({ aday: 1, kayit: 1 });
    expect(kw["(kelime bilinmiyor)"]).toMatchObject({ aday: 1 });
  });

  it("reklam: platform maliyetleri, kayıtsız platformda kayıt başı yok", () => {
    const p = Object.fromEntries(report.sources.platforms.map((x) => [x.key, x]));
    expect(p.google).toMatchObject({ spendKurus: 30_000, leads: 1, kayit: 1, costPerLead: 30_000, costPerKayit: 30_000 });
    expect(p.meta).toMatchObject({ spendKurus: 10_000, leads: 1, kayit: 0, costPerLead: 10_000, costPerKayit: null });
    const t = report.sources.tables.find((x) => x.id === "reklam-platform")!;
    expect(t.total).toMatchObject({ harcama: 40_000, aday: 2, kayit: 1, cpl: 20_000, cpk: 40_000, tiklama: 50 });
    expect(report.sources.adNote).toBeNull();
    const camp = rowsOf(report.sources.tables.find((x) => x.id === "kampanyalar")!, "kampanya");
    expect(camp["Arama"]).toMatchObject({ harcama: 30_000, aday: 1, kayit: 1 });
  });

  it("reklam: veri yok ve kampanyalar duraklatılmışsa bunu söyler", () => {
    const base = input();
    const r = buildReport({
      ...base,
      leads: base.leads.filter((l) => !l.gclid && !l.ad_platform),
      manager: { ...manager, spend: [], activeCampaigns: 0 },
    });
    expect(r.sources.hasAdData).toBe(false);
    expect(r.sources.adNote).toContain("duraklatılmış");
    const t = r.sources.tables.find((x) => x.id === "reklam-platform")!;
    expect(t.total).toMatchObject({ harcama: 0, cpl: null, cpk: null });
  });

  it("ön büro: kişi başına ilk arama, 7 günde ulaşma, randevuya gelme, görevler", () => {
    const t = report.frontOffice.tables[0];
    const rows = rowsOf(t, "kisi");
    expect(rows["Zehra"]).toMatchObject({ aday: 2, ilkArama: 20, ulasma7: 1, gelme: 1, kayit: 1, acikGorev: 2, gecikenGorev: 1 });
    expect(rows["Rüya"]).toMatchObject({ aday: 1, ulasma7: 0 });
    expect(rows["Rüya"].ilkArama as number).toBeGreaterThan(60 * 8);
    expect(rows["Mehtap"]).toBeUndefined(); // hiç işi yok
    expect(t.total).toMatchObject({ kisi: "Okul toplamı", aday: 3 });
  });

  it("kayıp nedeni olaydaki nedenle", () => {
    expect(report.lost.total).toBe(1);
    expect(report.lost.bars).toEqual([{ label: "Fiyat", n: 1, prevN: 0 }]);
  });

  it("teklifler", () => {
    expect(report.offers).toMatchObject({ created: 1, approved: 1, pending: 2 });
    expect(report.offers?.avgDiscount).toBeCloseTo(0.1);
  });

  it("öğrenciler ve tahsilat", () => {
    const s = report.students;
    expect(s.active).toBe(3);
    expect(s.left).toBe(1);
    expect(s.programs.find((p) => p.program === "tam_gun")).toMatchObject({ active: 2, capacity: 20 });
    expect(s.money).toMatchObject({
      expectedKurus: 150_000, // iptal hariç
      collectedKurus: 300_000,
      refundsKurus: 25_000,
      overdueKurus: 50_000,
      overdueCount: 1,
    });
    expect(s.money?.dueCollectedRatio).toBeCloseTo(2 / 3);
    expect(s.money?.aging[0]).toMatchObject({ key: "1-30", count: 1, amountKurus: 50_000 });
    expect(s.money?.trend.series[0].values.at(-1)).toBe(150_000);
    expect(s.money?.trend.series[1].values.at(-1)).toBe(300_000);
  });

  it("içerik, site, otomasyon", () => {
    expect(report.content).toMatchObject({ given: 2, submitted: 1, approved: 1, onTime: 1, late: 1 });
    expect(report.site?.current.visits).toBe(10);
    expect(report.site?.previous.visits).toBe(5);
    expect(report.site?.webLeads).toBe(1);
    expect(report.site?.conversion).toBeCloseTo(0.1);
    expect(report.automation).toMatchObject({ waSent: 2, waFailed: 1, uploadsSent: 1 });
  });

  it("bütün bölümler dosyaya girer", () => {
    expect(sectionTables(report).map((s) => s.id)).toEqual([
      "ozet",
      "huni",
      "kaynaklar",
      "on-buro",
      "kayip",
      "teklifler",
      "ogrenciler",
      "icerik",
      "site",
      "otomasyon",
    ]);
  });
});

describe("rapor (danışman)", () => {
  const base = input({ id: Z, role: "danisman" });
  const report = buildReport({ ...base, manager: null });

  it("para, reklam, içerik, site ve otomasyon yok", () => {
    expect(report.offers).toBeNull();
    expect(report.content).toBeNull();
    expect(report.site).toBeNull();
    expect(report.automation).toBeNull();
    expect(report.students.money).toBeNull();
    expect(report.summary.kpis.map((k) => k.key)).toEqual(["aday", "randevu", "ziyaret", "kayit", "ogrenci"]);
    expect(report.sources.tables.map((t) => t.id)).toEqual(["kaynaklar", "kelimeler"]);
    expect(sectionTables(report).map((s) => s.id)).toEqual(["ozet", "huni", "kaynaklar", "on-buro", "kayip", "ogrenciler"]);
  });

  it("ön büroda yalnız kendi satırı ve okul toplamı", () => {
    const t = report.frontOffice.tables[0];
    expect(report.frontOffice.ownOnly).toBe(true);
    expect(t.rows.map((r) => r.kisi)).toEqual(["Zehra"]);
    expect(t.total).toMatchObject({ aday: 3 });
  });
});
