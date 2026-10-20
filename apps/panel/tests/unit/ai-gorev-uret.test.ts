import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateWeekSuggestions, aiEnabled, aiModel, type ClaudeCall } from "@/lib/ai/gorev-uret";
import { loadPromptData } from "@/lib/ai/gorev-veri";

// Bellek içi Supabase sahtesi: yalnız üreticinin kullandığı sorgu biçimleri.
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function fakeDb(tables: Tables) {
  const selects: { table: string; cols: string }[] = [];
  function from(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "update" | "upsert" = "select";
    let payload: Row | Row[] | null = null;
    let ignoreDuplicates = false;
    let limit = Infinity;
    const b: Record<string, unknown> = {};
    b.select = (cols = "*") => {
      if (op === "select") selects.push({ table, cols });
      return b;
    };
    b.eq = (c: string, v: unknown) => (filters.push((r) => r[c] === v), b);
    b.in = (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b);
    b.gte = (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), b);
    b.not = (c: string, _o: string, _v: null) => (filters.push((r) => r[c] !== null && r[c] !== undefined), b);
    b.order = () => b;
    b.limit = (n: number) => ((limit = n), b);
    b.update = (p: Row) => ((op = "update"), (payload = p), b);
    b.upsert = (p: Row[], o?: { ignoreDuplicates?: boolean }) => ((op = "upsert"), (payload = p), (ignoreDuplicates = !!o?.ignoreDuplicates), b);
    b.then = (resolve: (v: unknown) => unknown) => {
      const rows = (tables[table] ??= []);
      let data: Row[] = [];
      if (op === "select") data = rows.filter((r) => filters.every((f) => f(r))).slice(0, limit);
      if (op === "update") {
        data = rows.filter((r) => filters.every((f) => f(r)));
        for (const r of data) Object.assign(r, payload);
      }
      if (op === "upsert") {
        for (const p of payload as Row[]) {
          const hit = rows.find((r) => r.week_start === p.week_start && r.slot === p.slot);
          if (hit && ignoreDuplicates) continue;
          if (hit) Object.assign(hit, p);
          else {
            const row = { status: "hazirlaniyor", suggestions: [], updated_at: "2026-10-21T07:00:00.000Z", ...p };
            rows.push(row);
            data.push(row);
          }
        }
      }
      return Promise.resolve({ data: data.map((r) => ({ ...r })), error: null }).then(resolve);
    };
    return b;
  }
  return { client: { from } as never, selects };
}

const NOW = new Date("2026-10-21T10:00:00+03:00");
const WEEK = "2026-10-19";
const good = (n: number) => ({
  baslik: `Bahçede sabah oyunu ${n}`,
  aciklama: "Öğretmen bahçedeki sabah oyununu anlatır. Havalar soğumadan bu hafta çekmek iyi olur.",
  dayanak: "Geniş bahçe",
});
const aiOut = {
  yuvalar: [
    { yuva: "reels_a", oneriler: [good(1), good(2), { ...good(3), baslik: "En iyi bahçe" }] },
    { yuva: "reels_b", oneriler: [good(4), good(5)] },
    { yuva: "sayfa_google", oneriler: [good(6), good(7)] },
    { yuva: "sayfa_instagram", oneriler: [good(8), good(9)] },
  ],
};

