import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inserts: Array<Record<string, unknown>> = [];
const notified = new Set<string>(); // leadId
let leads: Array<{ id: string; parent_name: string; created_at: string }> = [];
let yoneticiler: Array<{ id: string }> = [];
const filtersSeen: string[] = [];

/** Zincirlenebilir, await edilebilir sahte sorgu. */
function query(table: string) {
  const filters: Record<string, unknown> = {};
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      filtersSeen.push(`${table}.eq.${column}`);
      return q;
    },
    is: (column: string) => {
      filtersSeen.push(`${table}.is.${column}`);
      return q;
    },
    in: () => q,
    or: () => {
      filtersSeen.push(`${table}.or`);
      return q;
    },
    order: () => q,
    limit: () => q,
    insert: (row: Record<string, unknown>) => {
      inserts.push(row);
      return Promise.resolve({ error: null });
    },
    then: (resolve: (value: unknown) => void) => {
      if (table === "profiles") return resolve({ data: yoneticiler, error: null });
      if (table === "leads") return resolve({ data: leads, error: null });
      if (table === "app_settings") return resolve({ data: [], error: null });
      const id = filters["payload->>leadId"] as string;
      return resolve({ data: notified.has(id) ? [{ id: "n" }] : [], error: null });
    },
  };
  return q;
}
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({ from: (t: string) => query(t) }) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/leads/route";

function request(auth?: string) {
  return new NextRequest("http://localhost/api/cron/leads", { headers: auth ? { authorization: auth } : {} });
}

// Varsayılan mesai 08:30-18:00 hafta içi, İstanbul. 2026-10-19 Pazartesi.
const at = (hhmm: string, day = "2026-10-19") => new Date(`${day}T${hhmm}:00+03:00`);

beforeEach(() => {
  inserts.length = 0;
  notified.clear();
  filtersSeen.length = 0;
  yoneticiler = [{ id: "y1" }, { id: "y2" }];
  leads = [];
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/leads", () => {
  it("yetkisiz istek 401", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer yanlis"))).status).toBe(401);
    expect(inserts).toHaveLength(0);
  });

  it("16 mesai dakikasıdır aranmayan veli her yöneticiye bildirilir", async () => {
    vi.setSystemTime(at("10:16"));
    leads = [{ id: "l1", parent_name: "Ayşe Yılmaz", created_at: at("10:00").toISOString() }];
    const res = await GET(request("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(inserts).toEqual([
      { user_id: "y1", type: "veli_bekliyor", payload: { leadId: "l1", parentName: "Ayşe Yılmaz", minutes: 16 } },
      { user_id: "y2", type: "veli_bekliyor", payload: { leadId: "l1", parentName: "Ayşe Yılmaz", minutes: 16 } },
    ]);
    // Bugün listesiyle aynı süzgeç kullanılır.
    expect(filtersSeen).toContain("leads.is.first_contact_at");
    expect(filtersSeen).toContain("leads.eq.status");
    expect(filtersSeen).toContain("leads.or");
  });

  it("15 dakikayı geçmeyen veli bildirilmez", async () => {
    vi.setSystemTime(at("10:15"));
    leads = [{ id: "l1", parent_name: "A", created_at: at("10:00").toISOString() }];
    await GET(request("Bearer s3cret"));
    expect(inserts).toHaveLength(0);
  });

  it("aynı veli ikinci çalışmada tekrar bildirilmez", async () => {
    vi.setSystemTime(at("10:16"));
    leads = [{ id: "l1", parent_name: "A", created_at: at("10:00").toISOString() }];
    notified.add("l1");
    await GET(request("Bearer s3cret"));
    expect(inserts).toHaveLength(0);
  });

  it("mesai dışında hiçbir şey göndermez", async () => {
    vi.setSystemTime(at("19:30"));
    leads = [{ id: "l1", parent_name: "A", created_at: at("10:00").toISOString() }];
    const res = await GET(request("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(inserts).toHaveLength(0);
  });

  it("17:55'te gelen veli ertesi sabah 08:40'ta 5+10=15 mesai dakikası doldurmuştur: bildirilmez", async () => {
    vi.setSystemTime(at("08:40", "2026-10-20"));
    leads = [{ id: "l1", parent_name: "A", created_at: at("17:55").toISOString() }];
    await GET(request("Bearer s3cret"));
    expect(inserts).toHaveLength(0);
  });

  it("ertesi sabah 08:10'da (mesai başlamadan) hiçbir şey göndermez", async () => {
    vi.setSystemTime(at("08:10", "2026-10-20"));
    leads = [{ id: "l1", parent_name: "A", created_at: at("17:55").toISOString() }];
    await GET(request("Bearer s3cret"));
    expect(inserts).toHaveLength(0);
  });

  it("17:55 veli ertesi gün 08:50'de 5+20=25 mesai dakikasıyla bildirilir", async () => {
    vi.setSystemTime(at("08:50", "2026-10-20"));
    leads = [{ id: "l1", parent_name: "A", created_at: at("17:55").toISOString() }];
    await GET(request("Bearer s3cret"));
    expect(inserts).toHaveLength(2);
    expect((inserts[0].payload as { minutes: number }).minutes).toBe(25);
  });
});
