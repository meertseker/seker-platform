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
  b.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
  return b;
}
const from = vi.fn((t: string) => builder(t));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));

import { createAppointment, setAppointmentOutcome } from "@/actions/appointments";

const taskInserts = () => ops.filter((o) => o.table === "tasks" && o.op === "insert").map((o) => o.payload!);
const closes = () => ops.filter((o) => o.table === "tasks" && o.op === "update");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T07:00:00Z")); // Pazartesi 10:00 İstanbul
  ops = [];
  vi.clearAllMocks();
  getSessionProfile.mockResolvedValue({ id: "caller" });
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

  it("gelmedi işaretlenince hatırlatmalar kapanır, aynı gün noshow görevi kurulur", async () => {
    await setAppointmentOutcome("A1", "gelmedi");
    expect(closes().map((c) => c.likes[0])).toEqual(["hatirlat:A1:%"]);
    const t = taskInserts();
    expect(t.map((x) => x.rule_key)).toEqual(["noshow:A1"]);
    expect(t[0].due_date).toBe("2026-11-02");
  });

  it("iptal ya da ertelendi olunca hatırlatmalar kapanır, yeni görev kurulmaz", async () => {
    for (const o of ["iptal", "ertelendi"] as const) {
      ops = [];
      await setAppointmentOutcome("A1", o);
      expect(closes().map((c) => c.likes[0])).toEqual(["hatirlat:A1:%"]);
      expect(taskInserts()).toEqual([]);
    }
  });
});
