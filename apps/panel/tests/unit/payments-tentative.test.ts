import { describe, it, expect, vi, beforeEach } from "vitest";
import { tentativeStart, shouldStartTentative } from "@/lib/price-increase";

const getSessionProfile = vi.fn();
const planInserts: Record<string, unknown>[] = [];
let siblings: unknown[] = [];

function selectChain(result: () => unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["eq", "not", "limit", "in"]) c[m] = () => c;
  c.maybeSingle = async () => ({ data: { season: "2026-2027" }, error: null });
  c.then = (resolve: (v: unknown) => unknown) => resolve({ data: result(), error: null });
  return c;
}
const from = vi.fn((table: string) => {
  if (table === "price_lists") return { select: () => selectChain(() => null) };
  if (table === "payment_plans") {
    return {
      select: () => selectChain(() => siblings),
      insert: (row: Record<string, unknown>) => {
        planInserts.push(row);
        return { select: () => ({ single: async () => ({ data: { id: `plan-${planInserts.length}` }, error: null }) }) };
      },
      delete: () => ({ eq: async () => ({ error: null }), in: async () => ({ error: null }) }),
    };
  }
  return { insert: async () => ({ error: null }) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => null }));

import { createPaymentPlan, createEnrollmentPlan } from "@/actions/payments";

describe("tentativeStart / shouldStartTentative", () => {
  it("sezonun Ocak ayının 1'i", () => {
    expect(tentativeStart("2026-2027")).toBe("2027-01-01");
  });
  it("kural: aidat + son vade >= başlangıç + bekleyen kardeş plan", () => {
    expect(shouldStartTentative("aidat", "2027-06-05", "2026-2027", true)).toBe(true);
    expect(shouldStartTentative("aidat", "2026-12-05", "2026-2027", true)).toBe(false);
    expect(shouldStartTentative("aidat", "2027-06-05", "2026-2027", false)).toBe(false);
    expect(shouldStartTentative("kitap", "2027-06-05", "2026-2027", true)).toBe(false);
  });
});

describe("plan oluştururken tentative_from", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planInserts.length = 0;
    getSessionProfile.mockResolvedValue({ id: "u1", role: "yonetici" });
    siblings = [];
  });

  it("zam bekleyen sezonda yeni aidat planı tentative_from alır", async () => {
    siblings = [{ id: "x" }];
    await createPaymentPlan("s1", "aidat", 60000, 6, "2027-01-05");
    expect(planInserts[0].tentative_from).toBe("2027-01-01");
  });

  it("kesinleşmiş sezonda almaz", async () => {
    siblings = [];
    await createPaymentPlan("s1", "aidat", 60000, 6, "2027-01-05");
    expect(planInserts[0].tentative_from ?? null).toBeNull();
  });

  it("kırtasiye planı almaz", async () => {
    siblings = [{ id: "x" }];
    await createPaymentPlan("s1", "kitap", 6000, 3, "2027-01-05");
    expect(planInserts[0].tentative_from ?? null).toBeNull();
  });

  it("kayıt akışında yalnızca aidat planı alır", async () => {
    siblings = [{ id: "x" }];
    await createEnrollmentPlan({
      studentId: "s1",
      aidatMode: "aylik",
      monthlyTl: 10000,
      firstDueDate: "2026-11-05",
      kitapTl: 3000,
      kitapCount: 3,
    });
    const aidat = planInserts.find((p) => p.item_type === "aidat")!;
    const kitap = planInserts.find((p) => p.item_type === "kitap")!;
    expect(aidat.tentative_from).toBe("2027-01-01");
    expect(kitap.tentative_from ?? null).toBeNull();
  });
});
