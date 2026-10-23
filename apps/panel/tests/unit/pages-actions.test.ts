import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Sayfa sunucu eylemleri: yalnız gizli anahtarlı istemci kullanılır; yazımlar `ops` içinde izlenir.
type Op = { table: string; op: string; payload?: unknown; options?: unknown; filters: unknown[][] };
let ops: Op[] = [];
let respond: (o: Op) => { data?: unknown; error?: unknown } = () => ({ data: null, error: null });

function builder(table: string) {
  const o: Op = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const filter = (name: string) => (...a: unknown[]) => (o.filters.push([name, ...a]), b);
  for (const f of ["eq", "neq", "is", "not", "in", "gte", "lt", "like", "order", "limit"]) b[f] = filter(f);
  b.select = () => b;
  b.insert = (p: unknown) => ((o.op = "insert"), (o.payload = p), b);
  b.update = (p: unknown) => ((o.op = "update"), (o.payload = p), b);
  b.upsert = (p: unknown, opt?: unknown) => ((o.op = "upsert"), (o.payload = p), (o.options = opt), b);
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

type Me = { id: string; full_name: string; role: "yonetici" | "danisman" | "ogretmen"; can_edit_site: boolean };
let me: Me;
const requireRole = vi.fn(async (...roles: string[]) => {
  if (!roles.includes(me.role)) {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
  }
  return me;
});

const revalidatePath = vi.fn();
const revalidateWebPage = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...r: string[]) => requireRole(...r) }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => createAdminSupabase() }));
vi.mock("@/lib/pages/revalidate", () => ({ revalidateWebPage: (slug: string) => revalidateWebPage(slug) }));

import {
  archiveLandingPage,
  loadPagePanel,
  openPagePreview,
  publishLandingPage,
  updateLandingPageFields,
} from "@/actions/pages";

const YON: Me = { id: "00000000-0000-0000-0000-000000000001", full_name: "Mehtap Hanım", role: "yonetici", can_edit_site: true };
const DAN: Me = { id: "00000000-0000-0000-0000-000000000002", full_name: "Zehra Hanım", role: "danisman", can_edit_site: false };
const OGR: Me = { id: "00000000-0000-0000-0000-000000000004", full_name: "Rüya Yılmaz", role: "ogretmen", can_edit_site: false };
const OGR2 = "00000000-0000-0000-0000-000000000005";
const CID = "11111111-1111-1111-1111-111111111111";
const TOKEN = "t".repeat(43);
const SLUG = "ilk-hafta-uyum";

const PAGE_FIELDS = {
  baslik: "İlk hafta uyum nasıl geçer",
  alt_baslik: "Uyum haftasında neler yaptığımızı anlatıyoruz",
  blok1_baslik: "Sabah",
  blok1_metin: "Kapıda karşılıyoruz",
  mediaKey: "gardenWide",
};

let item: Record<string, unknown>;
let page: Record<string, unknown> | null;

function pageRow(over: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    slug: SLUG,
    content_id: CID,
    status: "yayinda",
    fields: {
      h1: "Düzenlenmiş başlık burada",
      subhead: "Alt",
      bodyBlocks: [],
      mediaKey: "mudKitchen",
      adPrimaryText: "",
      adHeadline: "",
      metaTitle: "Düzenlenmiş başlık burada",
      metaDescription: "Alt",
    },
    preview_token: TOKEN,
    published_at: "2026-10-20T08:00:00+00:00",
    published_by: YON.id,
    archived_at: null,
    updated_at: "2026-10-20T08:00:00+00:00",
    ...over,
  };
}

const writes = () => ops.filter((o) => o.op !== "select");
const pageWrites = () => writes().filter((o) => o.table === "landing_pages");

