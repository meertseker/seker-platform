import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Notif = { id: string; user_id: string; type: string; payload: Record<string, unknown>; read_at: string | null };
let notifs: Notif[] = [];
let yoneticiler: Array<{ id: string }> = [];
let appts: Array<Record<string, unknown>> = [];
let installments: Array<{ amount: number }> = [];
// #4: günlük cron, takipsiz listesinden ileri tarihli ziyareti olan veliyi düşürür (loadFutureVisitLeadIds).
let futureAppts: Array<{ lead_id: string | null; scheduled_at: string }> = [];
let staleLeads: Array<{ id: string; parent_name: string; assigned_to: string }> = [];
let taskInserts: Array<Record<string, unknown>> = [];
let updateError: { message: string } | null = null;
let insertFailFor = new Set<string>();
let seq = 0;

const pathValue = (n: Notif, col: string) =>
  col.startsWith("payload->>") ? String(n.payload[col.slice(10)] ?? "") : (n as unknown as Record<string, unknown>)[col];

/** Zincirlenebilir, await edilebilir sahte sorgu; notifications tablosu bellekte tutulur. */
function query(table: string) {
  type Pred = (n: Notif) => boolean;
  const preds: Pred[] = [];
  let patch: Record<string, unknown> | null = null;
  // appointments iki sorguda okunur: bugünkü randevular (gte/lte) ve ileri tarihli ziyaretler (gt).
  let futureQuery = false;
  const q: Record<string, unknown> = {
    select: () => q,
    update: (p: Record<string, unknown>) => {
      patch = p;
      return q;
    },
    eq: (c: string, v: unknown) => (preds.push((n) => pathValue(n, c) === v), q),
    is: (c: string, v: unknown) => (preds.push((n) => pathValue(n, c) === v), q),
    neq: (c: string, v: unknown) => (preds.push((n) => pathValue(n, c) !== v), q),
    lt: (c: string, v: string) => (preds.push((n) => String(pathValue(n, c)) < v), q),
    in: () => q,
    not: () => q,
    gte: () => q,
    lte: () => q,
    gt: () => ((futureQuery = true), q),
    limit: () => q,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: { value: 3 }, error: null }),
    insert: (rows: Array<Omit<Notif, "id" | "read_at">> | Record<string, unknown>) => {
      if (table === "notifications") {
        const list = rows as Array<Omit<Notif, "id" | "read_at">>;
        if (list.some((r) => insertFailFor.has(r.user_id))) return Promise.resolve({ error: { message: "insert boom" } });
        for (const r of list) notifs.push({ ...r, id: `n${++seq}`, read_at: null });
      }
      if (table === "tasks") taskInserts.push(rows as Record<string, unknown>);
      return Promise.resolve({ error: null });
    },
    then: (resolve: (v: unknown) => void) => {
      if (table === "notifications") {
        const hit = notifs.filter((n) => preds.every((p) => p(n)));
        if (patch) {
          if (updateError) return resolve({ error: updateError });
          for (const n of hit) Object.assign(n, patch);
          return resolve({ error: null });
        }
        return resolve({ data: hit.map((n) => ({ id: n.id })), error: null });
      }
      if (table === "profiles") return resolve({ data: yoneticiler, error: null });
      if (table === "appointments") return resolve({ data: futureQuery ? futureAppts : appts, error: null });
      if (table === "leads") return resolve({ data: staleLeads, error: null });
      if (table === "installments") return resolve({ data: installments, error: null });
      return resolve({ data: [], error: null });
    },
  };
  return q;
}
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (t: string) => query(t) }) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/daily/route";

const request = (auth?: string) =>
  new NextRequest("http://localhost/api/cron/daily", { headers: auth ? { authorization: auth } : {} });
const OK = "Bearer s3cret";
const MONDAY = "2026-10-19T09:00:00+03:00";
const TUESDAY = "2026-10-20T09:00:00+03:00";
const unread = (type: string) => notifs.filter((n) => n.type === type && n.read_at === null);

