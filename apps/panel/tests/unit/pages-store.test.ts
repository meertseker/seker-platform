import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@seker/auth/admin", () => ({
  createAdminSupabase: () => {
    throw new Error("varsayılan istemci beklenmedi");
  },
}));

import { ensureLandingDraft, getLandingPageByContent, isSlugTaken, liveUrl, previewUrl, siteBaseUrl } from "@/lib/pages/store";
import { mediaUrlFor } from "@/lib/pages/media";

type Op = { table: string; op: string; payload?: unknown; filters: unknown[][] };
let ops: Op[] = [];
let respond: (o: Op) => { data?: unknown; error?: unknown } = () => ({ data: null });

function builder(table: string) {
  const o: Op = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const filter = (name: string) => (...a: unknown[]) => (o.filters.push([name, ...a]), b);
  for (const f of ["eq", "neq", "is", "not", "in", "order", "limit"]) b[f] = filter(f);
  b.select = () => b;
  b.insert = (p: unknown) => ((o.op = "insert"), (o.payload = p), b);
  b.update = (p: unknown) => ((o.op = "update"), (o.payload = p), b);
  b.single = () => b;
  b.maybeSingle = () => b;
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    ops.push(o);
    const r = respond(o);
    return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve, reject);
  };
  return b;
}
const client = { from: (t: string) => builder(t) } as unknown as SupabaseClient;

const CID = "11111111-1111-1111-1111-111111111111";
const TOKEN = "a".repeat(43);
const DB_ROW = {
  id: "22222222-2222-2222-2222-222222222222",
  slug: "ilk-hafta-uyum",
  content_id: CID,
  status: "yayinda",
  fields: {
    h1: " İlk hafta uyum ",
    subhead: "Alt",
    bodyBlocks: [{ heading: "a", text: "b" }, { heading: 3 }],
    mediaKey: "yok",
    adPrimaryText: "",
    adHeadline: "",
    metaTitle: "m",
    metaDescription: "d",
  },
  preview_token: TOKEN,
  published_at: "2026-10-20T08:00:00+00:00",
  published_by: "00000000-0000-0000-0000-000000000001",
  archived_at: null,
  created_at: "2026-10-19T08:00:00+00:00",
  updated_at: "2026-10-20T08:00:00+00:00",
};

beforeEach(() => {
  ops = [];
  respond = () => ({ data: null });
  delete process.env.SITE_PUBLIC_URL;
});
afterEach(() => {
  delete process.env.SITE_PUBLIC_URL;
});

describe("getLandingPageByContent", () => {
  it("satırı camelCase'e çevirir, fields'i parseLandingFields'ten geçirir", async () => {
    respond = (o) => (o.table === "landing_pages" ? { data: DB_ROW } : { data: null });
    const row = await getLandingPageByContent(CID, client);
    expect(row).toEqual({
      id: DB_ROW.id,
      slug: "ilk-hafta-uyum",
      contentId: CID,
      status: "yayinda",
      fields: {
        h1: "İlk hafta uyum",
        subhead: "Alt",
        bodyBlocks: [{ heading: "a", text: "b" }],
        mediaKey: null,
        adPrimaryText: "",
        adHeadline: "",
        metaTitle: "m",
        metaDescription: "d",
      },
      previewToken: TOKEN,
      publishedAt: DB_ROW.published_at,
      publishedBy: DB_ROW.published_by,
      archivedAt: null,
      updatedAt: DB_ROW.updated_at,
    });
    expect(ops[0].filters).toContainEqual(["eq", "content_id", CID]);
  });

  it("UUID olmayan kimlikte sorgu yapmaz, null döner", async () => {
    expect(await getLandingPageByContent("x", client)).toBeNull();
    expect(ops).toHaveLength(0);
  });

  it("satır yoksa null", async () => {
    expect(await getLandingPageByContent(CID, client)).toBeNull();
  });

  it("hata fırlatır", async () => {
    respond = () => ({ error: { message: "bağlantı yok" } });
    await expect(getLandingPageByContent(CID, client)).rejects.toThrow("Sayfa okunamadı: bağlantı yok");
  });
});

describe("ensureLandingDraft", () => {
  it("satır varsa onu döner, yazmaz", async () => {
    respond = (o) => (o.op === "select" ? { data: DB_ROW } : { data: null });
    const row = await ensureLandingDraft(client, CID);
    expect(row.previewToken).toBe(TOKEN);
    expect(ops.filter((o) => o.op !== "select")).toHaveLength(0);
  });

  it("yeni satırda taslak ve 43 karakterlik token yazar", async () => {
    respond = (o) => {
      if (o.op === "insert") {
        return { data: { ...DB_ROW, ...(o.payload as object), slug: null, status: "taslak", fields: {}, published_at: null } };
      }
      return { data: null };
    };
    const row = await ensureLandingDraft(client, CID);
    const ins = ops.find((o) => o.op === "insert")!;
    const p = ins.payload as Record<string, unknown>;
    expect(p.content_id).toBe(CID);
    expect(p.status).toBe("taslak");
    expect(p.preview_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row.status).toBe("taslak");
    expect(row.previewToken).toBe(p.preview_token);
  });

  it("eşzamanlı eklemede (23505) satırı yeniden okur", async () => {
    let selects = 0;
    respond = (o) => {
      if (o.op === "insert") return { error: { code: "23505", message: "duplicate" } };
      selects++;
      return { data: selects === 1 ? null : DB_ROW };
    };
    const row = await ensureLandingDraft(client, CID);
    expect(row.previewToken).toBe(TOKEN);
    expect(selects).toBe(2);
  });
});

describe("isSlugTaken", () => {
  it("başka içerikte aynı slug varsa true", async () => {
    respond = () => ({ data: [{ content_id: "33333333-3333-3333-3333-333333333333" }] });
    expect(await isSlugTaken(client, "ilk-hafta-uyum", CID)).toBe(true);
    expect(ops[0].filters).toContainEqual(["eq", "slug", "ilk-hafta-uyum"]);
    expect(ops[0].filters).toContainEqual(["neq", "content_id", CID]);
  });
  it("yoksa false", async () => {
    respond = () => ({ data: [] });
    expect(await isSlugTaken(client, "ilk-hafta-uyum", CID)).toBe(false);
  });
});

describe("adresler", () => {
  it("siteBaseUrl sondaki / işaretini siler", () => {
    process.env.SITE_PUBLIC_URL = "https://a.b/";
    expect(siteBaseUrl()).toBe("https://a.b");
  });
  it("siteBaseUrl boşsa varsayılan", () => {
    process.env.SITE_PUBLIC_URL = "";
    expect(siteBaseUrl()).toBe("https://yeni.sekeranaokulu.com");
    delete process.env.SITE_PUBLIC_URL;
    expect(siteBaseUrl()).toBe("https://yeni.sekeranaokulu.com");
  });
  it("previewUrl ve liveUrl", () => {
    expect(previewUrl("tok")).toBe("https://yeni.sekeranaokulu.com/lp/onizleme/tok");
    expect(liveUrl("ilk-hafta-uyum")).toBe("https://yeni.sekeranaokulu.com/lp/ilk-hafta-uyum");
  });
  it("mediaUrlFor görselin mutlak adresini verir", () => {
    expect(mediaUrlFor("gardenWide")).toBe("https://yeni.sekeranaokulu.com/bahce-genis.webp");
    process.env.SITE_PUBLIC_URL = "https://a.b/";
    expect(mediaUrlFor("mudKitchen")).toBe("https://a.b/mutfak-atolyesi.webp");
  });
});
