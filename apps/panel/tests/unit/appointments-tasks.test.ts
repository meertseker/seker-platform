import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getSessionProfile = vi.fn();
const updateLeadStatus = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@/actions/leads", () => ({ updateLeadStatus: (...a: unknown[]) => updateLeadStatus(...a) }));

type Op = { table: string; op: string; payload?: Record<string, unknown>; likes: string[] };
let ops: Op[] = [];
let tables: Record<string, unknown> = {};

function builder(table: string) {
  const op: Op = { table, op: "select", likes: [] };
  const result = () => {
    ops.push(op);
    const v = tables[`${table}:${op.op}`] ?? tables[table] ?? null;
    return { data: v, error: null };
  };
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "eq", "gte", "lte", "order", "limit", "in"]) b[m] = chain;
  b.like = (_c: string, v: string) => {
    op.likes.push(v);
    return b;
  };
  b.insert = (p: Record<string, unknown>) => {
    op.op = "insert";
    op.payload = p;
    return b;
  };
  b.update = (p: Record<string, unknown>) => {
    op.op = "update";
    op.payload = p;
    return b;
  };
  b.single = async () => result();
  b.maybeSingle = async () => result();
  b.then = (res: (v: unknown) => unknown) => {
    const r = result();
    if (failTaskInsert && table === "tasks" && op.op === "insert") {
      return Promise.resolve({ data: null, error: { code: "XX000", message: "x" } }).then(res);
    }
    return Promise.resolve(r).then(res);
  };
  return b;
}
let failTaskInsert = false;
const from = vi.fn((t: string) => builder(t));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));

import { createAppointment, setAppointmentOutcome } from "@/actions/appointments";

const taskInserts = () => ops.filter((o) => o.table === "tasks" && o.op === "insert").map((o) => o.payload!);
const closes = () => ops.filter((o) => o.table === "tasks" && o.op === "update");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T07:00:00Z")); // Pazartesi 10:00 İstanbul
  ops = [];
  failTaskInsert = false;
  vi.clearAllMocks();
  getSessionProfile.mockResolvedValue({ id: "caller" });
  updateLeadStatus.mockResolvedValue({});
  tables = {
    "leads:select": { id: "L1", status: "yeni", parent_name: "Ayşe Hanım", assigned_to: "agent" },
    "appointments:insert": { id: "A1" },
    "appointments:update": {
      id: "A1",
      lead_id: "L1",
      created_by: "creator",
      lead: { parent_name: "Ayşe Hanım", assigned_to: null },
    },
  };
});
afterEach(() => vi.useRealTimers());

