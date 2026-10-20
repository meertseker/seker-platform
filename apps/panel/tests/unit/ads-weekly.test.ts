import { describe, it, expect } from "vitest";
import {
  anyGateRed,
  computeFunnel,
  computeGates,
  computeScorecard,
  computeWeekGates,
  formatWeekLabel,
  isAdSourced,
  isPaidAd,
  lastCompletedWeekStart,
  weekRange,
  type WeeklyAppt,
  type WeeklyLead,
  type WeeklyTask,
} from "@/lib/ads/weekly";
import { loadWeeklyData } from "@/lib/queries/weekly";
import { DEFAULT_AD_SETTINGS } from "@/lib/ads/ad-settings";
import { DEFAULT_BUSINESS_HOURS, istanbulAt } from "@/lib/lead-flow/business-hours";

const H = DEFAULT_BUSINESS_HOURS;
const S = DEFAULT_AD_SETTINGS;
// Toplantı haftası: Pazartesi 2026-11-02 … Pazar 2026-11-08. Toplantı: Pazartesi 2026-11-09 09:00.
// Ulaşma kohortu: bir önceki hafta, 26 Ekim … 1 Kasım.
const WEEK = "2026-11-02";
const NOW = istanbulAt("2026-11-09", "09:00");

let seq = 0;
function lead(over: Partial<WeeklyLead> = {}): WeeklyLead {
  seq += 1;
  return {
    id: `l${seq}`,
    createdAt: istanbulAt("2026-11-03", "10:00").toISOString(),
    firstContactAt: null,
    status: "yeni",
    lostReason: null,
    isQualified: false,
    qReached: null,
    source: "reklam",
    channel: "form",
    adPlatform: "google",
    contentCode: null,
    assignedTo: null,
    hasAppointment: false,
    ...over,
  };
}
const at = (day: string, hhmm: string) => istanbulAt(day, hhmm).toISOString();
const appt = (leadId: string, outcome: string | null, scheduledAt = at("2026-11-05", "10:00"), assignedTo: string | null = null): WeeklyAppt => ({
  leadId,
  scheduledAt,
  outcome,
  assignedTo,
});
const gate = (gates: ReturnType<typeof computeGates>, key: string) => gates.find((g) => g.key === key)!;
const called = (min: number, base = at("2026-11-03", "10:00")) =>
  lead({ createdAt: base, firstContactAt: new Date(Date.parse(base) + min * 60000).toISOString() });

describe("reklam velisi kaynağı (K6/K10)", () => {
  it("Google, Meta reklamı ve organik Instagram mesajı reklam velisidir; referans değildir", () => {
    expect(isAdSourced(lead({ adPlatform: "google" }))).toBe(true);
    expect(isAdSourced(lead({ adPlatform: "meta", source: "instagram" }))).toBe(true);
    expect(isAdSourced(lead({ adPlatform: null, source: "reklam" }))).toBe(true);
    expect(isAdSourced(lead({ adPlatform: null, source: "instagram", channel: "ig_dm" }))).toBe(true);
    expect(isAdSourced(lead({ adPlatform: null, source: "instagram", channel: "ig_yorum" }))).toBe(true);
    expect(isAdSourced(lead({ adPlatform: null, source: "referans", channel: "telefon" }))).toBe(false);
  });
  it("organik Instagram mesajı ücretli reklam sayılmaz", () => {
    expect(isPaidAd(lead({ adPlatform: null, source: "instagram", channel: "ig_dm" }))).toBe(false);
    expect(isPaidAd(lead({ adPlatform: "meta", source: "instagram" }))).toBe(true);
    expect(isPaidAd(lead({ adPlatform: null, source: "reklam" }))).toBe(true);
  });
});

describe("hafta", () => {
  it("Pazartesi–Pazar İstanbul aralığı", () => {
    expect(weekRange("2026-11-02")).toEqual({
      from: "2026-11-01T21:00:00.000Z",
      to: "2026-11-08T21:00:00.000Z",
    });
  });
  it("son tamamlanan hafta: Pazartesi sabahı geçen haftanın Pazartesisi", () => {
    expect(lastCompletedWeekStart(istanbulAt("2026-11-09", "09:00"))).toBe("2026-11-02");
    expect(lastCompletedWeekStart(istanbulAt("2026-11-15", "23:30"))).toBe("2026-11-02");
    // Pazar gece UTC'de hâlâ Pazar ama İstanbul'da Pazartesi 01:30
    expect(lastCompletedWeekStart(new Date("2026-11-08T22:30:00Z"))).toBe("2026-11-02");
  });
  it("hafta etiketi: aynı ay ve ay geçişi", () => {
    expect(formatWeekLabel("2026-11-02")).toBe("2–8 Kasım");
    expect(formatWeekLabel("2026-10-26")).toBe("26 Ekim–1 Kasım");
  });
});

