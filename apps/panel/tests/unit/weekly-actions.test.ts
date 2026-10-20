import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Bu hafta: toplantıyı kaydet. Görevler gerçek createContentTask ile açılır; gizli anahtarlı istemci bellekte
// bir content_items tablosu tutar (aynı hafta ikinci kayıt çiftlemesin diye).
type Op = { table: string; op: string; payload?: unknown; filters: unknown[][]; options?: unknown };
let ops: Op[] = [];
let items: { id: string; code: string; kind: string; week_start: string; owner_id: string }[] = [];
let recs: { id: string; title: string; status: string; result: string | null }[] = [];

const TEACHERS: Record<string, { full_name: string; phone: string | null }> = {
  "00000000-0000-0000-0000-00000000000a": { full_name: "Ayşe Kaya", phone: "+905321112233" },
  "00000000-0000-0000-0000-00000000000b": { full_name: "Derya Demir", phone: "+905324445566" },
};
const [AYSE, DERYA] = Object.keys(TEACHERS);

function respond(o: Op): { data?: unknown; error?: unknown } {
  const eq = (col: string) => o.filters.find((f) => f[0] === "eq" && f[1] === col)?.[2];
  if (o.table === "profiles") {
    const id = eq("id") as string | undefined;
    if (id) {
      const t = TEACHERS[id];
      return { data: t ? { id, ...t, role: "ogretmen", is_active: true } : null };
    }
    const inIds = o.filters.find((f) => f[0] === "in" && f[1] === "id")?.[2] as string[] | undefined;
    return { data: Object.entries(TEACHERS).filter(([k]) => !inIds || inIds.includes(k)).map(([k, v]) => ({ id: k, ...v })) };
  }
  if (o.table === "content_items" && o.op === "select") {
    const week = eq("week_start");
    return { data: items.filter((i) => !week || i.week_start === week) };
  }
  if (o.table === "content_items" && o.op === "insert") {
    const p = o.payload as { code: string; kind: string; week_start: string; owner_id: string };
    if (items.some((i) => i.code === p.code)) return { error: { code: "23505" } };
    const id = `11111111-1111-1111-1111-1111111111${String(items.length).padStart(2, "0")}`;
    items.push({ id, code: p.code, kind: p.kind, week_start: p.week_start, owner_id: p.owner_id });
    return { data: { id } };
  }
  if (o.table === "ad_recommendations") return { data: recs };
  return { data: null };
}

function builder(table: string) {
  const o: Op = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const filter = (name: string) => (...a: unknown[]) => (o.filters.push([name, ...a]), b);
  for (const f of ["eq", "neq", "is", "not", "in", "gte", "lt", "like", "order", "limit"]) b[f] = filter(f);
  b.select = () => b;
  b.insert = (p: unknown) => ((o.op = "insert"), (o.payload = p), b);
  b.update = (p: unknown) => ((o.op = "update"), (o.payload = p), b);
  b.upsert = (p: unknown, options?: unknown) => ((o.op = "upsert"), (o.payload = p), (o.options = options), b);
  b.delete = () => ((o.op = "delete"), b);
  b.single = () => b;
  b.maybeSingle = () => b;
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    ops.push(o);
    const r = respond(o);
    return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve, reject);
  };
  return b;
}

const adminClient = { from: (t: string) => builder(t) };
const createAdminSupabase = vi.fn(() => adminClient);

type Me = { id: string; full_name: string; role: "yonetici" | "danisman" | "ogretmen" };
let me: Me;
const requireRole = vi.fn(async (...roles: string[]) => {
  if (!roles.includes(me.role)) throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
  return me;
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: (...r: string[]) => requireRole(...r) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => adminClient }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => createAdminSupabase() }));

import { saveWeeklyReview } from "@/actions/weekly";

const YON: Me = { id: "00000000-0000-0000-0000-000000000001", full_name: "Mehtap Hanım", role: "yonetici" };
const DAN: Me = { id: "00000000-0000-0000-0000-000000000002", full_name: "Zehra Hanım", role: "danisman" };

// Toplantı haftası 12–18 Ekim; görevler 19–25 Ekim haftasına (ISO hafta 43), teslim Perşembe 22 Ekim 17:00.
const MEETING = "2026-10-12";
const DUE = "2026-10-22T17:00";
const ALL_SLOTS = [
  { slot: "reels_a" as const, ownerId: AYSE, dueAt: DUE },
  { slot: "reels_b" as const, ownerId: DERYA, dueAt: DUE },
  { slot: "sayfa_google" as const, ownerId: AYSE, dueAt: DUE },
  { slot: "sayfa_instagram" as const, ownerId: DERYA, dueAt: DUE },
];

