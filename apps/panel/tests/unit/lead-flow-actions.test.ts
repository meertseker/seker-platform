import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Zincirlenebilir sahte Supabase: her sorgu `ops` içine kaydedilir, yanıtı `respond` verir.
type Op = { table: string; op: string; payload?: unknown; filters: unknown[][]; single?: boolean };
let ops: Op[] = [];
let respond: (o: Op) => { data?: unknown; error?: unknown } = () => ({ data: null, error: null });

function builder(table: string) {
  const o: Op = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const filter = (name: string) => (...a: unknown[]) => (o.filters.push([name, ...a]), b);
  for (const f of ["eq", "is", "or", "like", "in", "lt", "gte", "lte", "order", "limit"]) b[f] = filter(f);
  b.select = () => b;
  b.insert = (p: unknown) => ((o.op = "insert"), (o.payload = p), b);
  b.update = (p: unknown) => ((o.op = "update"), (o.payload = p), b);
  b.single = () => ((o.single = true), b);
  b.maybeSingle = () => ((o.single = true), b);
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    ops.push(o);
    try {
      const r = respond(o);
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve, reject);
    } catch (e) {
      return Promise.reject(e).then(resolve, reject);
    }
  };
  return b;
}
const from = vi.fn((table: string) => builder(table));

const getSessionProfile = vi.fn();
const createAppointment = vi.fn();
const updateLeadStatus = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));
vi.mock("@/actions/appointments", () => ({ createAppointment: (...a: unknown[]) => createAppointment(...a) }));
vi.mock("@/actions/leads", () => ({ updateLeadStatus: (...a: unknown[]) => updateLeadStatus(...a) }));

import { recordCall } from "@/actions/lead-flow";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/lead-flow/business-hours";

const ME = "00000000-0000-0000-0000-000000000002";
const quals = { age: true, area: true, timing: true, reached: false };

let lead: Record<string, unknown>;
let openTakip: string[];
let takipRows: { rule_key: string; created_at: string }[];
let reachEvents: { created_at: string }[];
let existingAppt: { id: string; scheduled_at: string } | null;
let claimRows: { id: string }[];
let settingsRows: { key: string; value: unknown }[];

const isClaim = (o: Op) => o.filters.some((f) => f[0] === "is" && f[1] === "first_contact_at");

function defaultRespond(o: Op) {
  if (o.table === "app_settings") return { data: settingsRows };
  if (o.table === "leads" && o.op === "select") return { data: lead };
  if (o.table === "leads" && o.op === "update") return isClaim(o) ? { data: claimRows } : { data: { status: lead.status } };
  if (o.table === "profiles") return { data: { full_name: "Zehra Hanım" } };
  if (o.table === "events" && o.op === "select") return { data: reachEvents };
  if (o.table === "tasks" && o.op === "select") {
    // Açık görevler deneme saatinden bir gün önce açılmış sayılır.
    return { data: [...takipRows, ...openTakip.map((rule_key) => ({ rule_key, created_at: "2026-11-02T07:00:00+00:00" }))] };
  }
  if (o.table === "appointments") return { data: existingAppt };
  return { data: null };
}

const inserts = (table: string) => ops.filter((o) => o.table === table && o.op === "insert").map((o) => o.payload as Record<string, unknown>);
const updates = (table: string) => ops.filter((o) => o.table === table && o.op === "update");
/** Üstlenme dışındaki ortak lead güncellemeleri. */
const leadPatches = () => updates("leads").filter((o) => !isClaim(o));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T10:00:00+03:00")); // Salı
  ops = [];
  respond = defaultRespond;
  openTakip = [];
  takipRows = [];
  reachEvents = [];
  existingAppt = null;
  claimRows = [{ id: "L1" }];
  settingsRows = [];
  lead = {
    id: "L1", parent_name: "Ayşe Yılmaz", phone: "+905321112233", status: "yeni", converted_student_id: null,
    first_contact_at: null, gclid: null, created_at: "2026-11-03T06:00:00Z", web_payload: null,
  };
  getSessionProfile.mockResolvedValue({ id: ME, full_name: "Danışman", role: "danisman" });
  updateLeadStatus.mockResolvedValue({});
  createAppointment.mockResolvedValue({ id: "A1" });
});
afterEach(() => vi.useRealTimers());