beforeEach(() => {
  vi.clearAllMocks();
  ops = [];
  me = YON;
  delete process.env.SITE_PUBLIC_URL;
  item = {
    id: CID, code: "S-2643-G", kind: "sayfa", platform: "google", status: "onaylandi", stage: "test",
    owner_id: OGR.id, page_fields: PAGE_FIELDS, topic: "İlk hafta uyum",
  };
  page = null;
  revalidateWebPage.mockResolvedValue({ ok: true });
  respond = (o) => {
    if (o.table === "content_items" && o.op === "select") return { data: item };
    if (o.table === "app_settings") return { data: [] };
    if (o.table === "landing_pages" && o.op === "select") {
      // isSlugTaken / alınmış adres listesi dizi döner; içerik satırı tek satır.
      if (o.filters.some((f) => f[0] === "neq")) return { data: [] };
      return { data: page };
    }
    if (o.table === "landing_pages" && o.op === "insert") {
      page = pageRow({ ...(o.payload as object), slug: null, status: "taslak", fields: {}, published_at: null, published_by: null });
      return { data: page };
    }
    if (o.table === "landing_pages" && (o.op === "update" || o.op === "upsert")) return { data: [{ id: "x" }] };
    return { data: null };
  };
});
afterEach(() => {
  // Hiçbir eylem ad_change_log'a yazmaz, içerik satırını değiştirmez (aşama dahil).
  expect(ops.filter((o) => o.table === "ad_change_log")).toHaveLength(0);
  expect(ops.filter((o) => o.table === "content_items" && o.op !== "select")).toHaveLength(0);
});

describe("yetki", () => {
  it("öğretmen başkasının sayfasının önizlemesini açamaz", async () => {
    me = OGR;
    item.owner_id = OGR2;
    expect(await openPagePreview(CID)).toEqual({ error: "İçerik bulunamadı" });
    expect(pageWrites()).toHaveLength(0);
  });

  it("öğretmen kendi sayfasının önizlemesini açar (taslak açılır)", async () => {
    me = OGR;
    const res = await openPagePreview(CID);
    const ins = pageWrites().find((o) => o.op === "insert")!;
    const token = (ins.payload as { preview_token: string }).preview_token;
    expect(token).toHaveLength(43);
    expect(res).toEqual({ url: `https://yeni.sekeranaokulu.com/lp/onizleme/${token}` });
  });

  it("yönetici var olan taslağın önizlemesini açar, yeni satır yazmaz", async () => {
    page = pageRow({ slug: null, status: "taslak", published_at: null });
    expect(await openPagePreview(CID)).toEqual({ url: `https://yeni.sekeranaokulu.com/lp/onizleme/${TOKEN}` });
    expect(pageWrites()).toHaveLength(0);
  });

  it("reels içeriğinin önizlemesi yok", async () => {
    item.kind = "reels";
    expect(await openPagePreview(CID)).toEqual({ error: "Bu içerik sayfa değil" });
  });

  it("danışman yayınlayamaz, düzenleyemez, arşivleyemez, paneli açamaz", async () => {
    me = DAN;
    await expect(publishLandingPage(CID, SLUG)).rejects.toThrow("NEXT_REDIRECT");
    await expect(updateLandingPageFields(CID, pageRow().fields as never)).rejects.toThrow("NEXT_REDIRECT");
    await expect(archiveLandingPage(CID)).rejects.toThrow("NEXT_REDIRECT");
    await expect(loadPagePanel(CID)).rejects.toThrow("NEXT_REDIRECT");
    await expect(openPagePreview(CID)).rejects.toThrow("NEXT_REDIRECT");
    for (const c of requireRole.mock.calls.slice(0, 4)) expect(c).toEqual(["yonetici"]);
    expect(createAdminSupabase).not.toHaveBeenCalled();
    expect(ops).toHaveLength(0);
  });
});