describe("computeGates", () => {
  it("mesai dışı gelen velinin ilk arama süresi mesai dakikasıyla sayılır (22:40 → ertesi 08:36 = 6 dk)", () => {
    const l = lead({ createdAt: at("2026-11-03", "22:40"), firstContactAt: at("2026-11-04", "08:36") });
    const g = gate(computeGates([l], [], NOW, H, S), "firstCall");
    expect(g.value).toBe(6);
    expect(g.display).toBe("6 dk");
    expect(g.label).toBe("İlk arama süresi");
    expect(g.target).toBe("hedef en fazla 15 dk (ideal 5)");
    expect(g.tone).toBe("green");
  });

  it("ortanca çift sayıda ortadaki ikisinin ortalaması", () => {
    const g = gate(computeGates([called(4), called(30), called(10), called(20)], [], NOW, H, S), "firstCall");
    expect(g.value).toBe(15);
    expect(g.tone).toBe("green");
    const g2 = gate(computeGates([called(10), called(30)], [], NOW, H, S), "firstCall");
    expect(g2.value).toBe(20);
    expect(g2.tone).toBe("red");
  });

  it("aranmamış veli şimdiye kadarki mesai beklemesiyle ortancaya girer", () => {
    const now = istanbulAt("2026-11-03", "10:40");
    const uncalled = lead({ createdAt: at("2026-11-03", "10:00"), firstContactAt: null });
    const g = gate(computeGates([called(4), called(10), uncalled], [], now, H, S), "firstCall");
    expect(g.value).toBe(10);
    // Hiç aranmayan iki veli: ortanca kırmızı, "veri yok" değil
    const g2 = gate(computeGates([uncalled, lead({ createdAt: at("2026-11-03", "10:20") })], [], now, H, S), "firstCall");
    expect(g2.value).toBe(30);
    expect(g2.tone).toBe("red");
  });

  it("veli yokken dört kapı 'veri yok', kırmızı değil", () => {
    const gates = computeGates([], [], NOW, H, S, { weekStart: WEEK, reachLeads: [], weekAppts: [] });
    expect(gates.map((g) => g.key)).toEqual(["firstCall", "reach", "appt", "show"]);
    for (const g of gates) {
      expect(g.value).toBeNull();
      expect(g.display).toBe("veri yok");
      expect(g.tone).toBe("none");
    }
    expect(anyGateRed(gates)).toEqual({ red: false, labels: [] });
  });

  it("nitelikliden randevu %29 kırmızı, %35 yeşil", () => {
    const build = (withAppt: number, total: number) =>
      Array.from({ length: total }, (_, i) =>
        lead({ isQualified: true, qReached: true, status: "ulasildi", firstContactAt: at("2026-11-03", "10:05"), hasAppointment: i < withAppt }),
      );
    const red = computeGates(build(2, 7), [], NOW, H, S);
    expect(gate(red, "appt").display).toBe("%29");
    expect(gate(red, "appt").tone).toBe("red");
    expect(gate(red, "appt").target).toBe("hedef en az %35 · nitelikli velilerden");
    expect(anyGateRed(red)).toEqual({ red: true, labels: ["Randevu verilen"] });
    const green = computeGates(build(7, 20), [], NOW, H, S);
    expect(gate(green, "appt").display).toBe("%35");
    expect(gate(green, "appt").tone).toBe("green");
  });

  it("randevu: durumu randevu ve sonrası olan nitelikli de randevu almış sayılır; nitelikli olmayan paydaya girmez", () => {
    const leads = [
      lead({ isQualified: true, status: "gorusme_yapildi" }),
      lead({ isQualified: true, status: "ulasildi" }),
      lead({ isQualified: false, status: "randevu", hasAppointment: true }),
    ];
    expect(gate(computeGates(leads, [], NOW, H, S), "appt").value).toBe(50);
  });

  it("ulaşma: bir önceki haftanın (7 günü dolmuş) kohortundan; hedef satırı haftayı söyler", () => {
    const prev = (over: Partial<WeeklyLead>) => lead({ createdAt: at("2026-10-28", "10:00"), ...over });
    const reachLeads = [
      prev({ qReached: true, status: "yeni" }),
      prev({ status: "ulasildi" }),
      prev({ status: "kaybedildi", lostReason: "ulasilamadi" }),
      prev({ status: "kaybedildi", lostReason: "fiyat" }),
      prev({ status: "yeni" }),
      prev({ status: "ulasildi", source: "referans", adPlatform: null, channel: "telefon" }),
    ];
    // Toplantı haftasının velileri ulaşmaya girmez
    const weekLeads = [lead({ status: "yeni" }), lead({ status: "yeni" })];
    const g = gate(computeGates(weekLeads, [], NOW, H, S, { weekStart: WEEK, reachLeads }), "reach");
    expect(g.value).toBe(60);
    expect(g.display).toBe("%60");
    expect(g.label).toBe("Ulaşılan veli");
    expect(g.target).toBe("hedef en az %80 · 26 Ekim–1 Kasım haftası");
    expect(g.tone).toBe("red");
  });

  it("ulaşma: önceki hafta kohortu boşsa 'veri yok'", () => {
    const g = gate(computeGates([lead({ status: "ulasildi" })], [], NOW, H, S, { weekStart: WEEK, reachLeads: [] }), "reach");
    expect(g.display).toBe("veri yok");
    expect(g.tone).toBe("none");
  });

  it("ziyarete gelme: takvim haftasının randevuları, geldi / (geldi + gelmedi); hafta dışı sayılmaz", () => {
    const weekAppts = [
      appt("x1", "geldi"),
      appt("x2", "geldi", at("2026-11-02", "00:00")),
      appt("x3", "geldi", at("2026-11-08", "23:59")),
      appt("x4", "gelmedi"),
      appt("x5", "iptal"),
      appt("x6", "gelmedi", at("2026-11-09", "00:00")), // sonraki hafta
      appt("x7", "gelmedi", at("2026-11-01", "23:59")), // önceki hafta
    ];
    const g = gate(computeGates([], [], NOW, H, S, { weekStart: WEEK, weekAppts }), "show");
    expect(g.value).toBe(75);
    expect(g.label).toBe("Ziyarete gelen");
    expect(g.target).toBe("hedef en az %70");
    expect(g.tone).toBe("green");
  });

  it("ziyarete gelme: saati geçmiş ama sonucu girilmemiş randevu sayısı hedef satırında", () => {
    const now = istanbulAt("2026-11-06", "12:00");
    const weekAppts = [
      appt("a", "geldi", at("2026-11-03", "10:00")),
      appt("b", "bekliyor", at("2026-11-04", "10:00")),
      appt("c", null, at("2026-11-05", "10:00")),
      appt("d", "bekliyor", at("2026-11-07", "10:00")), // henüz saati gelmedi
    ];
    const g = gate(computeGates([], [], now, H, S, { weekStart: WEEK, weekAppts }), "show");
    expect(g.value).toBe(100);
    expect(g.target).toBe("hedef en az %70 · sonucu girilmemiş 2");
  });

  it("eşikler ayarlardan gelir", () => {
    const custom = { ...S, gates: { ...S.gates, firstCallMin: 10 } };
    const g = gate(computeGates([called(12)], [], NOW, H, custom), "firstCall");
    expect(g.tone).toBe("red");
    expect(g.target).toBe("hedef en fazla 10 dk (ideal 5)");
  });

  it("referans velisi kapılara girmez", () => {
    const ref = lead({ source: "referans", adPlatform: null, channel: "telefon", firstContactAt: at("2026-11-03", "12:00"), isQualified: true });
    const gates = computeGates([ref], [appt(ref.id, "gelmedi")], NOW, H, S);
    expect(gates.every((g) => g.display === "veri yok")).toBe(true);
  });

  it("computeWeekGates yükleyici çıktısıyla aynı sonucu verir", () => {
    const data = {
      weekStart: WEEK,
      leads: [called(6)],
      appts: [],
      reachLeads: [lead({ createdAt: at("2026-10-27", "10:00"), status: "ulasildi" })],
      weekAppts: [appt("z", "geldi")],
    };
    const gates = computeWeekGates(data, NOW, H, S);
    expect(gates.map((g) => g.display)).toEqual(["6 dk", "%100", "veri yok", "%100"]);
    expect(gates).toEqual(computeGates(data.leads, data.appts, NOW, H, S, data));
  });
});

