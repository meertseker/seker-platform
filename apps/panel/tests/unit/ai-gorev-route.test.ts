import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let claims: { sub: string } | null;
let profile: { role: string; is_active: boolean } | null;
let taskCodes: { code: string; kind: string }[];
const generateWeekSuggestions = vi.fn();

const sessionClient = {
  auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }) }),
};
const adminClient = {
  from: () => ({ select: () => ({ eq: async () => ({ data: taskCodes, error: null }) }) }),
};
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => sessionClient }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => adminClient }));
vi.mock("@/lib/ai/gorev-uret", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/gorev-uret")>()),
  generateWeekSuggestions: (...a: unknown[]) => generateWeekSuggestions(...a),
}));

import { POST } from "@/app/api/ai/gorev-onerileri/route";

function req(body: unknown) {
  return new Request("http://x/api/ai/gorev-onerileri", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T10:00:00+03:00"));
  claims = { sub: "u1" };
  profile = { role: "danisman", is_active: true };
  taskCodes = [];
  process.env.ANTHROPIC_API_KEY = "sk-test";
  generateWeekSuggestions.mockResolvedValue({ enabled: true, slots: {} });
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("POST /api/ai/gorev-onerileri", () => {
  it("oturum yoksa 401", async () => {
    claims = null;
    expect((await POST(req({ weekStart: "2026-10-19" }))).status).toBe(401);
  });

  it("öğretmen ve pasif kullanıcı 403", async () => {
    profile = { role: "ogretmen", is_active: true };
    expect((await POST(req({ weekStart: "2026-10-19" }))).status).toBe(403);
    profile = { role: "danisman", is_active: false };
    expect((await POST(req({ weekStart: "2026-10-19" }))).status).toBe(403);
    expect(generateWeekSuggestions).not.toHaveBeenCalled();
  });

  it("izinli olmayan hafta 400", async () => {
    expect((await POST(req({ weekStart: "2026-10-12" }))).status).toBe(400);
  });

  it("anahtar yoksa kapalı döner, üretim çağrılmaz", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(req({ weekStart: "2026-10-19" }));
    expect(await res.json()).toEqual({ enabled: false });
    expect(generateWeekSuggestions).not.toHaveBeenCalled();
  });

  it("görevi açık yuvalar üretilmez; tek yuva ve force geçirilir", async () => {
    taskCodes = [{ code: "R-2643-A", kind: "reels" }];
    await POST(req({ weekStart: "2026-10-19" }));
    expect(generateWeekSuggestions).toHaveBeenLastCalledWith(adminClient, expect.objectContaining({
      weekStart: "2026-10-19", slots: ["reels_b", "sayfa_google", "sayfa_instagram"], force: false,
    }));
    await POST(req({ weekStart: "2026-10-26", slot: "sayfa_google", force: true }));
    expect(generateWeekSuggestions).toHaveBeenLastCalledWith(adminClient, expect.objectContaining({
      weekStart: "2026-10-26", slots: ["sayfa_google"], force: true,
    }));
  });
});
