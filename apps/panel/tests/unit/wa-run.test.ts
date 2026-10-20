import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WaStore } from "@/lib/wa/flush";
import { emptyContext } from "@/lib/wa/format";

const inserts: Array<Record<string, unknown>> = [];
let existingToday = false;

/** notifyDisconnected'ın kullandığı zincirlenebilir sahte sorgu. */
function query(table: string) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    limit: () => q,
    // insertNotifications satırları dizi olarak yazar; tek satır da kabul edilir.
    insert: (rows: Record<string, unknown> | Array<Record<string, unknown>>) => {
      inserts.push(...(Array.isArray(rows) ? rows : [rows]));
      return Promise.resolve({ error: null });
    },
    then: (resolve: (value: unknown) => void) => {
      if (table === "profiles") return resolve({ data: [{ id: "y1" }], error: null });
      return resolve({ data: existingToday ? [{ id: "n1" }] : [], error: null });
    },
  };
  return q;
}
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({ from: (t: string) => query(t) }) }));

function fakeStore(): WaStore {
  const createdAt = new Date(Date.now() - 5 * 60_000).toISOString();
  return {
    settings: async () => ({ enabled: true, groupId: "123@g.us" }),
    releaseStale: async () => {},
    listPending: async () => [{
      id: "a",
      attempts: 0,
      createdAt,
      item: {
        outboxId: "a", eventType: "lead_olusturuldu", entityType: "lead", entityId: "L1",
        actorId: "u1", payload: {}, createdAt,
      },
    }],
    loadContext: async () => emptyContext(),
    claim: async (ids) => ids,
    markSent: async () => {},
    markRetry: async () => {},
    markFailed: async () => {},
    markSkipped: async () => {},
  };
}
vi.mock("@/lib/wa/store", () => ({ supabaseWaStore: () => fakeStore() }));

import { runWaFlush } from "@/lib/wa/run";

beforeEach(() => {
  inserts.length = 0;
  existingToday = false;
  vi.stubEnv("WAHA_URL", "http://waha:3000");
  vi.stubEnv("WAHA_API_KEY", "k");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("runWaFlush", () => {
  it("WAHA konteyneri kapalıysa (ağ hatası) bağlantı koptu bildirimi yazılır", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const result = await runWaFlush();
    expect(result).toMatchObject({ notReady: true });
    expect(inserts).toEqual([{ user_id: "y1", type: "wa_baglanti_koptu", payload: { tarih: expect.any(String) } }]);
  });

  it("WAHA 500 dönerse de bildirim yazılır", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const result = await runWaFlush();
    expect(result).toMatchObject({ notReady: true });
    expect(inserts).toHaveLength(1);
  });

  it("aynı gün ikinci kez bildirim yazılmaz", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    existingToday = true;
    await runWaFlush();
    expect(inserts).toHaveLength(0);
  });
});