const ofTable = (table: string, op: string) => ops.filter((o) => o.table === table && o.op === op);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T09:00:00+03:00"));
  ops = [];
  items = [];
  recs = [
    { id: "r1", title: "R-2641-B'yi durdur", status: "onaylandi", result: "Kaydedildi · uygulanmadı: canlı yazım kapalı" },
    { id: "r2", title: "R-2641-A teste girsin", status: "bekletildi", result: "Bekletiliyor · gelecek hafta tekrar sorulur" },
  ];
  me = YON;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("saveWeeklyReview", () => {
  it("danışman kaydedemez, hiçbir şey yazılmaz", async () => {
    me = DAN;
    await expect(saveWeeklyReview({ weekStart: MEETING, topic: "Çalışan anneye uygun saatler", tasks: ALL_SLOTS })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(createAdminSupabase).not.toHaveBeenCalled();
    expect(ops.filter((o) => o.op !== "select")).toHaveLength(0);
  });

  it("4 slot dört görev açar: R-..-A, R-..-B, S-..-G, S-..-I; görevler toplantıdan sonraki haftaya", async () => {
    const res = await saveWeeklyReview({ weekStart: MEETING, topic: "Çalışan anneye uygun saatler", tasks: ALL_SLOTS });
    expect(res).toMatchObject({ ok: true });
    if (!("ok" in res)) return;
    expect(res.created.map((c) => c.code)).toEqual(["R-2643-A", "R-2643-B", "S-2643-G", "S-2643-I"]);
    expect(res.created.map((c) => c.owner)).toEqual(["Ayşe Kaya", "Derya Demir", "Ayşe Kaya", "Derya Demir"]);
    expect(items.map((i) => [i.code, i.kind, i.week_start])).toEqual([
      ["R-2643-A", "reels", "2026-10-19"],
      ["R-2643-B", "reels", "2026-10-19"],
      ["S-2643-G", "sayfa", "2026-10-19"],
      ["S-2643-I", "sayfa", "2026-10-19"],
    ]);
    // Öğretmen başına tek WhatsApp bağlantısı, kendi görev kodlarıyla.
    expect(res.waLinks.map((w) => w.owner)).toEqual(["Ayşe Kaya", "Derya Demir"]);
    const ayse = decodeURIComponent(res.waLinks[0].url);
    expect(ayse).toContain("R-2643-A");
    expect(ayse).toContain("S-2643-G");
    expect(ayse).not.toContain("R-2643-B");

    const [up] = ofTable("weekly_reviews", "upsert");
    expect(up.options).toMatchObject({ onConflict: "week_start" });
    expect(up.payload).toMatchObject({
      week_start: MEETING,
      topic: "Çalışan anneye uygun saatler",
      task_ids: items.map((i) => i.id),
      saved_by: YON.id,
      decisions: [
        { id: "r1", title: "R-2641-B'yi durdur", status: "onaylandi", result: "Kaydedildi · uygulanmadı: canlı yazım kapalı" },
        { id: "r2", title: "R-2641-A teste girsin", status: "bekletildi", result: "Bekletiliyor · gelecek hafta tekrar sorulur" },
      ],
    });
  });

  it("boş sahipli slot atlanır; Reels B tek başına da B harfini alır", async () => {
    const res = await saveWeeklyReview({
      weekStart: MEETING,
      topic: "Servis güzergâhı",
      tasks: [
        { slot: "reels_a", ownerId: null, dueAt: DUE },
        { slot: "reels_b", ownerId: DERYA, dueAt: DUE },
        { slot: "sayfa_google", ownerId: "", dueAt: DUE },
        { slot: "sayfa_instagram", ownerId: null, dueAt: DUE },
      ],
    });
    expect(res).toMatchObject({ ok: true, created: [{ code: "R-2643-B", owner: "Derya Demir" }] });
    expect(items.map((i) => i.code)).toEqual(["R-2643-B"]);
  });

  it("aynı hafta ikinci kayıt weekly_reviews'i günceller, var olan slotları çiftlemez", async () => {
    await saveWeeklyReview({ weekStart: MEETING, topic: "Servis güzergâhı", tasks: ALL_SLOTS.slice(0, 2) });
    expect(items.map((i) => i.code)).toEqual(["R-2643-A", "R-2643-B"]);

    const res = await saveWeeklyReview({ weekStart: MEETING, topic: "Servis güzergâhı ve saatler", tasks: ALL_SLOTS });
    expect(res).toMatchObject({ ok: true });
    if (!("ok" in res)) return;
    expect(res.created.map((c) => c.code)).toEqual(["S-2643-G", "S-2643-I"]);
    expect(items.map((i) => i.code)).toEqual(["R-2643-A", "R-2643-B", "S-2643-G", "S-2643-I"]);
    expect(ofTable("content_items", "insert")).toHaveLength(4);

    const ups = ofTable("weekly_reviews", "upsert");
    expect(ups).toHaveLength(2);
    expect(ups[1].payload).toMatchObject({ week_start: MEETING, topic: "Servis güzergâhı ve saatler", task_ids: items.map((i) => i.id) });
    expect(ofTable("weekly_reviews", "insert")).toHaveLength(0);
  });

  it("Pazartesi olmayan hafta ve kısa konu reddedilir, görev açılmaz", async () => {
    expect(await saveWeeklyReview({ weekStart: "2026-10-13", topic: "Servis", tasks: ALL_SLOTS })).toEqual({ error: "Hafta geçersiz." });
    expect(await saveWeeklyReview({ weekStart: MEETING, topic: "  a ", tasks: ALL_SLOTS })).toMatchObject({ error: expect.any(String) });
    expect(ops.filter((o) => o.op !== "select")).toHaveLength(0);
  });

  it("geçmiş teslim zamanı hiçbir görev açılmadan reddedilir", async () => {
    const res = await saveWeeklyReview({
      weekStart: MEETING,
      topic: "Servis güzergâhı",
      tasks: [ALL_SLOTS[0], { slot: "reels_b", ownerId: DERYA, dueAt: "2026-10-18T17:00" }],
    });
    expect(res).toMatchObject({ error: expect.stringContaining("Reels B") });
    expect(items).toHaveLength(0);
  });
});