describe("computeFunnel", () => {
  it("adımlar, oranlı düşüş ve en büyük düşüş", () => {
    const leads = [
      lead({ adPlatform: "google", status: "kazanildi", qReached: true, isQualified: true, hasAppointment: true }),
      lead({ adPlatform: "google", status: "randevu", qReached: true, isQualified: true, hasAppointment: true }),
      lead({ adPlatform: "meta", source: "instagram", status: "ulasildi", qReached: true, isQualified: true }),
      lead({ adPlatform: "meta", source: "instagram", status: "ulasildi", qReached: true, isQualified: true }),
      lead({ adPlatform: null, source: "instagram", channel: "ig_dm", status: "ulasildi", qReached: true }),
      lead({ adPlatform: null, source: "reklam", status: "kaybedildi", lostReason: "ulasilamadi" }),
      lead({ source: "referans", adPlatform: null, channel: "telefon", status: "kazanildi", isQualified: true }),
    ];
    const appts = [appt(leads[0].id, "geldi"), appt(leads[1].id, "gelmedi"), appt(leads[6].id, "geldi")];
    const f = computeFunnel(leads, appts);
    expect(f.steps.map((s) => [s.label, s.n])).toEqual([
      ["Gelen veli", 6],
      ["Ulaşılan", 5],
      ["Nitelikli", 4],
      ["Randevu", 2],
      ["Ziyarete gelen", 1],
      ["Kayıt", 1],
    ]);
    expect(f.steps.map((s) => s.dropPct)).toEqual([null, 17, 20, 50, 50, 0]);
    expect(f.steps.map((s) => s.worst)).toEqual([false, false, false, true, false, false]);
    // source='reklam' ve ad_platform boş → Google (K10); organik Instagram mesajı 'organik'
    expect(f.byPlatform).toEqual({ google: 3, meta: 2, organik: 1 });
    expect(f.lostReasons).toEqual([{ reason: "ulasilamadi", label: "Ulaşılamadı", n: 1 }]);
  });

  it("her veli ulaştığı en ileri aşamada sayılır, adımlar hiç artmaz", () => {
    const leads = [
      // Nitelik işaretlenmeden kayıt olmuş veli: tüm adımlarda sayılır
      lead({ status: "kazanildi", qReached: null, isQualified: false }),
      // Nitelikli değil ama ziyarete gelmiş veli
      lead({ status: "randevu", hasAppointment: true, isQualified: false, qReached: true }),
      lead({ status: "yeni" }),
    ];
    const f = computeFunnel(leads, [appt(leads[1].id, "geldi")]);
    expect(f.steps.map((s) => s.n)).toEqual([3, 2, 2, 2, 2, 1]);
    for (let i = 1; i < f.steps.length; i++) expect(f.steps[i].n).toBeLessThanOrEqual(f.steps[i - 1].n);
    expect(f.steps.map((s) => s.worst)).toEqual([false, false, false, false, false, true]);
    expect(f.steps.map((s) => s.dropPct)).toEqual([null, 33, 0, 0, 0, 50]);
  });

  it("kayıp nedenleri sayılır, çoktan aza", () => {
    const leads = [
      lead({ status: "kaybedildi", lostReason: "fiyat" }),
      lead({ status: "kaybedildi", lostReason: "yas_uymuyor" }),
      lead({ status: "kaybedildi", lostReason: "fiyat" }),
      lead({ status: "kaybedildi", lostReason: "uzaklik" }),
      lead({ status: "kaybedildi", lostReason: "fiyat" }),
      lead({ status: "kaybedildi", lostReason: "yas_uymuyor" }),
    ];
    expect(computeFunnel(leads, []).lostReasons).toEqual([
      { reason: "fiyat", label: "Fiyat", n: 3 },
      { reason: "yas_uymuyor", label: "Yaş uymuyor", n: 2 },
      { reason: "uzaklik", label: "Uzaklık", n: 1 },
    ]);
  });

  it("veli yokken bölme hatası yok, düşüş yok", () => {
    const f = computeFunnel([], []);
    expect(f.steps.map((s) => s.n)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(f.steps.every((s) => s.dropPct === null && !s.worst)).toBe(true);
    expect(f.byPlatform).toEqual({ google: 0, meta: 0, organik: 0 });
    expect(f.lostReasons).toEqual([]);
  });
});

describe("computeScorecard", () => {
  const z = "u-zehra";
  const s = "u-selin";
  const task = (assignedTo: string, dueDate: string, dueAt: string | null = null): WeeklyTask => ({ assignedTo, dueDate, dueAt });

  it("kişi başına ortanca ilk arama, ulaşma (önceki hafta), randevu, açık ve geciken görev", () => {
    const leads = [
      lead({ assignedTo: z, createdAt: at("2026-11-03", "10:00"), firstContactAt: at("2026-11-03", "10:05"), status: "ulasildi", qReached: true, isQualified: true }),
      lead({ assignedTo: z, createdAt: at("2026-11-03", "11:00"), firstContactAt: at("2026-11-03", "11:07"), status: "ulasildi", qReached: true, isQualified: true }),
      lead({ assignedTo: z, createdAt: at("2026-11-03", "12:00"), firstContactAt: at("2026-11-03", "12:03"), status: "randevu", qReached: true, isQualified: true, hasAppointment: true }),
      lead({ assignedTo: s, adPlatform: null, source: "instagram", channel: "ig_dm", createdAt: at("2026-11-04", "10:00"), firstContactAt: at("2026-11-04", "10:11"), status: "ulasildi", qReached: true, isQualified: true, hasAppointment: true }),
      lead({ assignedTo: s, source: "referans", adPlatform: null, channel: "telefon", status: "ulasildi", qReached: true }),
      lead({ assignedTo: null, status: "ulasildi" }),
    ];
    const prev = (over: Partial<WeeklyLead>) => lead({ createdAt: at("2026-10-28", "10:00"), ...over });
    const reachLeads = [
      prev({ assignedTo: z, status: "ulasildi" }),
      prev({ assignedTo: s, status: "ulasildi" }),
      prev({ assignedTo: s, status: "kaybedildi", lostReason: "ulasilamadi" }),
    ];
    const tasks = [
      task(s, "2026-11-06"), // geçmiş gün → gecikti
      task(s, "2026-11-09", at("2026-11-09", "08:30")), // saati geçti → gecikti
      task(z, "2026-11-09", at("2026-11-09", "17:00")), // bugün, saati gelmedi
      task(z, "2026-11-09"), // bugün, saatsiz → gecikmedi
    ];
    const names = new Map([[z, "Zehra"], [s, "Selin"]]);
    const rows = computeScorecard({ leads, reachLeads, tasks, names, hours: H, now: NOW, gates: S.gates });
    expect(rows).toEqual([
      { userId: s, name: "Selin", firstCallMedian: "11 dk", reachPct: "%50", apptPct: "%100", openTasks: 2, overdueTasks: 2, flags: { apptRed: false, tasksWarn: true } },
      { userId: z, name: "Zehra", firstCallMedian: "5 dk", reachPct: "%100", apptPct: "%33", openTasks: 2, overdueTasks: 0, flags: { apptRed: true, tasksWarn: false } },
    ]);
  });

  it("aranmamış veli ilk aramaya girer; hesaplanamayan oran 'veri yok'; bilinmeyen kişi", () => {
    const now = istanbulAt("2026-11-03", "10:20");
    const rows = computeScorecard({
      leads: [lead({ assignedTo: "u-x", createdAt: at("2026-11-03", "10:00"), status: "yeni" })],
      reachLeads: [],
      tasks: [],
      names: new Map(),
      hours: H,
      now,
      gates: { ...S.gates, apptPct: 50 },
    });
    expect(rows).toEqual([
      { userId: "u-x", name: "Bilinmeyen kişi", firstCallMedian: "20 dk", reachPct: "veri yok", apptPct: "veri yok", openTasks: 0, overdueTasks: 0, flags: { apptRed: false, tasksWarn: false } },
    ]);
  });

  it("randevu eşiği ayarlardan", () => {
    const leads = [lead({ assignedTo: z, isQualified: true, hasAppointment: true }), lead({ assignedTo: z, isQualified: true })];
    const run = (apptPct: number) =>
      computeScorecard({ leads, reachLeads: [], tasks: [], names: new Map(), hours: H, now: NOW, gates: { ...S.gates, apptPct } })[0].flags.apptRed;
    expect(run(50)).toBe(false);
    expect(run(60)).toBe(true);
  });
});

// ---- Yükleyici: sahte istemci ----
type Result = { data: unknown[] | null; error: { message: string } | null };
type Call = { table: string; ops: Array<[string, unknown[]]> };

function fakeClient(handlers: Record<string, (call: Call, range: [number, number]) => Result>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    let range: [number, number] = [0, 999];
    const b: Record<string, unknown> = {};
    for (const m of ["select", "gte", "lt", "eq", "in", "or", "order"]) {
      b[m] = (...args: unknown[]) => {
        call.ops.push([m, args]);
        return b;
      };
    }
    b.range = (f: number, t: number) => {
      range = [f, t];
      call.ops.push(["range", [f, t]]);
      return b;
    };
    b.then = (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) => {
      try {
        return Promise.resolve(resolve(handlers[table](call, range)));
      } catch (e) {
        return reject ? reject(e) : Promise.reject(e);
      }
    };
    return b;
  };
  return { client: { from } as never, calls };
}