describe("randevu görevleri", () => {
  it("randevu oluşunca iki hatırlatma görevi kurulur", async () => {
    const res = await createAppointment("L1", "2026-11-05T10:00", "okul_ziyareti", true);
    expect(res.id).toBe("A1");
    const t = taskInserts();
    expect(t.map((x) => x.rule_key)).toEqual(["hatirlat:A1:once", "hatirlat:A1:sabah"]);
    expect(t.every((x) => x.assigned_to === "agent" && x.lead_id === "L1")).toBe(true);
    expect(res.reminders?.map((r) => r.ruleKey)).toEqual(["hatirlat:A1:once", "hatirlat:A1:sabah"]);
  });

  it("veli atanmamışsa görev oluşturana, o da yoksa çağırana atanır", async () => {
    tables["leads:select"] = { id: "L1", status: "yeni", parent_name: "Ayşe", assigned_to: null };
    await createAppointment("L1", "2026-11-05T10:00", "okul_ziyareti", true);
    expect(taskInserts()).toHaveLength(2);
    expect(taskInserts().every((x) => x.assigned_to === "caller")).toBe(true);
  });

  it("geldi işaretlenince hatırlatmalar kapanır, ziyaret sonrası 3 görev kurulur", async () => {
    await setAppointmentOutcome("A1", "geldi");
    expect(closes().map((c) => c.likes[0])).toEqual(["hatirlat:A1:%"]);
    expect(taskInserts().map((x) => x.rule_key)).toEqual(["ziyaret:A1:1", "ziyaret:A1:2", "ziyaret:A1:3"]);
    expect(taskInserts().every((x) => x.assigned_to === "creator")).toBe(true);
  });

  it("geldi: randevu durumundaki veli görüşme yapıldı olur ve yapılanlar listelenir (B1)", async () => {
    (tables["appointments:update"] as { lead: Record<string, unknown> }).lead.status = "randevu";
    const res = await setAppointmentOutcome("A1", "geldi");
    expect(res.error).toBeUndefined();
    expect(updateLeadStatus).toHaveBeenCalledWith("L1", "gorusme_yapildi");
    // Pazartesi 2 Kasım ziyareti: +1 Salı, +2 Çarşamba, +7 Pazartesi 9 Kasım, hepsi 10:00.
    expect(res.done).toEqual([
      "Veli \"Görüşme yapıldı\" durumuna geçti",
      "Teşekkür mesajı görevi: Salı 3 Kasım 10:00",
      "Ziyaret sonrası arama görevi: Çarşamba 4 Kasım 10:00",
      "Son arama görevi: Pazartesi 9 Kasım 10:00",
    ]);
  });

  it("geldi: yeni ve ulaşıldı da görüşme yapıldıya geçer; teklif ve sonrası değişmez", async () => {
    const lead = (tables["appointments:update"] as { lead: Record<string, unknown> }).lead;
    for (const status of ["yeni", "ulasildi"]) {
      updateLeadStatus.mockClear();
      lead.status = status;
      await setAppointmentOutcome("A1", "geldi");
      expect(updateLeadStatus).toHaveBeenCalledWith("L1", "gorusme_yapildi");
    }
    for (const status of ["gorusme_yapildi", "teklif", "beklemede", "kazanildi"]) {
      updateLeadStatus.mockClear();
      lead.status = status;
      const res = await setAppointmentOutcome("A1", "geldi");
      expect(updateLeadStatus).not.toHaveBeenCalled();
      expect(res.done?.[0]).toBe("Teşekkür mesajı görevi: Salı 3 Kasım 10:00");
    }
  });

  it("geldi: durum güncellenemezse sonuç kaydedildi, tekrar bas hatası döner", async () => {
    (tables["appointments:update"] as { lead: Record<string, unknown> }).lead.status = "randevu";
    updateLeadStatus.mockResolvedValue({ error: "Durum güncellenemedi" });
    const res = await setAppointmentOutcome("A1", "geldi");
    expect(res.error).toBe("Sonuç kaydedildi ama veli durumu güncellenemedi, lütfen tekrar basın");
  });

  it("gelmedi işaretlenince hatırlatmalar kapanır, aynı gün noshow görevi kurulur, durum değişmez", async () => {
    (tables["appointments:update"] as { lead: Record<string, unknown> }).lead.status = "randevu";
    const res = await setAppointmentOutcome("A1", "gelmedi");
    expect(closes().map((c) => c.likes[0])).toEqual(["hatirlat:A1:%"]);
    const t = taskInserts();
    expect(t.map((x) => x.rule_key)).toEqual(["noshow:A1"]);
    expect(t[0].due_date).toBe("2026-11-02");
    expect(updateLeadStatus).not.toHaveBeenCalled();
    expect(res.done).toEqual(["Tekrar arama görevi açıldı: Pazartesi 2 Kasım 10:00"]);
  });

  it("iptal ya da ertelendi olunca hatırlatmalar kapanır, yeni görev kurulmaz", async () => {
    for (const o of ["iptal", "ertelendi"] as const) {
      ops = [];
      const res = await setAppointmentOutcome("A1", o);
      expect(closes().map((c) => c.likes[0])).toEqual(["hatirlat:A1:%"]);
      expect(taskInserts()).toEqual([]);
      expect(res.done).toEqual(["Ziyaret hatırlatmaları kapatıldı"]);
      expect(updateLeadStatus).not.toHaveBeenCalled();
    }
  });

  it("hatırlatma kurulamazsa randevu yine başarıdır: id + warning, hata yok", async () => {
    failTaskInsert = true;
    const res = await createAppointment("L1", "2026-11-05T10:00", "okul_ziyareti", true);
    expect(res.error).toBeUndefined();
    expect(res.id).toBe("A1");
    expect(res.warning).toBe("Randevu kaydedildi, hatırlatma görevleri kurulamadı");
    expect(res.reminders).toEqual([]);
  });

  it("lead.assigned_to, created_by'ın önüne geçer", async () => {
    (tables["appointments:update"] as { lead: unknown }).lead = { parent_name: "Ayşe", assigned_to: "agent" };
    await setAppointmentOutcome("A1", "gelmedi");
    expect(taskInserts()[0].assigned_to).toBe("agent");
  });

  it("görev adımı düşerse sonuç kaydedildi ama tekrar bas hatası döner", async () => {
    failTaskInsert = true;
    const res = await setAppointmentOutcome("A1", "gelmedi");
    expect(res.error).toBe("Sonuç kaydedildi ama görevler kurulamadı, lütfen tekrar basın");
  });

  it("aynı sonuçla ikinci çağrı görevleri yeniden uzlaştırır ve başarılı döner", async () => {
    tables["appointments:update"] = null; // zaten sonuçlanmış: koşullu update satır bulamaz
    tables["appointments:select"] = {
      outcome: "gelmedi",
      id: "A1",
      lead_id: "L1",
      created_by: "creator",
      lead: { parent_name: "Ayşe Hanım", assigned_to: null },
    };
    const res = await setAppointmentOutcome("A1", "gelmedi");
    expect(res.error).toBeUndefined();
    expect(res.id).toBe("A1");
    expect(closes().map((c) => c.likes[0])).toEqual(["hatirlat:A1:%"]);
    expect(taskInserts().map((x) => x.rule_key)).toEqual(["noshow:A1"]);
    expect(ops.some((o) => o.table === "events")).toBe(false);
  });

  it("çözülmüş randevuda farklı sonuç hata döner", async () => {
    tables["appointments:update"] = null;
    tables["appointments:select"] = { outcome: "geldi", id: "A1", lead_id: "L1", created_by: "c", lead: null };
    const res = await setAppointmentOutcome("A1", "gelmedi");
    expect(res.error).toBe("Randevu zaten sonuçlandırılmış");
    expect(taskInserts()).toEqual([]);
    expect(closes()).toEqual([]);
  });
});
