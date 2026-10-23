import { describe, it, expect, vi } from "vitest";

vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => { throw new Error("admin istemcisi kullanılmamalı"); } }));

import {
  instagramPageCodeFor,
  loadContentForAd,
  loadLandingForAd,
  loadWeekInstagramPageSlug,
} from "@/lib/ads/preflight-sources";

const row = {
  id: "c1",
  code: "R-2644-A",
  topic: "Bir günümüz",
  kind: "reels",
  platform: "instagram",
  stage: "organik",
  status: "onaylandi",
  approver_face_check: true,
  caption: "Bahçe",
  ig_media_id: "1789",
  ig_permalink: "https://instagram.com/p/x",
  ig_published_at: "2026-10-20T09:00:00Z",
  ig_publish_status: "yayinda",
  media_meta: { name: "a.mp4", size: 10, durationSec: 34 },
};

function fakeDb(data: unknown, selects: string[] = [], eqs: unknown[][] = []) {
  const chain = {
    select: (cols: string) => {
      selects.push(cols);
      return chain;
    },
    eq: (...a: unknown[]) => {
      eqs.push(a);
      return chain;
    },
    maybeSingle: async () => ({ data, error: null }),
  };
  return { from: () => chain } as never;
}

describe("loadContentForAd", () => {
  it("ig_publish_status kolondan; eski media_meta durationSec yedek olarak okunur", async () => {
    const selects: string[] = [];
    const eqs: unknown[][] = [];
    const c = await loadContentForAd(fakeDb(row, selects, eqs), "c1");
    expect(c).toEqual({
      id: "c1",
      code: "R-2644-A",
      topic: "Bir günümüz",
      kind: "reels",
      platform: "instagram",
      stage: "organik",
      status: "onaylandi",
      approverFaceCheck: true,
      caption: "Bahçe",
      igMediaId: "1789",
      igPermalink: "https://instagram.com/p/x",
      igPublishedAt: "2026-10-20T09:00:00Z",
      igPublishStatus: "yayinda",
      mediaMeta: { vertical: null, durationS: 34, subtitled: null },
    });
    expect(selects[0]).toContain("ig_publish_status");
    expect(eqs).toContainEqual(["id", "c1"]);
  });

  it("bilinmeyen ya da boş yayın durumu → yok; media_meta null → hepsi null", async () => {
    const c = await loadContentForAd(fakeDb({ ...row, ig_publish_status: "garip", media_meta: null }), "c1");
    expect(c?.igPublishStatus).toBe("yok");
    expect((await loadContentForAd(fakeDb({ ...row, ig_publish_status: "kuyruk" }), "c1"))?.igPublishStatus).toBe("kuyruk");
    expect(c?.mediaMeta).toEqual({ vertical: null, durationS: null, subtitled: null });
  });

  it("yeni biçim media_meta da okunur", async () => {
    const c = await loadContentForAd(
      fakeDb({ ...row, media_meta: { vertical: true, durationS: 20, subtitled: false } }),
      "c1",
    );
    expect(c?.mediaMeta).toEqual({ vertical: true, durationS: 20, subtitled: false });
  });

  it("approver_face_check null → false; satır yok → null", async () => {
    const c = await loadContentForAd(fakeDb({ ...row, approver_face_check: null }), "c1");
    expect(c?.approverFaceCheck).toBe(false);
    expect(await loadContentForAd(fakeDb(null), "c1")).toBeNull();
  });

  it("okuma hatası fırlatılır (yutulmaz)", async () => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null, error: { message: "x" } }) };
    await expect(loadContentForAd({ from: () => chain } as never, "c1")).rejects.toThrow("İçerik okunamadı");
  });

  it("bilinmeyen tür → null", async () => {
    expect(await loadContentForAd(fakeDb({ ...row, kind: "video" }), "c1")).toBeNull();
  });
});

const CONTENT_ID = "11111111-1111-4111-8111-111111111111";
const PAGE_CONTENT_ID = "22222222-2222-4222-8222-222222222222";

