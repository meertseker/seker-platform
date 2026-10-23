import { describe, it, expect } from "vitest";
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

describe("loadContentForAd (stub, B öncesi)", () => {
  it("ig_published_at dolu → yayinda; eski media_meta durationSec okunur", async () => {
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
    expect(selects[0]).not.toContain("ig_publish_status");
    expect(eqs).toContainEqual(["id", "c1"]);
  });

  it("ig_published_at boş → yok; media_meta null → hepsi null", async () => {
    const c = await loadContentForAd(fakeDb({ ...row, ig_published_at: null, media_meta: null }), "c1");
    expect(c?.igPublishStatus).toBe("yok");
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

  it("bilinmeyen tür → null", async () => {
    expect(await loadContentForAd(fakeDb({ ...row, kind: "video" }), "c1")).toBeNull();
  });
});

describe("loadLandingForAd / loadWeekInstagramPageSlug (stub, A öncesi)", () => {
  it("stub null döner", async () => {
    expect(await loadLandingForAd(fakeDb(null), "c1", "https://sekeranaokulu.com")).toBeNull();
    expect(await loadWeekInstagramPageSlug(fakeDb(null), "R-2644-A")).toBeNull();
  });

  it("Reels kodundan aynı haftanın Instagram sayfa kodu", () => {
    expect(instagramPageCodeFor("R-2644-A")).toBe("S-2644-I");
    expect(instagramPageCodeFor("bozuk")).toBeNull();
  });
});