beforeEach(() => {
  notifs = [];
  seq = 0;
  updateError = null;
  insertFailFor = new Set();
  yoneticiler = [{ id: "y1" }];
  appts = [];
  installments = [];
  futureAppts = [];
  staleLeads = [];
  taskInserts = [];
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://x");
  vi.stubEnv("SUPABASE_SECRET_KEY", "k");
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TUESDAY));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/daily", () => {
  it("yetkisiz istek 401", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer yanlis"))).status).toBe(401);
    expect(notifs).toHaveLength(0);
  });

  it("ileri tarihli ziyareti olan veliye takipsiz görevi açılmaz", async () => {
    staleLeads = [
      { id: "l1", parent_name: "Ayşe", assigned_to: "c1" },
      { id: "l2", parent_name: "Fatma", assigned_to: "c1" },
    ];
    futureAppts = [{ lead_id: "l1", scheduled_at: "2026-10-25T10:00:00+03:00" }];
    const res = await GET(request(OK));
    expect(res.status).toBe(200);
    expect(taskInserts.map((t) => t.rule_key)).toEqual(["takipsiz:l2"]);
  });

  it("randevu_bugun payload'ı parentName taşır (nesne ve dizi join'i)", async () => {
    appts = [
      { id: "a1", scheduled_at: "2026-10-20T10:00:00+03:00", lead_id: "l1", created_by: "c1", leads: { parent_name: "Ayşe" } },
      { id: "a2", scheduled_at: "2026-10-20T11:00:00+03:00", lead_id: "l2", created_by: "y1", leads: [{ parent_name: "Fatma" }] },
      { id: "a3", scheduled_at: "2026-10-20T12:00:00+03:00", lead_id: "l3", created_by: "y1", leads: null },
    ];
    const res = await GET(request(OK));
    expect(res.status).toBe(200);
    const byAppt = (id: string) => notifs.find((n) => n.payload.appointmentId === id)!.payload;
    expect(byAppt("a1")).toEqual({
      appointmentId: "a1", leadId: "l1", at: "2026-10-20T10:00:00+03:00", tarih: "2026-10-20", parentName: "Ayşe",
    });
    expect(byAppt("a2").parentName).toBe("Fatma");
    expect(byAppt("a3").parentName ?? null).toBeNull();
  });

  it("aynı gün ikinci çalışmada yeni satır eklenmez", async () => {
    appts = [{ id: "a1", scheduled_at: "2026-10-20T10:00:00+03:00", lead_id: "l1", created_by: "c1", leads: { parent_name: "Ayşe" } }];
    await GET(request(OK));
    const first = notifs.length;
    expect(first).toBe(2);
    await GET(request(OK));
    expect(notifs).toHaveLength(first);
  });

  it("aynı gün randevu saati değişince yeni satır eklenir, eskisi okundu olur", async () => {
    appts = [{ id: "a1", scheduled_at: "2026-10-20T10:00:00+03:00", lead_id: "l1", created_by: "y1", leads: { parent_name: "Ayşe" } }];
    await GET(request(OK));
    appts = [{ id: "a1", scheduled_at: "2026-10-20T15:00:00+03:00", lead_id: "l1", created_by: "y1", leads: { parent_name: "Ayşe" } }];
    await GET(request(OK));
    const rows = notifs.filter((n) => n.type === "randevu_bugun");
    expect(rows).toHaveLength(2);
    expect(unread("randevu_bugun").map((n) => n.payload.at)).toEqual(["2026-10-20T15:00:00+03:00"]);
  });

  it("dünkü okunmamış randevu_bugun her çalışmada okundu işaretlenir; bugünküne dokunulmaz", async () => {
    notifs = [
      { id: "old", user_id: "y1", type: "randevu_bugun", payload: { tarih: "2026-10-19" }, read_at: null },
      { id: "today", user_id: "y1", type: "randevu_bugun", payload: { tarih: "2026-10-20" }, read_at: null },
    ];
    await GET(request(OK));
    expect(notifs.find((n) => n.id === "old")!.read_at).not.toBeNull();
    expect(notifs.find((n) => n.id === "today")!.read_at).toBeNull();
  });

  it("Pazartesi yeni geciken_ozet eklenince eski okunmamış özetler okundu olur", async () => {
    vi.setSystemTime(new Date(MONDAY));
    installments = [{ amount: 1000 }];
    notifs = [{ id: "oldozet", user_id: "y1", type: "geciken_ozet", payload: { tarih: "2026-10-12" }, read_at: null }];
    await GET(request(OK));
    expect(notifs.find((n) => n.id === "oldozet")!.read_at).not.toBeNull();
    const fresh = unread("geciken_ozet");
    expect(fresh).toHaveLength(1);
    expect(fresh[0].payload.tarih).toBe("2026-10-19");
  });

  it("Pazartesi yeniden çalışırsa bugünkü özet okunmaz ve çoğalmaz", async () => {
    vi.setSystemTime(new Date(MONDAY));
    installments = [{ amount: 1000 }];
    await GET(request(OK));
    await GET(request(OK));
    expect(notifs.filter((n) => n.type === "geciken_ozet")).toHaveLength(1);
    expect(unread("geciken_ozet")).toHaveLength(1);
  });

  it("Pazartesi özeti bir yöneticiye yazılamazsa onun eski özeti okunmamış kalır", async () => {
    vi.setSystemTime(new Date(MONDAY));
    installments = [{ amount: 1000 }];
    yoneticiler = [{ id: "y1" }, { id: "y2" }];
    insertFailFor = new Set(["y2"]);
    notifs = [
      { id: "old1", user_id: "y1", type: "geciken_ozet", payload: { tarih: "2026-10-12" }, read_at: null },
      { id: "old2", user_id: "y2", type: "geciken_ozet", payload: { tarih: "2026-10-12" }, read_at: null },
    ];
    await GET(request(OK));
    expect(notifs.find((n) => n.id === "old1")!.read_at).not.toBeNull();
    expect(notifs.find((n) => n.id === "old2")!.read_at).toBeNull();
  });

  it("Pazartesi dışı günde eski özetlere dokunulmaz", async () => {
    notifs = [{ id: "oldozet", user_id: "y1", type: "geciken_ozet", payload: { tarih: "2026-10-12" }, read_at: null }];
    await GET(request(OK));
    expect(notifs[0].read_at).toBeNull();
  });

  it("temizlik hatası loglanır, rota yine ok döner", async () => {
    updateError = { message: "boom" };
    const res = await GET(request(OK));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });
});