describe("publishLandingPage", () => {
  it("onaysız içerik yayınlanmaz", async () => {
    item.status = "teslim";
    const res = await publishLandingPage(CID, SLUG);
    expect(res).toMatchObject({ error: "Yayın için eksikleri tamamla" });
    expect((res as { blockers: string[] }).blockers).toContain("Önce içerik onaylanmalı");
    expect(pageWrites()).toHaveLength(0);
    expect(revalidateWebPage).not.toHaveBeenCalled();
  });

  it("ilk yayın page_fields'i kopyalar ve status yayinda yazar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T09:00:00Z"));
    const res = await publishLandingPage(CID, SLUG);
    vi.useRealTimers();
    expect(res).toEqual({ ok: true, url: `https://yeni.sekeranaokulu.com/lp/${SLUG}`, warning: null });
    const w = pageWrites().filter((o) => o.op === "update" || o.op === "upsert");
    expect(w).toHaveLength(1);
    const p = w[0].payload as Record<string, unknown>;
    expect(p).toMatchObject({
      slug: SLUG,
      status: "yayinda",
      published_at: "2026-10-23T09:00:00.000Z",
      published_by: YON.id,
      archived_at: null,
    });
    expect((p.fields as { h1: string }).h1).toBe(PAGE_FIELDS.baslik);
    expect((p.fields as { mediaKey: string }).mediaKey).toBe("gardenWide");
    expect(revalidateWebPage).toHaveBeenCalledWith(SLUG);
    expect(revalidatePath).toHaveBeenCalledWith("/reklam/icerik");
  });

  it("ikinci yayın fields'i ezmez", async () => {
    page = pageRow({ status: "arsiv", archived_at: "2026-10-21T08:00:00+00:00" });
    const res = await publishLandingPage(CID, SLUG);
    expect(res).toMatchObject({ ok: true });
    const w = pageWrites().find((o) => o.op === "update" || o.op === "upsert")!;
    const p = w.payload as Record<string, unknown>;
    expect((p.fields as { h1: string }).h1).toBe("Düzenlenmiş başlık burada");
    expect(p).toMatchObject({ status: "yayinda", archived_at: null });
  });

  it("yayından sonra adres değiştirilemez", async () => {
    page = pageRow();
    const res = await publishLandingPage(CID, "baska-adres");
    expect((res as { blockers: string[] }).blockers).toContain("Yayından sonra adres değişmez");
    expect(pageWrites()).toHaveLength(0);
  });

  it("aynı slug yarışı: 23505 → anlaşılır hata", async () => {
    const base = respond;
    respond = (o) =>
      o.table === "landing_pages" && (o.op === "update" || o.op === "upsert")
        ? { error: { code: "23505", message: "duplicate key value violates unique constraint" } }
        : base(o);
    expect(await publishLandingPage(CID, SLUG)).toEqual({ error: "Bu adres başka bir sayfada kullanılıyor" });
    expect(revalidateWebPage).not.toHaveBeenCalled();
  });

  it("tetikleyici 23514 → adres değişmez", async () => {
    const base = respond;
    respond = (o) =>
      o.table === "landing_pages" && (o.op === "update" || o.op === "upsert")
        ? { error: { code: "23514", message: "Yayından sonra adres değişmez" } }
        : base(o);
    expect(await publishLandingPage(CID, SLUG)).toEqual({ error: "Yayından sonra adres değişmez" });
  });

  it("alınmış adres ön kontrolde yakalanır", async () => {
    const base = respond;
    respond = (o) =>
      o.table === "landing_pages" && o.op === "select" && o.filters.some((f) => f[0] === "neq")
        ? { data: [{ content_id: "33333333-3333-3333-3333-333333333333" }] }
        : base(o);
    const res = await publishLandingPage(CID, SLUG);
    expect((res as { blockers: string[] }).blockers).toContain("Bu adres başka bir sayfada kullanılıyor");
    expect(pageWrites()).toHaveLength(0);
  });

  it("revalidate başarısızsa yayın yine ok döner ve uyarı verir", async () => {
    revalidateWebPage.mockResolvedValue({ ok: false, reason: "ulasilamadi" });
    expect(await publishLandingPage(CID, SLUG)).toEqual({
      ok: true,
      url: `https://yeni.sekeranaokulu.com/lp/${SLUG}`,
      warning: "Sayfa kaydedildi; site yenilemesi gecikti, birkaç dakika içinde açılır.",
    });
  });
});

