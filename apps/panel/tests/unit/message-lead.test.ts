import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Op = { table: string; op: string; payload?: unknown; filters: unknown[][] };
let ops: Op[] = [];
let respond: (o: Op) => { data?: unknown; error?: unknown } = () => ({ data: null, error: null });

function builder(table: string) {
  const o: Op = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const filter = (name: string) => (...a: unknown[]) => (o.filters.push([name, ...a]), b);
  for (const f of ["eq", "is", "not", "in", "gte", "order", "limit"]) b[f] = filter(f);
  b.select = () => b;
  b.insert = (p: unknown) => ((o.op = "insert"), (o.payload = p), b);
  b.update = (p: unknown) => ((o.op = "update"), (o.payload = p), b);
  b.single = () => b;
  b.maybeSingle = () => b;
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    ops.push(o);
    const r = respond(o);
    return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve, reject);
  };
  return b;
}
const from = vi.fn((table: string) => builder(table));
const getSessionProfile = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));
vi.mock("@/actions/appointments", () => ({ createAppointment: vi.fn() }));
vi.mock("@/actions/leads", () => ({ updateLeadStatus: vi.fn() }));

import { createMessageLead, recentContentCodes } from "@/actions/lead-flow";

const ME = "00000000-0000-0000-0000-000000000002";
let openLead: Record<string, unknown> | null;
const inserts = (t: string) => ops.filter((o) => o.table === t && o.op === "insert").map((o) => o.payload as Record<string, unknown>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T10:00:00+03:00"));
  ops = [];
  openLead = null;
  getSessionProfile.mockResolvedValue({ id: ME, full_name: "Zehra Hanım", role: "danisman" });
  respond = (o) => {
    if (o.table === "leads" && o.op === "select") return { data: openLead };
    if (o.table === "leads" && o.op === "insert") return { data: { id: "new-lead" } };
    return { data: null };
  };
});
afterEach(() => vi.useRealTimers());

describe("createMessageLead", () => {
  it("instagram mesajı instagram kaynağıyla ve boş sahipli açılır", async () => {
    const res = await createMessageLead({ channel: "ig_dm", phone: "0532 555 41 20", contentCode: "R-2645-A" });
    expect(res).toEqual({ id: "new-lead", duplicate: false });
    const lead = inserts("leads")[0];
    expect(lead).toMatchObject({
      source: "instagram", channel: "ig_dm", phone: "+905325554120",
      parent_name: "Instagram velisi", content_code: "R-2645-A", assigned_to: null,
    });
    expect(lead.created_at).toBe(new Date("2026-11-03T10:00:00+03:00").toISOString());
    const ev = inserts("events")[0];
    expect(ev).toMatchObject({ event_type: "lead_olusturuldu", entity_id: "new-lead" });
    expect(ev.payload).toMatchObject({ channel: "ig_dm" });
  });

  it("aynı telefonla açık veli varsa mükerrer döner ve kod eklenir", async () => {
    openLead = { id: "old-lead", content_code: null };
    const res = await createMessageLead({ channel: "whatsapp", phone: "05325554120", contentCode: "S-2640-B" });
    expect(res).toEqual({ id: "old-lead", duplicate: true });
    expect(inserts("leads")).toHaveLength(0);
    const open = ops.find((o) => o.table === "leads" && o.op === "select")!;
    expect(open.filters).toContainEqual(["eq", "phone", "+905325554120"]);
    expect(open.filters.some((f) => f[0] === "not" && f[1] === "status")).toBe(true);
    const patch = ops.find((o) => o.table === "leads" && o.op === "update")!.payload as Record<string, unknown>;
    expect(patch.content_code).toBe("S-2640-B");
    const note = inserts("lead_notes")[0];
    expect(note.lead_id).toBe("old-lead");
    expect(String(note.body)).toContain("WhatsApp");
    expect(String(note.body)).toContain("S-2640-B");
    expect(inserts("events")[0]).toMatchObject({ event_type: "mesaj_tekrar", entity_id: "old-lead" });
  });

  it("mevcut velinin kodu doluysa üzerine yazılmaz", async () => {
    openLead = { id: "old-lead", content_code: "R-1111-A" };
    await createMessageLead({ channel: "ig_dm", phone: "05325554120", contentCode: "S-2640-B" });
    const patch = ops.find((o) => o.table === "leads" && o.op === "update")!.payload as Record<string, unknown>;
    expect(patch).not.toHaveProperty("content_code");
  });

  it("geçersiz telefon hata döner", async () => {
    const res = await createMessageLead({ channel: "ig_dm", phone: "123" });
    expect(res).toHaveProperty("error");
    expect(ops).toHaveLength(0);
  });

  it("biçimi bozuk içerik kodu yok sayılır, ad verilmişse kullanılır", async () => {
    await createMessageLead({ channel: "telefon", phone: "05325554120", contentCode: "xx", parentName: " Merve " });
    expect(inserts("leads")[0]).toMatchObject({ content_code: null, parent_name: "Merve", source: "telefon" });
  });

  it("whatsapp adı boşsa WhatsApp velisi; verilen mesaj saati yazılır", async () => {
    await createMessageLead({ channel: "whatsapp", phone: "05325554120", messageAt: "2026-11-03T09:15" });
    const lead = inserts("leads")[0];
    expect(lead).toMatchObject({ parent_name: "WhatsApp velisi", source: "whatsapp" });
    expect(lead.created_at).toBe(new Date("2026-11-03T09:15:00+03:00").toISOString());
  });

  it("geçersiz kanal ve mesaj saati hata döner", async () => {
    expect(await createMessageLead({ channel: "x" as never, phone: "05325554120" })).toHaveProperty("error");
    expect(await createMessageLead({ channel: "ig_dm", phone: "05325554120", messageAt: "bozuk" })).toHaveProperty("error");
  });
});

describe("recentContentCodes", () => {
  it("son 28 günün kodlarını çoktan aza sayar", async () => {
    respond = () => ({ data: [{ content_code: "R-1-A" }, { content_code: "S-2-B" }, { content_code: "R-1-A" }] });
    expect(await recentContentCodes()).toEqual([{ code: "R-1-A", count: 2 }, { code: "S-2-B", count: 1 }]);
    expect(ops[0].filters.some((f) => f[0] === "gte" && f[1] === "created_at")).toBe(true);
  });
});
