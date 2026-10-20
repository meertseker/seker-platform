import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WeeklyLead } from "@/lib/ads/weekly";

const requireRole = vi.fn();
const revalidatePath = vi.fn();
const loadWeeklyData = vi.fn();
const fetchSpy = vi.fn();
const adminFrom = vi.fn();

const store = {
  loadObject: vi.fn(),
  weekBudgetBaselineTl: vi.fn(async () => null),
  insertLog: vi.fn(async () => "log-1"),
  updateLog: vi.fn(),
  updateObject: vi.fn(),
  updateBudgetRows: vi.fn(),
  linkContent: vi.fn(),
};

vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({ from: adminFrom }) }));
vi.mock("@/lib/queries/weekly", () => ({ loadWeeklyData: (...a: unknown[]) => loadWeeklyData(...a) }));
vi.mock("@/lib/lead-flow/settings", () => ({
  getLeadFlowSettings: async () => ({ hours: { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" } }),
}));
vi.mock("@/lib/ads/ad-settings", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/ad-settings")>();
  return { ...actual, getAdSettings: async () => actual.DEFAULT_AD_SETTINGS };
});
vi.mock("@/lib/ads/writes", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/writes")>();
  return { ...actual, supabaseAdChangeStore: () => store };
});

import { applyAdChange, linkAdToContent } from "@/actions/ad-changes";

const OBJ = {
  platform: "meta" as const,
  level: "adset" as const,
  objectId: "120000111",
  name: "R-2641-A",
  status: "ACTIVE",
  dailyBudgetMicros: 150_000_000,
  budgetResource: "120000111",
};

function qualifiedNoAppt(id: string): WeeklyLead {
  return {
    id,
    createdAt: "2026-10-13T08:00:00Z",
    firstContactAt: null,
    status: "ulasildi",
    lostReason: null,
    isQualified: true,
    qReached: true,
    source: "reklam",
    channel: null,
    adPlatform: "meta",
    contentCode: null,
    assignedTo: null,
    hasAppointment: false,
  };
}

const empty = { weekStart: "2026-10-19", leads: [], appts: [], reachLeads: [], weekAppts: [], openTasks: [], openTasksByUser: new Map(), names: new Map() };

describe("applyAdChange (sunucu eylemi)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Salı 20 Ekim 2026, 12:00 İstanbul
    vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("ADS_WRITE_ENABLED", "");
    requireRole.mockResolvedValue({ id: "yon-1", role: "yonetici" });
    store.loadObject.mockResolvedValue(OBJ);
    loadWeeklyData.mockResolvedValue(empty);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("danışman çağıramaz: requireRole yönlendirir, kayıt ve istek yok", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      applyAdChange({ platform: "meta", level: "adset", objectId: "120000111", objectName: "x", kind: "pause", source: "kampanyalar" }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledWith("yonetici");
    expect(store.insertLog).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("kapılar sunucuda hesaplanır: bu hafta ve geçen tamamlanmış hafta yüklenir", async () => {
    await applyAdChange({ platform: "meta", level: "adset", objectId: "120000111", objectName: "x", kind: "pause", source: "kampanyalar" });
    const weeks = loadWeeklyData.mock.calls.map((c) => c[1]).sort();
    expect(weeks).toEqual(["2026-10-12", "2026-10-19"]);
  });

  it("geçen haftanın kırmızı kapısı gerekçesiz artışı durdurur (istemci ne derse desin)", async () => {
    loadWeeklyData.mockImplementation(async (_db: unknown, week: string) =>
      week === "2026-10-12"
        ? { ...empty, weekStart: week, leads: [qualifiedNoAppt("a"), qualifiedNoAppt("b")] }
        : { ...empty, weekStart: week },
    );
    const res = await applyAdChange({
      platform: "meta",
      level: "adset",
      objectId: "120000111",
      objectName: "x",
      kind: "budget",
      newDailyBudgetTl: 160,
      source: "kampanyalar",
      // İstemcinin uydurduğu alan yok sayılır.
      ...({ gateRed: false } as object),
    });
    expect(res).toMatchObject({ needsReason: true });
    expect("error" in res && res.error).toContain("Randevu verilen");
    expect(store.insertLog).not.toHaveBeenCalled();
  });

  it("kapalıyken kayıt yazar, platforma gitmez, sayfaları yeniler", async () => {
    const res = await applyAdChange({
      platform: "meta",
      level: "adset",
      objectId: "120000111",
      objectName: "x",
      kind: "pause",
      source: "oneri",
      recommendationId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(res).toEqual({ ok: true, status: "uygulanmadi_kapali", message: "Kaydedildi · uygulanmadı: canlı yazım kapalı" });
    expect(store.insertLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "yon-1", source: "oneri", recommendationId: "123e4567-e89b-12d3-a456-426614174000" }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });
});

describe("linkAdToContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: "yon-1", role: "yonetici" });
    store.linkContent.mockResolvedValue(undefined);
  });

  it("geçersiz kodu ve kimliği reddeder, yazmaz", async () => {
    for (const code of ["r-2645-a", "R-264-A", "R-2645-AB", "X-2645-A", ""]) {
      expect(await linkAdToContent("meta", "120000111", code)).toHaveProperty("error");
    }
    expect(await linkAdToContent("meta", "12 or 1", "R-2645-A")).toHaveProperty("error");
    expect(await linkAdToContent("google" as "meta", "1", "R-2645-A")).toHaveProperty("error");
    expect(store.linkContent).not.toHaveBeenCalled();
  });

  it("geçerli kodu bağlar (bağlantı + harcama + nesne)", async () => {
    const res = await linkAdToContent("meta", "120000111", " R-2645-A ");
    expect(res).toMatchObject({ ok: true });
    expect(store.linkContent).toHaveBeenCalledWith("meta", "120000111", "R-2645-A", "yon-1");
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("danışman bağlayamaz", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(linkAdToContent("meta", "120000111", "R-2645-A")).rejects.toThrow();
    expect(store.linkContent).not.toHaveBeenCalled();
  });

  it("veritabanı hatasında Türkçe hata döner", async () => {
    store.linkContent.mockRejectedValue(new Error("db"));
    expect(await linkAdToContent("meta", "120000111", "R-2645-A")).toEqual({ error: "Bağlanamadı, tekrar deneyin." });
  });
});

describe("supabaseAdChangeStore.linkContent", () => {
  it("bağlantıyı upsert eder, o reklamın harcama ve nesne satırlarını günceller", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ads/writes")>("@/lib/ads/writes");
    const calls: { table: string; op: string; arg: unknown; filters: [string, unknown][] }[] = [];
    const db = {
      from: (table: string) => {
        const rec = { table, op: "", arg: undefined as unknown, filters: [] as [string, unknown][] };
        calls.push(rec);
        const chain = {
          upsert: (arg: unknown, opts: unknown) => {
            rec.op = "upsert";
            rec.arg = [arg, opts];
            return Promise.resolve({ error: null });
          },
          update: (arg: unknown) => {
            rec.op = "update";
            rec.arg = arg;
            return chain;
          },
          eq: (k: string, v: unknown) => {
            rec.filters.push([k, v]);
            return chain;
          },
          then: (res: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(res),
        };
        return chain;
      },
    };
    await actual.supabaseAdChangeStore(db as never).linkContent("meta", "120000111", "R-2645-A", "yon-1");
    const link = calls.find((c) => c.table === "ad_content_links");
    expect(link?.op).toBe("upsert");
    expect((link?.arg as unknown[])[0]).toMatchObject({ platform: "meta", ad_id: "120000111", content_code: "R-2645-A", linked_by: "yon-1" });
    const spend = calls.find((c) => c.table === "ad_spend_daily");
    expect(spend).toMatchObject({ op: "update", arg: { content_code: "R-2645-A" } });
    expect(spend?.filters).toEqual(expect.arrayContaining([["platform", "meta"], ["ad_id", "120000111"]]));
    const obj = calls.find((c) => c.table === "ad_objects");
    expect(obj).toMatchObject({ op: "update", arg: { content_code: "R-2645-A" } });
    expect(obj?.filters).toEqual(expect.arrayContaining([["platform", "meta"], ["level", "ad"], ["object_id", "120000111"]]));
  });
});

describe("supabaseAdChangeStore · bütçe kaynağı", () => {
  function recordingDb(result: unknown) {
    const calls: { table: string; op: string; arg: unknown; filters: [string, unknown][] }[] = [];
    const db = {
      from: (table: string) => {
        const rec = { table, op: "", arg: undefined as unknown, filters: [] as [string, unknown][] };
        calls.push(rec);
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        Object.assign(chain, {
          select: (arg: unknown) => ((rec.op = "select"), (rec.arg = arg), self()),
          update: (arg: unknown) => ((rec.op = "update"), (rec.arg = arg), self()),
          eq: (k: string, v: unknown) => (rec.filters.push([k, v]), self()),
          gte: (k: string, v: unknown) => (rec.filters.push([`gte:${k}`, v]), self()),
          or: (v: string) => (rec.filters.push(["or", v]), self()),
          order: self,
          limit: self,
          then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
        });
        return chain;
      },
    };
    return { db, calls };
  }

  it("haftalık taban bütçe kaynağına göre aranır; kaynağı olmayan eski kayıtlarda nesneye düşer", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ads/writes")>("@/lib/ads/writes");
    const { db, calls } = recordingDb({ data: [{ old_value: { daily_budget_tl: 150 } }], error: null });
    const tl = await actual
      .supabaseAdChangeStore(db as never)
      .weekBudgetBaselineTl("meta", "120000999", "2026-10-18T21:00:00.000Z", "120000111");
    expect(tl).toBe(150);
    expect(calls[0].table).toBe("ad_change_log");
    expect(calls[0].filters).toEqual(
      expect.arrayContaining([
        ["platform", "meta"],
        ["action", "budget"],
        ["status", "uygulandi"],
        [
          "or",
          'new_value->>budget_resource.eq."120000999",and(new_value->>budget_resource.is.null,object_id.eq."120000111")',
        ],
        ["gte:created_at", "2026-10-18T21:00:00.000Z"],
      ]),
    );
    expect(calls[0].filters.map((f) => f[0])).not.toContain("object_id");
    // Tırnak ya da ayraç içeren kaynak sorguya girmez.
    await expect(
      actual.supabaseAdChangeStore(db as never).weekBudgetBaselineTl("meta", 'x",object_id.eq.1', "2026-10-18T21:00:00.000Z", "1"),
    ).rejects.toThrow();
  });

  it("başarılı yazımdan sonra aynı bütçe kaynağındaki tüm satırlar güncellenir", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ads/writes")>("@/lib/ads/writes");
    const { db, calls } = recordingDb({ error: null });
    await actual.supabaseAdChangeStore(db as never).updateBudgetRows("google", "customers/1/campaignBudgets/7", 180_000_000);
    expect(calls[0]).toMatchObject({ table: "ad_objects", op: "update", arg: { daily_budget_micros: 180_000_000 } });
    expect(calls[0].filters).toEqual([
      ["platform", "google"],
      ["budget_resource", "customers/1/campaignBudgets/7"],
    ]);
  });
});
