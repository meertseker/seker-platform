import { describe, it, expect } from "vitest";
import {
  anyGateRed,
  computeFunnel,
  computeGates,
  computeScorecard,
  isAdSourced,
  isPaidAd,
  lastCompletedWeekStart,
  weekRange,
  type WeeklyAppt,
  type WeeklyLead,
} from "@/lib/ads/weekly";
import { loadWeeklyData } from "@/lib/queries/weekly";
import { DEFAULT_AD_SETTINGS } from "@/lib/ads/ad-settings";
import { DEFAULT_BUSINESS_HOURS, istanbulAt } from "@/lib/lead-flow/business-hours";

const H = DEFAULT_BUSINESS_HOURS;
const S = DEFAULT_AD_SETTINGS;
// Hafta: Pazartesi 2026-11-02 … Pazar 2026-11-08. Toplantı: Pazartesi 2026-11-16 (her veli 7 günü doldurdu).
const NOW = istanbulAt("2026-11-16", "09:00");

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
const appt = (leadId: string, outcome: string | null, assignedTo: string | null = null): WeeklyAppt => ({
  leadId,
  scheduledAt: at("2026-11-05", "10:00"),
  outcome,
  assignedTo,
});
const gate = (gates: ReturnType<typeof computeGates>, key: string) => gates.find((g) => g.key === key)!;

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

  it("ortanca çift sayıda ortadaki ikisinin ortalaması; firstContactAt olmayan sayılmaz", () => {
    const mk = (min: number) =>
      lead({ createdAt: at("2026-11-03", "10:00"), firstContactAt: new Date(Date.parse(at("2026-11-03", "10:00")) + min * 60000).toISOString() });
    const leads = [mk(4), mk(30), mk(10), mk(20), lead({ firstContactAt: null })];
    const g = gate(computeGates(leads, [], NOW, H, S), "firstCall");
    expect(g.value).toBe(15);
    expect(g.tone).toBe("green");
    const g2 = gate(computeGates([mk(10), mk(30)], [], NOW, H, S), "firstCall");
    expect(g2.value).toBe(20);
    expect(g2.tone).toBe("red");
  });

  it("veli yokken dört kapı 'veri yok', kırmızı değil", () => {
    const gates = computeGates([], [], NOW, H, S);
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
      Array.from({ length: total }, (_, i) => lead({ isQualified: true, qReached: true, status: "ulasildi", hasAppointment: i < withAppt }));
    // 2/7 = %28,6 → %29
    const red = computeGates(build(2, 7), [], NOW, H, S);
    expect(gate(red, "appt").display).toBe("%29");
    expect(gate(red, "appt").tone).toBe("red");
    expect(gate(red, "appt").target).toBe("hedef en az %35 · nitelikli velilerden");
    expect(anyGateRed(red)).toEqual({ red: true, labels: ["Randevu verilen"] });
    // 7/20 = %35
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
    const g = gate(computeGates(leads, [], NOW, H, S), "appt");
    expect(g.value).toBe(50);
  });

  it("ulaşma: qReached ya da 'ulaşılamadı' dışında ilerlemiş durum; 7 günü dolmamış veli sayılmaz", () => {
    const leads = [
      lead({ qReached: true, status: "yeni" }),
      lead({ status: "ulasildi" }),
      lead({ status: "kaybedildi", lostReason: "ulasilamadi" }),
      lead({ status: "kaybedildi", lostReason: "fiyat" }),
      lead({ status: "yeni" }),
    ];
    const g = gate(computeGates(leads, [], NOW, H, S), "reach");
    expect(g.value).toBe(60);
    expect(g.display).toBe("%60");
    expect(g.label).toBe("Ulaşılan veli");
    expect(g.target).toBe("hedef en az %80");
    expect(g.tone).toBe("red");

    // Çarşamba bakılan içinde bulunulan hafta: Pazartesi gelen veli henüz 7 gün doldurmadı.
    const midWeek = istanbulAt("2026-11-04", "12:00");
    const fresh = [lead({ createdAt: at("2026-11-02", "10:00"), status: "yeni" })];
    expect(gate(computeGates(fresh, [], midWeek, H, S), "reach").display).toBe("veri yok");
  });

  it("ulaşma: hafta bittiyse Pazar gelen veli 7 gün dolmadan sayılır", () => {
    const sunday = lead({ createdAt: at("2026-11-08", "20:00"), status: "ulasildi" });
    const g = gate(computeGates([sunday], [], istanbulAt("2026-11-09", "09:00"), H, S), "reach");
    expect(g.value).toBe(100);
    expect(g.tone).toBe("green");
  });

  it("ziyarete gelme: geldi / (geldi + gelmedi); bekleyen ve iptal sayılmaz", () => {
    const l = lead();
    const appts = [appt(l.id, "geldi"), appt(l.id, "geldi"), appt(l.id, "geldi"), appt(l.id, "gelmedi"), appt(l.id, "bekliyor"), appt(l.id, "iptal")];
    const g = gate(computeGates([l], appts, NOW, H, S), "show");
    expect(g.value).toBe(75);
    expect(g.label).toBe("Ziyarete gelen");
    expect(g.target).toBe("hedef en az %70");
    expect(g.tone).toBe("green");
  });

  it("eşikler ayarlardan gelir", () => {
    const l = lead({ createdAt: at("2026-11-03", "10:00"), firstContactAt: at("2026-11-03", "10:12") });
    const custom = { ...S, gates: { ...S.gates, firstCallMin: 10 } };
    const g = gate(computeGates([l], [], NOW, H, custom), "firstCall");
    expect(g.tone).toBe("red");
    expect(g.target).toBe("hedef en fazla 10 dk (ideal 5)");
  });

  it("referans velisi kapılara girmez", () => {
    const ref = lead({ source: "referans", adPlatform: null, channel: "telefon", firstContactAt: at("2026-11-03", "12:00") });
    const gates = computeGates([ref], [appt(ref.id, "gelmedi")], NOW, H, S);
    expect(gates.every((g) => g.display === "veri yok")).toBe(true);
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
    // Eşit düşüşte ilki işaretlenir
    expect(f.steps.map((s) => s.worst)).toEqual([false, false, false, true, false, false]);
    // Organik Instagram mesajı huniye girer, platform kırılımında 'organik'
    expect(f.byPlatform).toEqual({ google: 3, meta: 2, organik: 1 });
    expect(f.lostReasons).toEqual([{ reason: "ulasilamadi", label: "Ulaşılamadı", n: 1 }]);
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
  it("kişi başına ortanca ilk arama, ulaşma, randevu ve açık görev", () => {
    const z = "u-zehra";
    const s = "u-selin";
    const leads = [
      lead({ assignedTo: z, createdAt: at("2026-11-03", "10:00"), firstContactAt: at("2026-11-03", "10:05"), status: "ulasildi", qReached: true, isQualified: true }),
      lead({ assignedTo: z, createdAt: at("2026-11-03", "11:00"), firstContactAt: at("2026-11-03", "11:07"), status: "ulasildi", qReached: true, isQualified: true }),
      lead({ assignedTo: z, createdAt: at("2026-11-03", "12:00"), firstContactAt: at("2026-11-03", "12:03"), status: "randevu", qReached: true, isQualified: true, hasAppointment: true }),
      lead({ assignedTo: s, adPlatform: null, source: "instagram", channel: "ig_dm", createdAt: at("2026-11-04", "10:00"), firstContactAt: at("2026-11-04", "10:11"), status: "ulasildi", qReached: true, isQualified: true, hasAppointment: true }),
      lead({ assignedTo: s, status: "kaybedildi", lostReason: "ulasilamadi" }),
      lead({ assignedTo: s, source: "referans", adPlatform: null, channel: "telefon", status: "ulasildi", qReached: true }),
      lead({ assignedTo: null, status: "ulasildi" }),
    ];
    const tasks = new Map([[s, 2]]);
    const names = new Map([[z, "Zehra"], [s, "Selin"]]);
    const rows = computeScorecard(leads, [], tasks, names, H);
    expect(rows).toEqual([
      { userId: s, name: "Selin", firstCallMedian: "11 dk", reachPct: "%50", apptPct: "%100", openTasks: 2, flags: { apptRed: false, tasksWarn: true } },
      { userId: z, name: "Zehra", firstCallMedian: "5 dk", reachPct: "%100", apptPct: "%33", openTasks: 0, flags: { apptRed: true, tasksWarn: false } },
    ]);
  });

  it("hesaplanamayan oran 'veri yok', bilinmeyen kişi adı yerine kısa etiket", () => {
    const rows = computeScorecard([lead({ assignedTo: "u-x", status: "yeni" })], [], new Map(), new Map(), H);
    expect(rows).toEqual([
      { userId: "u-x", name: "Bilinmeyen kişi", firstCallMedian: "veri yok", reachPct: "%0", apptPct: "veri yok", openTasks: 0, flags: { apptRed: false, tasksWarn: false } },
    ]);
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

describe("loadWeeklyData", () => {
  it("haftanın reklam velilerini sayfalayarak okur, randevu, açık görev ve adları toplar", async () => {
    const total = 1150;
    const users = Array.from({ length: 150 }, (_, i) => `u${i}`);
    const { client, calls } = fakeClient({
      leads: (_c, [f, t]) => ({
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
      }),
      tasks: (c) => {
        const ids = (c.ops.find(([m]) => m === "in")![1][1] as string[]);
        return { data: ids.includes("u0") ? [{ assigned_to: "u0" }, { assigned_to: "u0" }] : [], error: null };
      },
      profiles: (c) => {
        const ids = (c.ops.find(([m]) => m === "in")![1][1] as string[]);
        return { data: ids.map((id) => ({ id, full_name: `Ad ${id}` })), error: null };
      },
    });

    const data = await loadWeeklyData(client, "2026-11-02");

    const leadCalls = calls.filter((c) => c.table === "leads");
    expect(leadCalls.map((c) => c.ops.find(([m]) => m === "range")![1])).toEqual([[0, 999], [1000, 1999]]);
    expect(leadCalls[0].ops).toContainEqual(["gte", ["created_at", "2026-11-01T21:00:00.000Z"]]);
    expect(leadCalls[0].ops).toContainEqual(["lt", ["created_at", "2026-11-08T21:00:00.000Z"]]);
    expect(leadCalls[0].ops).toContainEqual(["or", ["ad_platform.in.(google,meta),source.eq.reklam,channel.in.(ig_dm,ig_yorum)"]]);

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

    // .in() listeleri ≤ 100
    for (const c of calls.filter((c) => c.table === "tasks" || c.table === "profiles")) {
      expect((c.ops.find(([m]) => m === "in")![1][1] as string[]).length).toBeLessThanOrEqual(100);
    }
    const taskCall = calls.find((c) => c.table === "tasks")!;
    expect(taskCall.ops).toContainEqual(["eq", ["status", "acik"]]);
    expect(data.openTasksByUser.get("u0")).toBe(2);
    expect(data.names.get("u149")).toBe("Ad u149");
    expect(data.names.size).toBe(150);
  });

  it("sorgu hatasında fırlatır", async () => {
    const { client } = fakeClient({ leads: () => ({ data: null, error: { message: "leads boom" } }) });
    await expect(loadWeeklyData(client, "2026-11-02")).rejects.toThrow("leads boom");
  });
});
