import { beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();
vi.mock("@seker/auth/admin", () => ({
  createAdminSupabase: () => ({
    from: () => ({ select: () => ({ limit }) }),
  }),
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health (panel)", () => {
  beforeEach(() => limit.mockReset());

  it("veritabanı cevap verirse 200", async () => {
    limit.mockResolvedValue({ data: [{ key: "takipsizlik_gun" }], error: null });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("veritabanı hata verirse 503", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "paused" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
  });
});
