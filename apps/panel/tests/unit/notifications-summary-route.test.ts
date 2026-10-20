import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const countResult = vi.fn();
const limit = vi.fn();
const order = vi.fn();

function table() {
  return {
    select: (_cols: string, opts?: { head?: boolean }) => {
      const chain: Record<string, unknown> = {};
      chain.eq = () => chain;
      chain.is = () => chain;
      chain.order = (...a: unknown[]) => {
        order(...a);
        return chain;
      };
      chain.limit = (n: number) => limit(n);
      chain.then = (res: (v: unknown) => unknown) => res(opts?.head ? countResult() : undefined);
      return chain;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getUser: () => getUser() }, from: () => table() }),
}));

import { GET } from "@/app/api/notifications/summary/route";

describe("GET /api/notifications/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("oturum yoksa 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("unread ve latestId döner, önbelleğe alınmaz", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    countResult.mockReturnValue({ count: 3, error: null });
    limit.mockResolvedValue({ data: [{ id: "n9" }], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ unread: 3, latestId: "n9" });
    expect(limit).toHaveBeenCalledWith(1);
    expect(order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
  });

  it("bildirim yoksa latestId null", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    countResult.mockReturnValue({ count: 0, error: null });
    limit.mockResolvedValue({ data: [], error: null });
    expect(await (await GET()).json()).toEqual({ unread: 0, latestId: null });
  });

  it("sayım hatasında 500 unavailable, no-store", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    countResult.mockReturnValue({ count: null, error: { message: "x" } });
    limit.mockResolvedValue({ data: [], error: null });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(console.error).toHaveBeenCalled();
  });

  it("son bildirim sorgusu hatasında 500 unavailable", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    countResult.mockReturnValue({ count: 2, error: null });
    limit.mockResolvedValue({ data: null, error: { message: "y" } });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });
});