describe("recordCall", () => {
  it("ulaşılamadı ilk denemede +3 saat görevi kurar", async () => {
    const r = await recordCall({ leadId: "L1", result: "ulasilamadi", quals });
    expect("done" in r).toBe(true);
    if (!("done" in r)) return;
    expect(r.done[0]).toContain("3 saat sonra");
    expect(r.done[1]).toBe("Hazır WhatsApp mesajı var");
    const task = inserts("tasks").find((t) => t.rule_key === "takip:L1:2");
    expect(task).toMatchObject({
      lead_id: "L1", assigned_to: ME, auto_generated: true,
      due_at: new Date("2026-11-03T13:00:00+03:00").toISOString(), due_date: "2026-11-03",
    });
    // Ortak alanlar: ilk temas, sahiplik, nitelik, not ve olay
    const leadPatch = leadPatches()[0].payload as Record<string, unknown>;
    expect(leadPatch).toMatchObject({ assigned_to: ME, q_age_ok: true, q_reached: false });
    expect(leadPatch.first_contact_at).toBe(new Date().toISOString());
    expect(inserts("lead_notes")).toHaveLength(1);
    expect(inserts("events")[0]).toMatchObject({ event_type: "arama_kaydi", entity_id: "L1" });
    expect(updateLeadStatus).not.toHaveBeenCalled();
  });

  it("ulaşılamadı sonraki denemede görev saatini yazar ve önceki takip görevini kapatır", async () => {
    lead.first_contact_at = "2026-11-02T07:00:00Z";
    openTakip = ["takip:L1:3"];
    const r = await recordCall({ leadId: "L1", result: "ulasilamadi", quals });
    if (!("done" in r)) throw new Error("done bekleniyordu");
    expect(r.done[0]).toBe("Sonraki arama görevi açıldı: Salı 3 Kasım 18:30");
    expect(inserts("tasks")[0]).toMatchObject({ rule_key: "takip:L1:4" });
    const close = updates("tasks").find((u) => u.filters.some((f) => f[0] === "like" && f[2] === "takip:L1:%"));
    expect(close?.payload).toEqual({ status: "tamamlandi" });
    expect(close?.filters).toContainEqual(["eq", "status", "acik"]);
    expect((leadPatches()[0].payload as Record<string, unknown>).first_contact_at).toBeUndefined();
  });

  it("randevu takip görevlerini kapatır ve hatırlatmaları kurar", async () => {
    openTakip = ["takip:L1:3"];
    const r = await recordCall({
      leadId: "L1", result: "randevu", quals: { ...quals, reached: false }, appointmentAt: "2026-11-05T10:00",
    });
    expect(createAppointment).toHaveBeenCalledWith("L1", "2026-11-05T10:00", "okul_ziyareti");
    expect(r).toEqual({
      done: [
        "Ziyaret takvime yazıldı: Perşembe 5 Kasım 10:00",
        "WhatsApp onay mesajı hazır",
        "1 gün önce ve aynı sabah hatırlatma kuruldu",
      ],
    });
    expect((leadPatches()[0].payload as Record<string, unknown>).q_reached).toBe(true);
    const closed = updates("tasks").flatMap((u) => u.filters.filter((f) => f[0] === "like").map((f) => f[2]));
    expect(closed).toContain("takip:L1:%");
    // Hatırlatmaları createAppointment kurar; recordCall yeni randevuda tekrar yazmaz.
    expect(inserts("tasks")).toEqual([]);
  });

  it("randevu gclid'li ve yeni durumdaki velide dönüşüm satırını ekler", async () => {
    lead.gclid = "abc";
    respond = (o) =>
      o.table === "leads" && o.op === "update" && !isClaim(o) ? { data: { status: "randevu" } } : defaultRespond(o);
    const r = await recordCall({ leadId: "L1", result: "randevu", quals, appointmentAt: "2026-11-05T10:00" });
    if (!("done" in r)) throw new Error("done bekleniyordu");
    expect(r.done).toHaveLength(4);
    expect(r.done[3]).toBe("Google'a \"Randevu\" dönüşümü sıraya alındı");
  });

  it("randevu çakışmasında hiçbir şey yazmadan Türkçe hata döner", async () => {
    createAppointment.mockResolvedValue({ conflict: { leadName: "Mehmet Bey", at: "2026-11-05T07:15:00Z" } });
    const r = await recordCall({ leadId: "L1", result: "randevu", quals, appointmentAt: "2026-11-05T10:00" });
    expect(r).toEqual({ error: "Bu saate yakın başka bir randevu var: Mehmet Bey · Perşembe 5 Kasım 10:15. Başka bir saat seçin." });
    expect(inserts("lead_notes")).toHaveLength(0);
    expect(leadPatches()).toHaveLength(0);
  });

  it("5. başarısız denemeden sonra veli ulaşılamadı olarak kapanır", async () => {
    // İlk arama + 5 takip denemesi: son açık görev takip:L1:6 ("Son deneme").
    lead.first_contact_at = "2026-10-27T07:00:00Z";
    lead.status = "ulasildi";
    openTakip = ["takip:L1:6"];
    const r = await recordCall({ leadId: "L1", result: "ulasilamadi", quals });
    expect(r).toEqual({
      done: [
        "7 günde ulaşılamadı · veli Kaybedildi (Ulaşılamadı) olarak kapandı",
        "1 ay sonra kontenjan mesajı görevi kuruldu",
      ],
      closed: true,
    });
    expect(updateLeadStatus).toHaveBeenCalledWith("L1", "kaybedildi", "ulasilamadi");
    // Tek görev: 30 gün sonra (3 Aralık Perşembe) 10:00 kontenjan mesajı.
    expect(inserts("tasks")).toEqual([
      expect.objectContaining({
        lead_id: "L1",
        rule_key: "kontenjan:L1",
        title: "Kontenjan mesajı · Ayşe Yılmaz",
        due_at: "2026-12-03T07:00:00.000Z",
        due_date: "2026-12-03",
      }),
    ]);
  });

  it("geri ara tek görev kurar ve yeni veliyi ulaşıldıya alır", async () => {
    const r = await recordCall({ leadId: "L1", result: "geri_ara", quals, callbackAt: "2026-11-04T15:00" });
    expect(r).toEqual({
      done: ["Geri arama görevi açıldı: Çarşamba 4 Kasım 15:00", "Bugün ekranında o saatte en üstte çıkacak"],
    });
    expect(inserts("tasks")).toEqual([
      expect.objectContaining({ rule_key: "geri:L1", due_at: new Date("2026-11-04T15:00:00+03:00").toISOString() }),
    ]);
    expect(updateLeadStatus).toHaveBeenCalledWith("L1", "ulasildi", undefined);
  });

  it("uygun değil nedeni kayıp nedenine yazılır", async () => {
    const r = await recordCall({ leadId: "L1", result: "uygun_degil", quals, notFitReason: "yas_uymuyor" });
    expect(updateLeadStatus).toHaveBeenCalledWith("L1", "kaybedildi", "yas_uymuyor");
    expect(r).toEqual({ done: ["Kayıt kapatıldı · neden: Yaş uymuyor", "Açık takip görevleri kapandı"], closed: true });
    const closed = updates("tasks").flatMap((u) => u.filters.filter((f) => f[0] === "like").map((f) => f[2]));
    expect(closed).toContain("takip:L1:%");
  });

  it("ilk temastan önce başkası üstlendiyse hiçbir şey yazmadan reddeder", async () => {
    claimRows = [];
    lead.assigned_to = "00000000-0000-0000-0000-000000000003";
    const r = await recordCall({ leadId: "L1", result: "ulasilamadi", quals });
    expect(r).toEqual({ error: "Zehra Hanım bu veliyi arıyor" });
    expect(ops.filter((o) => o.op !== "select" && !isClaim(o))).toHaveLength(0);
    expect(updateLeadStatus).not.toHaveBeenCalled();
  });

  it("ilk temastan sonra üstlenme aranmaz", async () => {
    lead.first_contact_at = "2026-11-02T07:00:00Z";
    claimRows = [];
    const r = await recordCall({ leadId: "L1", result: "ulasilamadi", quals });
    expect(r).toHaveProperty("done");
    expect(ops.some(isClaim)).toBe(false);
  });

  it("randevu tekrar denemesinde aynı saatteki bekleyen randevuyu yeniden kullanır", async () => {
    const input = { leadId: "L1", result: "randevu" as const, quals, appointmentAt: "2026-11-05T10:00" };
    // İlk deneme: randevu yazıldı, not yazılamadı.
    respond = (o) => (o.table === "lead_notes" ? { error: { message: "boom" } } : defaultRespond(o));
    expect(await recordCall(input)).toEqual({
      error: "Ziyaret takvime yazıldı ancak arama kaydı tamamlanamadı; sayfayı yenileyin",
    });
    expect(createAppointment).toHaveBeenCalledTimes(1);

    // İkinci deneme: randevu artık var, yeniden oluşturulmaz.
    respond = defaultRespond;
    existingAppt = { id: "A1", scheduled_at: "2026-11-05T07:00:00+00:00" };
    const r = await recordCall(input);
    expect(createAppointment).toHaveBeenCalledTimes(1);
    if (!("done" in r)) throw new Error("done bekleniyordu");
    expect(r.done[0]).toBe("Ziyaret takvime yazıldı: Perşembe 5 Kasım 10:00");
    const lookup = ops.filter((o) => o.table === "appointments").pop()!;
    expect(lookup.filters).toEqual(expect.arrayContaining([
      ["eq", "lead_id", "L1"], ["eq", "outcome", "bekliyor"], ["eq", "scheduled_at", "2026-11-05T07:00:00.000Z"],
    ]));
    expect(inserts("tasks").map((t) => t.rule_key)).toContain("hatirlat:A1:sabah");
  });

  it("yeniden kullanılan randevuda görev hatası randevu yazıldı mesajı döner", async () => {
    existingAppt = { id: "A1", scheduled_at: "2026-11-05T07:00:00+00:00" };
    respond = (o) => (o.table === "tasks" && o.op === "insert" ? { error: { code: "XX000", message: "x" } } : defaultRespond(o));
    expect(await recordCall({ leadId: "L1", result: "randevu", quals, appointmentAt: "2026-11-05T10:00" })).toEqual({
      error: "Ziyaret takvime yazıldı ancak arama kaydı tamamlanamadı; sayfayı yenileyin",
    });
  });

  it("createAppointment uyarı döndürürse recordCall hatırlatmaları kendisi onarır", async () => {
    createAppointment.mockResolvedValue({ id: "A1", reminders: [], warning: "x" });
    const r = await recordCall({ leadId: "L1", result: "randevu", quals, appointmentAt: "2026-11-05T10:00" });
    expect("done" in r).toBe(true);
    expect(inserts("tasks").map((t) => t.rule_key)).toEqual(["hatirlat:A1:once", "hatirlat:A1:sabah"]);
  });

  it("createAppointment hata dönerse (hatırlatma kurulamadı) hata aynen iletilir", async () => {
    createAppointment.mockResolvedValue({ error: "Randevu kaydedildi, hatırlatma görevleri kurulamadı." });
    expect(await recordCall({ leadId: "L1", result: "randevu", quals, appointmentAt: "2026-11-05T10:00" })).toEqual({
      error: "Randevu kaydedildi, hatırlatma görevleri kurulamadı.",
    });
  });

  it("durum hatasında not ve olay yazılmaz", async () => {
    updateLeadStatus.mockResolvedValue({ error: "Durum güncellenemedi" });
    const r = await recordCall({ leadId: "L1", result: "uygun_degil", quals, notFitReason: "uzaklik" });
    expect(r).toEqual({ error: "Durum güncellenemedi" });
    expect(inserts("lead_notes")).toHaveLength(0);
    expect(inserts("events")).toHaveLength(0);
  });

  it("hatırlatma satırı kurulan görevlere göre yazılır", async () => {
    const run = async (appointmentAt: string) => {
      ops = [];
      const r = await recordCall({ leadId: "L1", result: "randevu", quals, appointmentAt });
      if (!("done" in r)) throw new Error("done bekleniyordu");
      return r.done;
    };
    vi.setSystemTime(new Date("2026-11-03T11:00:00+03:00"));
    // Yarın 16:00: bir gün önceki (bugün 10:00) geçti, yalnız sabah kalır.
    expect((await run("2026-11-04T16:00"))[2]).toBe("Ziyaret sabahı hatırlatma kuruldu");
    expect(inserts("tasks")).toEqual([]);
    // Bugün 16:00: ikisi de geçti, satır yok.
    const today = await run("2026-11-03T16:00");
    expect(today).toEqual(["Ziyaret takvime yazıldı: Salı 3 Kasım 16:00", "WhatsApp onay mesajı hazır"]);
    expect(inserts("tasks")).toHaveLength(0);
  });

  it("elle kapatılmış takip görevi sırayı 1'e döndürmez", async () => {
    lead.first_contact_at = "2026-11-02T07:00:00Z";
    lead.status = "ulasildi";
    takipRows = [
      { rule_key: "takip:L1:2", created_at: "2026-11-02T07:00:00+00:00" },
      { rule_key: "takip:L1:3", created_at: "2026-11-02T10:00:00+00:00" },
    ]; // ikisi de kapalı, açık takip yok
    const r = await recordCall({ leadId: "L1", result: "ulasilamadi", quals });
    if (!("done" in r)) throw new Error("done bekleniyordu");
    expect(inserts("tasks")[0]).toMatchObject({ rule_key: "takip:L1:4" });
    expect(inserts("lead_notes")[0].body).toContain("3. deneme");
  });

  it("başarılı ulaşmadan sonra yeni ulaşılamadı sırayı baştan başlatır", async () => {
    lead.first_contact_at = "2026-10-27T07:00:00Z";
    lead.status = "ulasildi";
    takipRows = [{ rule_key: "takip:L1:4", created_at: "2026-10-28T07:00:00+00:00" }];
    reachEvents = [{ created_at: "2026-10-30T07:00:00+00:00" }];
    const r = await recordCall({ leadId: "L1", result: "ulasilamadi", quals });
    if (!("done" in r)) throw new Error("done bekleniyordu");
    expect(r.done[0]).toBe("3 saat sonra tekrar arama görevi açıldı");
    expect(inserts("tasks")[0]).toMatchObject({ rule_key: "takip:L1:2" });
    const reachQuery = ops.find((o) => o.table === "events" && o.op === "select")!;
    expect(reachQuery.filters).toContainEqual(["in", "payload->>result", ["randevu", "geri_ara"]]);
  });

  it("geçmiş randevu ve geri arama saatini hiçbir şey yazmadan reddeder", async () => {
    // Sistem saati Salı 3 Kasım 10:00; tam şimdi de geçmiş sayılır.
    for (const appointmentAt of ["2026-11-03T09:59", "2026-11-03T10:00", "2026-11-02T16:00"]) {
      expect(await recordCall({ leadId: "L1", result: "randevu", quals, appointmentAt })).toEqual({
        error: "Geçmiş bir saat seçilemez",
      });
    }
    expect(await recordCall({ leadId: "L1", result: "geri_ara", quals, callbackAt: "2026-11-03T09:30" })).toEqual({
      error: "Geçmiş bir saat seçilemez",
    });
    expect(ops).toHaveLength(0);
    expect(createAppointment).not.toHaveBeenCalled();
    const ok = await recordCall({ leadId: "L1", result: "geri_ara", quals, callbackAt: "2026-11-03T10:01" });
    expect("done" in ok).toBe(true);
  });

  it("devam eden sonuçlarda closed bayrağı yoktur", async () => {
    expect(await recordCall({ leadId: "L1", result: "ulasilamadi", quals })).not.toHaveProperty("closed");
    const g = await recordCall({ leadId: "L1", result: "geri_ara", quals, callbackAt: "2026-11-04T15:00" });
    expect(g).not.toHaveProperty("closed");
    const a = await recordCall({ leadId: "L1", result: "randevu", quals, appointmentAt: "2026-11-05T10:00" });
    expect(a).not.toHaveProperty("closed");
  });

  it("WhatsApp satırı yalnız şablon ve geçerli telefon varken yazılır", async () => {
    // Şablon listesinde randevu_onay ve ulasilamadi yok.
    settingsRows = [{ key: "wa_sablonlari", value: [{ key: "kontenjan", label: "K", text: "Merhaba {veli}" }] }];
    const r = await recordCall({ leadId: "L1", result: "randevu", quals, appointmentAt: "2026-11-05T10:00" });
    if (!("done" in r)) throw new Error("done bekleniyordu");
    expect(r.done.some((l) => l.includes("WhatsApp"))).toBe(false);
    // Varsayılan şablonlar ama geçersiz telefon.
    settingsRows = [];
    lead.phone = "123";
    const u = await recordCall({ leadId: "L1", result: "ulasilamadi", quals });
    if (!("done" in u)) throw new Error("done bekleniyordu");
    expect(u.done.some((l) => l.includes("WhatsApp"))).toBe(false);
  });

  it("eksik girdiyi reddeder", async () => {
    expect(await recordCall({ leadId: "L1", result: "randevu", quals })).toHaveProperty("error");
    expect(await recordCall({ leadId: "L1", result: "geri_ara", quals })).toHaveProperty("error");
    expect(await recordCall({ leadId: "L1", result: "uygun_degil", quals })).toHaveProperty("error");
    expect(ops.filter((o) => o.op !== "select")).toHaveLength(0);
  });
});