describe("updateLandingPageFields", () => {
  const fields = () => ({ ...(pageRow().fields as Record<string, unknown>), h1: "Yeni başlık bu hafta" }) as never;

  it("satır yoksa önce yayın istenir", async () => {
    expect(await updateLandingPageFields(CID, fields())).toEqual({ error: "Önce sayfayı yayınlayın" });
    expect(pageWrites()).toHaveLength(0);
  });

  it("hatalı alan yazılmaz", async () => {
    page = pageRow();
    const res = await updateLandingPageFields(CID, { ...(fields() as object), adHeadline: "En iyi okul" } as never);
    expect((res as { blockers: string[] }).blockers).toContain('Reklam başlığı: "en iyi" kanıt ister, kullanılamaz');
    expect(pageWrites()).toHaveLength(0);
  });

  it("yayındaki sayfada alanları yazar ve siteyi yeniler", async () => {
    page = pageRow();
    expect(await updateLandingPageFields(CID, fields())).toEqual({ ok: true, warning: null });
    const w = pageWrites();
    expect(w).toHaveLength(1);
    expect(w[0].op).toBe("update");
    expect((w[0].payload as { fields: { h1: string } }).fields.h1).toBe("Yeni başlık bu hafta");
    expect(Object.keys(w[0].payload as object)).toEqual(["fields"]);
    expect(revalidateWebPage).toHaveBeenCalledWith(SLUG);
  });

  it("arşivdeki sayfada yazar ama siteyi yenilemez", async () => {
    page = pageRow({ status: "arsiv" });
    expect(await updateLandingPageFields(CID, fields())).toEqual({ ok: true, warning: null });
    expect(revalidateWebPage).not.toHaveBeenCalled();
  });
});

describe("archiveLandingPage", () => {
  it("arşiv yalnız yayındaki sayfada", async () => {
    page = pageRow({ status: "taslak", published_at: null, slug: null });
    expect(await archiveLandingPage(CID)).toEqual({ error: "Yalnız yayındaki sayfa arşivlenir" });
    page = null;
    expect(await archiveLandingPage(CID)).toEqual({ error: "Yalnız yayındaki sayfa arşivlenir" });
    expect(pageWrites()).toHaveLength(0);
  });

  it("yayındaki sayfayı arşivler ve slug ile yeniler", async () => {
    page = pageRow();
    revalidateWebPage.mockResolvedValue({ ok: false, reason: "reddedildi" });
    const res = await archiveLandingPage(CID);
    expect(res).toEqual({ ok: true, warning: "Sayfa kaydedildi; site yenilemesi gecikti, birkaç dakika içinde açılır." });
    const w = pageWrites();
    expect(w).toHaveLength(1);
    expect(w[0].payload).toMatchObject({ status: "arsiv" });
    expect(typeof (w[0].payload as { archived_at: string }).archived_at).toBe("string");
    expect(revalidateWebPage).toHaveBeenCalledWith(SLUG);
  });
});

describe("loadPagePanel", () => {
  it("yayınlanmamış sayfada page_fields'ten alan ve adres önerisi", async () => {
    const res = await loadPagePanel(CID);
    expect(res).toMatchObject({
      code: "S-2643-G",
      topic: "İlk hafta uyum",
      platform: "google",
      status: "onaylandi",
      siteBase: "https://yeni.sekeranaokulu.com",
      slugSuggestion: "ilk-hafta-uyum-nasil-gecer",
      canPublish: true,
    });
    const data = res as { fields: { h1: string }; checks: unknown[]; previewUrl: string; page: unknown };
    expect(data.fields.h1).toBe(PAGE_FIELDS.baslik);
    expect(data.checks).toHaveLength(8);
    expect(data.previewUrl).toMatch(/\/lp\/onizleme\/[A-Za-z0-9_-]{43}$/);
  });

  it("yayınlanmış sayfada landing_pages.fields ve mevcut slug", async () => {
    page = pageRow();
    item.status = "teslim";
    const res = (await loadPagePanel(CID)) as {
      fields: { h1: string };
      slugSuggestion: string;
      page: unknown;
      canPublish: boolean;
      previewUrl: string;
    };
    expect(res.fields.h1).toBe("Düzenlenmiş başlık burada");
    expect(res.slugSuggestion).toBe(SLUG);
    expect(res.page).toEqual({ slug: SLUG, status: "yayinda", publishedAt: "2026-10-20T08:00:00+00:00" });
    expect(res.canPublish).toBe(false);
    expect(res.previewUrl).toBe(`https://yeni.sekeranaokulu.com/lp/onizleme/${TOKEN}`);
    expect(pageWrites()).toHaveLength(0);
  });

  it("geçersiz kimlik", async () => {
    expect(await loadPagePanel("x")).toEqual({ error: "İçerik bulunamadı" });
  });
});