const opArg = (c: Call, m: string) => c.ops.find(([op]) => op === m)?.[1];

describe("loadWeeklyData", () => {
  it("toplantı haftası ve önceki hafta velilerini, takvim haftası randevularını, görevleri ve adları okur", async () => {
    const total = 1150;
    const users = Array.from({ length: 150 }, (_, i) => `u${i}`);
    const weekFrom = "2026-11-01T21:00:00.000Z";
    const prevFrom = "2026-10-25T21:00:00.000Z";
    const { client, calls } = fakeClient({
      leads: (c, [f, t]) => {
        const prevWeek = (opArg(c, "gte") as string[])[1] === prevFrom;
        if (prevWeek) {
          return {
            data: f === 0 ? [
              { id: "p1", created_at: "2026-10-27T07:00:00Z", first_contact_at: null, status: "ulasildi", lost_reason: null, is_qualified: false, q_reached: true, source: "reklam", channel: "form", ad_platform: "google", content_code: null, assigned_to: "u-prev", appointments: [] },
            ] : [],
            error: null,
          };
        }
        return {
          data: Array.from({ length: Math.max(0, Math.min(t, total - 1) - f + 1) }, (_, k) => {
            const i = f + k;
            return {
              id: `l${i}`, created_at: "2026-11-03T07:00:00Z", first_contact_at: null, status: "yeni", lost_reason: null,
              is_qualified: i === 0 ? null : false, q_reached: null, source: i === 1 ? "referans" : "reklam",
              channel: i === 1 ? "telefon" : "form", ad_platform: i === 1 ? null : "google", content_code: null,
              assigned_to: users[i % users.length],
              appointments: i === 0 ? [{ scheduled_at: "2026-11-05T07:00:00Z", outcome: "geldi" }, { scheduled_at: "2026-11-06T07:00:00Z", outcome: "iptal" }]
                : i === 2 ? [{ scheduled_at: "2026-11-05T07:00:00Z", outcome: "iptal" }] : [],
            };
          }),
          error: null,
        };
      },
      appointments: () => ({
        data: [
          { lead_id: "old1", scheduled_at: "2026-11-04T07:00:00Z", outcome: "gelmedi", lead: { assigned_to: "u0", source: "instagram", channel: "ig_dm", ad_platform: null } },
          { lead_id: "ref1", scheduled_at: "2026-11-04T08:00:00Z", outcome: "geldi", lead: { assigned_to: "u0", source: "referans", channel: "telefon", ad_platform: null } },
        ],
        error: null,
      }),
      tasks: (c) => {
        const ids = (opArg(c, "in") as unknown[])[1] as string[];
        return {
          data: ids.includes("u0") ? [
            { assigned_to: "u0", due_date: "2026-11-05", due_at: null },
            { assigned_to: "u0", due_date: "2026-11-12", due_at: "2026-11-12T07:00:00Z" },
          ] : [],
          error: null,
        };
      },
      profiles: (c) => {
        const ids = (opArg(c, "in") as unknown[])[1] as string[];
        return { data: ids.map((id) => ({ id, full_name: `Ad ${id}` })), error: null };
      },
    });

    const data = await loadWeeklyData(client, "2026-11-02");
    expect(data.weekStart).toBe("2026-11-02");

    const weekLeadCalls = calls.filter((c) => c.table === "leads" && (opArg(c, "gte") as string[])[1] === weekFrom);
    expect(weekLeadCalls.map((c) => opArg(c, "range"))).toEqual([[0, 999], [1000, 1999]]);
    expect(weekLeadCalls[0].ops).toContainEqual(["lt", ["created_at", "2026-11-08T21:00:00.000Z"]]);
    expect(weekLeadCalls[0].ops).toContainEqual(["or", ["ad_platform.in.(google,meta),source.eq.reklam,channel.in.(ig_dm,ig_yorum)"]]);
    const prevCall = calls.find((c) => c.table === "leads" && (opArg(c, "gte") as string[])[1] === prevFrom)!;
    expect(prevCall.ops).toContainEqual(["lt", ["created_at", weekFrom]]);

    // Referans velisi süzgeçten kaçsa da düşer
    expect(data.leads).toHaveLength(total - 1);
    const l0 = data.leads.find((l) => l.id === "l0")!;
    expect(l0.isQualified).toBe(false);
    expect(l0.hasAppointment).toBe(true);
    expect(data.leads.find((l) => l.id === "l2")!.hasAppointment).toBe(false);
    expect(data.appts.filter((a) => a.leadId === "l0")).toEqual([
      { leadId: "l0", scheduledAt: "2026-11-05T07:00:00Z", outcome: "geldi", assignedTo: "u0" },
      { leadId: "l0", scheduledAt: "2026-11-06T07:00:00Z", outcome: "iptal", assignedTo: "u0" },
    ]);
    expect(data.reachLeads.map((l) => l.id)).toEqual(["p1"]);

    // Takvim haftası randevuları: K6 süzgeci ilişkili velide, referans düşer
    const apptCall = calls.find((c) => c.table === "appointments")!;
    expect((opArg(apptCall, "select") as string[])[0]).toContain("lead:leads!inner(");
    expect(apptCall.ops).toContainEqual(["gte", ["scheduled_at", weekFrom]]);
    expect(apptCall.ops).toContainEqual(["lt", ["scheduled_at", "2026-11-08T21:00:00.000Z"]]);
    expect(apptCall.ops).toContainEqual(["or", ["ad_platform.in.(google,meta),source.eq.reklam,channel.in.(ig_dm,ig_yorum)", { referencedTable: "lead" }]]);
    expect(data.weekAppts).toEqual([{ leadId: "old1", scheduledAt: "2026-11-04T07:00:00Z", outcome: "gelmedi", assignedTo: "u0" }]);

    // .in() listeleri ≤ 100
    for (const c of calls.filter((c) => c.table === "tasks" || c.table === "profiles")) {
      expect(((opArg(c, "in") as unknown[])[1] as string[]).length).toBeLessThanOrEqual(100);
    }
    const taskCall = calls.find((c) => c.table === "tasks")!;
    expect(taskCall.ops).toContainEqual(["eq", ["status", "acik"]]);
    expect(data.openTasksByUser.get("u0")).toBe(2);
    expect(data.openTasks.filter((t) => t.assignedTo === "u0")).toEqual([
      { assignedTo: "u0", dueDate: "2026-11-05", dueAt: null },
      { assignedTo: "u0", dueDate: "2026-11-12", dueAt: "2026-11-12T07:00:00Z" },
    ]);
    expect(data.names.get("u149")).toBe("Ad u149");
    expect(data.names.get("u-prev")).toBe("Ad u-prev");
    expect(data.names.size).toBe(151);
  });

  it("sorgu hatasında fırlatır", async () => {
    const { client } = fakeClient({
      leads: () => ({ data: null, error: { message: "leads boom" } }),
      appointments: () => ({ data: [], error: null }),
    });
    await expect(loadWeeklyData(client, "2026-11-02")).rejects.toThrow("leads boom");
  });
});
