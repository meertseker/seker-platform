import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadNotifications, countUnread } from "@/lib/queries/notifications";

const LEAD_A = "123e4567-e89b-12d3-a456-426614174000";
const LEAD_B = "223e4567-e89b-12d3-a456-426614174000";

type Row = { id: string; type: string; payload: unknown; read_at: string | null; created_at: string };
const row = (id: string, type: string, payload: unknown): Row => ({
  id,
  type,
  payload,
  read_at: null,
  created_at: "2026-10-20T10:00:00Z",
});

function makeSupabase(opts: {
  rows?: Row[];
  mainError?: boolean;
  leads?: { id: string; parent_name: string }[];
  leadsError?: boolean;
  count?: number | null;
}) {
  const leadsIn = vi.fn<(c: string, ids: string[]) => Promise<unknown>>(async () =>
    opts.leadsError ? { data: null, error: { message: "x" } } : { data: opts.leads ?? [], error: null },
  );
  const limit = vi.fn<(n: number) => Promise<unknown>>(async () =>
    opts.mainError ? { data: null, error: { message: "boom" } } : { data: opts.rows ?? [], error: null },
  );
  const calls: string[] = [];
  const notifChain: Record<string, unknown> = {};
  notifChain.eq = vi.fn(() => notifChain);
  notifChain.is = vi.fn(() => notifChain);
  notifChain.order = vi.fn(() => notifChain);
  notifChain.limit = limit;
  // head count: zincir await edilince sonuç verir
  notifChain.then = (res: (v: unknown) => unknown) =>
    res(opts.count === null ? { count: null, error: { message: "x" } } : { count: opts.count ?? 0, error: null });
  const from = vi.fn((table: string) => {
    calls.push(table);
    if (table === "leads") return { select: vi.fn(() => ({ in: leadsIn })) };
    return { select: vi.fn(() => notifChain) };
  });
  return { client: { from } as never, from, leadsIn, limit, calls, notifChain };
}

describe("loadNotifications", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("leadName ekler; bulunamayan lead için null", async () => {
    const s = makeSupabase({
      rows: [row("1", "web_basvuru", { leadId: LEAD_A }), row("2", "web_basvuru", { leadId: LEAD_B })],
      leads: [{ id: LEAD_A, parent_name: "Ayşe Yılmaz" }],
    });
    const items = await loadNotifications(s.client, "u1", { limit: 20 });
    expect(items.map((i) => i.leadName)).toEqual(["Ayşe Yılmaz", null]);
    expect(s.limit).toHaveBeenCalledWith(20);
  });

  it("uuid olmayan leadId'leri yok sayar ve leads sorgusu atmaz", async () => {
    const s = makeSupabase({
      rows: [row("1", "web_basvuru", { leadId: "abc" }), row("2", "web_basvuru", { leadId: 5 })],
    });
    const items = await loadNotifications(s.client, "u1", { limit: 20 });
    expect(items.every((i) => i.leadName === null)).toBe(true);
    expect(s.leadsIn).not.toHaveBeenCalled();
  });

  it("birden çok bildirim için tek leads sorgusu (tekilleştirilmiş)", async () => {
    const s = makeSupabase({
      rows: [
        row("1", "web_basvuru", { leadId: LEAD_A }),
        row("2", "veli_bekliyor", { leadId: LEAD_A }),
        row("3", "web_basvuru", { leadId: LEAD_B }),
      ],
      leads: [
        { id: LEAD_A, parent_name: "A" },
        { id: LEAD_B, parent_name: "B" },
      ],
    });
    await loadNotifications(s.client, "u1", { limit: 20 });
    expect(s.calls.filter((t) => t === "leads")).toHaveLength(1);
    expect(s.leadsIn).toHaveBeenCalledWith("id", [LEAD_A, LEAD_B]);
  });

  it("leads sorgusu hata verirse fırlatmaz, leadName null", async () => {
    const s = makeSupabase({ rows: [row("1", "web_basvuru", { leadId: LEAD_A })], leadsError: true });
    const items = await loadNotifications(s.client, "u1", { limit: 20 });
    expect(items[0].leadName).toBeNull();
  });

  it("payload düz nesne değilse {} olur", async () => {
    const s = makeSupabase({ rows: [row("1", "web_basvuru", null), row("2", "web_basvuru", [1])] });
    const items = await loadNotifications(s.client, "u1", { limit: 20 });
    expect(items.map((i) => i.payload)).toEqual([{}, {}]);
  });

  it("tanımsız tür tür başına bir kez uyarır", async () => {
    const s = makeSupabase({
      rows: [row("1", "yok_tur", {}), row("2", "yok_tur", {}), row("3", "baska_yok", {}), row("4", "web_basvuru", {})],
    });
    await loadNotifications(s.client, "u1", { limit: 20 });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("[bildirim] tanımsız tür", "yok_tur");
    expect(warn).toHaveBeenCalledWith("[bildirim] tanımsız tür", "baska_yok");
    // Aynı süreçte sonraki yüklemeler aynı türü tekrar loglamaz.
    await loadNotifications(s.client, "u1", { limit: 20 });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("ana sorgu hatasında [] döner ve loglar", async () => {
    const s = makeSupabase({ mainError: true });
    expect(await loadNotifications(s.client, "u1", { limit: 20 })).toEqual([]);
    expect(error).toHaveBeenCalled();
  });

  it("unreadOnly okunmamışlara filtreler", async () => {
    const s = makeSupabase({ rows: [] });
    await loadNotifications(s.client, "u1", { limit: 5, unreadOnly: true });
    expect(s.notifChain.is).toHaveBeenCalledWith("read_at", null);
  });
});

describe("countUnread", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("sayıyı döner", async () => {
    expect(await countUnread(makeSupabase({ count: 7 }).client, "u1")).toBe(7);
  });

  it("hatada 0", async () => {
    expect(await countUnread(makeSupabase({ count: null }).client, "u1")).toBe(0);
  });
});
