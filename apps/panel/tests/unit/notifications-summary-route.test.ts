import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const countUnread = vi.fn();
const limit = vi.fn();
const chain: Record<string, unknown> = {};
chain.eq = vi.fn(() => chain);
chain.order = vi.fn(() => chain);
chain.limit = (n: number) => limit(n);
const from = vi.fn(() => ({ select: vi.fn(() => chain) }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getUser: () => getUser() }, from }),
}));
vi.mock("@/lib/queries/notifications", () => ({
  countUnread: (...a: unknown[]) => countUnread(...a),
}));

import { GET } from "@/app/api/notifications/summary/route";

describe("GET /api/notifications/summary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("oturum yoksa 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(countUnread).not.toHaveBeenCalled();
  });

  it("unread ve latestId döner, önbelleğe alınmaz", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    countUnread.mockResolvedValue(3);
    limit.mockResolvedValue({ data: [{ id: "n9" }], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ unread: 3, latestId: "n9" });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("bildirim yoksa latestId null", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    countUnread.mockResolvedValue(0);
    limit.mockResolvedValue({ data: [], error: null });
    expect(await (await GET()).json()).toEqual({ unread: 0, latestId: null });
  });
});