let tables: Tables;
beforeEach(() => {
  tables = {
    app_settings: [
      { key: "okul_bilgileri", value: { metin: "Geniş bahçe, servis." } },
      { key: "yasakli_ifadeler", value: ["en iyi", "garanti"] },
    ],
    content_items: [{ code: "R-2642-A", topic: "Uyum", week_start: "2026-10-12" }],
    leads: [
      { content_code: "R-2642-A", utm_term: null, status: "randevu", parent_name: "Ayşe", phone: "+905321112233", created_at: "2026-10-14T10:00:00Z" },
      { content_code: null, utm_term: "Kadıköy Anaokulu", status: "kazanildi", parent_name: "Ali", phone: "+905321112244", created_at: "2026-10-15T10:00:00Z" },
    ],
    ad_spend_daily: [{ campaign_name: "Arama", platform: "google", clicks: 10, impressions: 100, cost_micros: 5_000_000, date: "2026-10-15" }],
    ai_gorev_onerileri: [],
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.ANTHROPIC_API_KEY = "sk-test";
  delete process.env.ANTHROPIC_MODEL;
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("aiEnabled / aiModel", () => {
  it("anahtar yoksa kapalı; model varsayılanı ve env", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(aiEnabled()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "  ";
    expect(aiEnabled()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "sk-x";
    expect(aiEnabled()).toBe(true);
    expect(aiModel()).toBe("claude-sonnet-5-5");
    process.env.ANTHROPIC_MODEL = "claude-opus-5-5";
    expect(aiModel()).toBe("claude-opus-5-5");
  });
});

describe("loadPromptData", () => {
  it("kişisel veri ve tutar seçilmez; sayılar toplanır", async () => {
    const { client, selects } = fakeDb(tables);
    const d = await loadPromptData(client, WEEK, ["reels_a"]);
    for (const s of selects) {
      expect(s.cols).not.toMatch(/parent_name|phone|child_name|contact_note|cost_micros|\*/);
    }
    expect(d.schoolInfo).toBe("Geniş bahçe, servis.");
    expect(d.banned).toEqual(["en iyi", "garanti"]);
    expect(d.contentLeads).toEqual([{ code: "R-2642-A", topic: "Uyum", total: 1, randevu: 1, kayit: 0, kayip: 0 }]);
    expect(d.keywords).toEqual([{ term: "kadıköy anaokulu", total: 1, randevu: 1, kayit: 1 }]);
    expect(d.campaigns).toEqual([{ name: "Arama", platform: "google", clicks: 10, impressions: 100 }]);
    expect(d.recentTopics).toEqual([{ weekStart: "2026-10-12", code: "R-2642-A", topic: "Uyum" }]);
  });

  it("boş veritabanında da derlenir", async () => {
    const { client } = fakeDb({});
    const d = await loadPromptData(client, WEEK, ["reels_a"]);
    expect(d).toMatchObject({ schoolInfo: "", recentTopics: [], contentLeads: [], keywords: [], campaigns: [] });
    expect(d.banned.length).toBeGreaterThan(0);
  });
});

describe("generateWeekSuggestions", () => {
  it("anahtar yoksa Claude çağrılmaz, satır yazılmaz", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const call = vi.fn<ClaudeCall>();
    const { client } = fakeDb(tables);
    const res = await generateWeekSuggestions(client, { weekStart: WEEK, slots: ["reels_a"], now: NOW, call });
    expect(res.enabled).toBe(false);
    expect(call).not.toHaveBeenCalled();
    expect(tables.ai_gorev_onerileri).toEqual([]);
  });

  it("eksik yuvaları üretir, yasaklıyı atar, kaydeder", async () => {
    const call = vi.fn<ClaudeCall>(async () => aiOut);
    const { client } = fakeDb(tables);
    const res = await generateWeekSuggestions(client, { weekStart: WEEK, slots: ["reels_a", "reels_b"], now: NOW, call });
    expect(call).toHaveBeenCalledTimes(1);
    const [system, user] = call.mock.calls[0];
    expect(system).toMatch(/MEB/);
    expect(user).toContain("reels_a");
    expect(user).not.toContain("sayfa_google (");
    expect(user).not.toMatch(/Ayşe|5321112233/);
    expect(res.slots.reels_a).toEqual({ status: "hazir", suggestions: [good(1), good(2)] });
    expect(res.slots.reels_b.status).toBe("hazir");
    expect(res.slots.sayfa_google.status).toBe("yok");
    expect(tables.ai_gorev_onerileri).toHaveLength(2);
    expect(tables.ai_gorev_onerileri[0]).toMatchObject({ status: "hazir", model: "claude-sonnet-5-5", error: null });
  });

  it("hazır yuva yeniden üretilmez; force üretir", async () => {
    tables.ai_gorev_onerileri.push({ week_start: WEEK, slot: "reels_a", status: "hazir", suggestions: [good(9)], updated_at: "2026-10-21T06:00:00.000Z" });
    const call = vi.fn<ClaudeCall>(async () => aiOut);
    const { client } = fakeDb(tables);
    const res = await generateWeekSuggestions(client, { weekStart: WEEK, slots: ["reels_a"], now: NOW, call });
    expect(call).not.toHaveBeenCalled();
    expect(res.slots.reels_a.suggestions).toEqual([good(9)]);
    const forced = await generateWeekSuggestions(client, { weekStart: WEEK, slots: ["reels_a"], now: NOW, call, force: true });
    expect(call).toHaveBeenCalledTimes(1);
    expect(forced.slots.reels_a.suggestions).toEqual([good(1), good(2)]);
  });

  it("başka istek üretiyorsa (taze hazirlaniyor) beklenir, Claude çağrılmaz", async () => {
    tables.ai_gorev_onerileri.push({ week_start: WEEK, slot: "reels_a", status: "hazirlaniyor", suggestions: [], updated_at: "2026-10-21T06:59:00.000Z" });
    const call = vi.fn<ClaudeCall>(async () => aiOut);
    const { client } = fakeDb(tables);
    const res = await generateWeekSuggestions(client, { weekStart: WEEK, slots: ["reels_a"], now: NOW, call, force: true });
    expect(call).not.toHaveBeenCalled();
    expect(res.slots.reels_a.status).toBe("hazirlaniyor");
  });

  it("3 dakikadan eski hazirlaniyor ve 1 saatten eski hata yeniden denenir", async () => {
    tables.ai_gorev_onerileri.push(
      { week_start: WEEK, slot: "reels_a", status: "hazirlaniyor", suggestions: [], updated_at: "2026-10-21T06:50:00.000Z" },
      { week_start: WEEK, slot: "reels_b", status: "hata", suggestions: [], updated_at: "2026-10-21T05:30:00.000Z" },
      { week_start: WEEK, slot: "sayfa_google", status: "hata", suggestions: [], updated_at: "2026-10-21T06:40:00.000Z" },
    );
    const call = vi.fn<ClaudeCall>(async () => aiOut);
    const { client } = fakeDb(tables);
    const res = await generateWeekSuggestions(client, { weekStart: WEEK, slots: ["reels_a", "reels_b", "sayfa_google"], now: NOW, call });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][1]).not.toContain("sayfa_google (");
    expect(res.slots.reels_a.status).toBe("hazir");
    expect(res.slots.reels_b.status).toBe("hazir");
    expect(res.slots.sayfa_google.status).toBe("hata");
  });

  it("Claude hatası loglanır, satırlar hata olur, istisna fırlatılmaz", async () => {
    const call = vi.fn<ClaudeCall>(async () => {
      throw new Error("529 overloaded");
    });
    const { client } = fakeDb(tables);
    const res = await generateWeekSuggestions(client, { weekStart: WEEK, slots: ["reels_a"], now: NOW, call });
    expect(res.slots.reels_a).toEqual({ status: "hata", suggestions: [] });
    expect(console.error).toHaveBeenCalled();
    expect(tables.ai_gorev_onerileri[0]).toMatchObject({ status: "hata" });
  });

  it("şema dışı çıktı hata sayılır", async () => {
    const { client } = fakeDb(tables);
    const res = await generateWeekSuggestions(client, { weekStart: WEEK, slots: ["reels_a"], now: NOW, call: async () => ({ x: 1 }) });
    expect(res.slots.reels_a.status).toBe("hata");
  });
});