describe("getLeadFlowSettings", () => {
  const db = () => ({ from }) as never;

  it("eksik anahtarlarda varsayılanı döner", async () => {
    settingsRows = [];
    const s = await getLeadFlowSettings(db());
    expect(s.hours).toEqual(DEFAULT_BUSINESS_HOURS);
    expect(s.claimMinutes).toBe(15);
    expect(s.districts).toContain("Beykent");
    expect(s.templates.map((t) => t.key)).toContain("randevu_onay");
    expect(s.callScript).toHaveLength(4);
    expect(s.priceAnswer).toMatch(/Aylık ücretlerimiz/);
  });

  it("bozuk değerlerde varsayılana döner, geçerlileri kullanır", async () => {
    settingsRows = [
      { key: "mesai", value: { days: [1, 2], start: "18:00", end: "09:00" } },
      { key: "servis_semtleri", value: "Beykent" },
      { key: "ustlenme_dk", value: 30 },
      { key: "fiyat_cevabi", value: "Fiyat metni" },
    ];
    const s = await getLeadFlowSettings(db());
    expect(s.hours).toEqual(DEFAULT_BUSINESS_HOURS);
    expect(s.districts).toContain("Esenyurt");
    expect(s.claimMinutes).toBe(30);
    expect(s.priceAnswer).toBe("Fiyat metni");

    settingsRows = [{ key: "mesai", value: { days: [1, 9], start: "08:00", end: "17:00" } }];
    expect((await getLeadFlowSettings(db())).hours).toEqual(DEFAULT_BUSINESS_HOURS);
    settingsRows = [{ key: "mesai", value: { days: [6], start: "09:00", end: "13:00" } }];
    expect((await getLeadFlowSettings(db())).hours).toEqual({ days: [6], start: "09:00", end: "13:00" });
  });
});