function landingRow(over: Record<string, unknown> = {}) {
  return {
    id: "lp1",
    slug: "bahce-gunu",
    content_id: CONTENT_ID,
    status: "yayinda",
    fields: { adHeadline: "Bahçede bir gün", adPrimaryText: "Çamur mutfağı", mediaKey: "mudKitchen" },
    preview_token: "t",
    published_at: null,
    published_by: null,
    archived_at: null,
    updated_at: "2026-10-20T09:00:00Z",
    ...over,
  };
}

/** Tabloya göre cevap veren sahte istemci: content_items ve landing_pages. */
function tableDb(tables: { content_items?: unknown; landing_pages?: unknown }, eqs: unknown[][] = []) {
  return {
    from: (table: keyof typeof tables) => {
      const chain = {
        select: () => chain,
        eq: (...a: unknown[]) => {
          eqs.push([table, ...a]);
          return chain;
        },
        maybeSingle: async () => ({ data: tables[table] ?? null, error: null }),
      };
      return chain;
    },
  } as never;
}

describe("loadLandingForAd (A)", () => {
  it("sayfa satırı → durum, adres, reklam yazıları ve mutlak görsel adresi", async () => {
    const l = await loadLandingForAd(tableDb({ landing_pages: landingRow() }), CONTENT_ID, "https://sekeranaokulu.com/");
    expect(l).toEqual({
      status: "yayinda",
      slug: "bahce-gunu",
      headline: "Bahçede bir gün",
      primaryText: "Çamur mutfağı",
      imageUrl: expect.stringMatching(/^https:\/\/sekeranaokulu\.com\/[^/]/),
    });
  });

  it("satır yok → null; görsel seçilmemiş ve boş yazılar → null", async () => {
    expect(await loadLandingForAd(tableDb({}), CONTENT_ID, "https://a.b")).toBeNull();
    const l = await loadLandingForAd(
      tableDb({ landing_pages: landingRow({ status: "taslak", fields: { adHeadline: "", adPrimaryText: "", mediaKey: null } }) }),
      CONTENT_ID,
      "https://a.b",
    );
    expect(l).toMatchObject({ status: "taslak", headline: null, primaryText: null, imageUrl: null });
  });

  it("adressiz satır yayında sayılmaz", async () => {
    const l = await loadLandingForAd(tableDb({ landing_pages: landingRow({ slug: null }) }), CONTENT_ID, "https://a.b");
    expect(l).toMatchObject({ status: "taslak", slug: "" });
  });
});

describe("loadWeekInstagramPageSlug (B14)", () => {
  it("aynı haftanın S-yyww-I sayfası yayındaysa slug'ı", async () => {
    const eqs: unknown[][] = [];
    const db = tableDb({ content_items: { id: PAGE_CONTENT_ID }, landing_pages: landingRow({ content_id: PAGE_CONTENT_ID }) }, eqs);
    expect(await loadWeekInstagramPageSlug(db, "R-2644-A")).toBe("bahce-gunu");
    expect(eqs).toContainEqual(["content_items", "code", "S-2644-I"]);
    expect(eqs).toContainEqual(["landing_pages", "content_id", PAGE_CONTENT_ID]);
  });

  it("sayfa taslak, içerik yok ya da kod bozuk → null", async () => {
    const draft = tableDb({ content_items: { id: PAGE_CONTENT_ID }, landing_pages: landingRow({ status: "taslak" }) });
    expect(await loadWeekInstagramPageSlug(draft, "R-2644-A")).toBeNull();
    expect(await loadWeekInstagramPageSlug(tableDb({}), "R-2644-A")).toBeNull();
    expect(await loadWeekInstagramPageSlug(tableDb({}), "bozuk")).toBeNull();
  });

  it("Reels kodundan aynı haftanın Instagram sayfa kodu", () => {
    expect(instagramPageCodeFor("R-2644-A")).toBe("S-2644-I");
    expect(instagramPageCodeFor("bozuk")).toBeNull();
  });
});
