import { describe, expect, it, vi } from "vitest";
import fx from "../fixtures/ig-publish.json";
import type { MetaConfig } from "@/lib/ads/meta/config";
import type { AdChangeLogRow } from "@/lib/ads/writes";
import { APPROVAL_REVOKED, DAILY_LIMIT_TEXT, type IgPublishStatus, type QueueRow } from "@/lib/content/publish-queue";
import type { PublishStore, TransitionPatch } from "@/lib/content/publish-store";
import { processItem, runPublishQueue } from "@/lib/content/publish-runner";

const NOW = new Date("2026-10-24T10:00:00+03:00");
const cfg: MetaConfig = {
  accessToken: "tok-secret",
  appSecret: "app-secret",
  adAccountId: "act_42",
  pixelId: null,
  testEventCode: null,
  capiEnabled: false,
  instagramUserId: "17841400000000000",
};
const ON = { IG_PUBLISH_ENABLED: "true" };
const meta = { durationS: 34, width: 1080, height: 1920, vertical: true, coverOffsetMs: 1000, subtitled: true };

function row(extra: Partial<QueueRow> = {}): QueueRow {
  return {
    id: "c1",
    code: "R-2644-A",
    topic: "Bahçe",
    ownerId: "o1",
    kind: "reels",
    status: "onaylandi",
    stage: "organik",
    approverFaceCheck: true,
    mediaPath: "c1/video.mp4",
    mediaMeta: meta,
    caption: "Bahçede ilk gün",
    igPublishStatus: "kuyruk",
    igContainerId: null,
    igPublishScheduledAt: null,
    igPublishRequestedBy: "y1",
    igPublishRequestedAt: "2026-10-24T06:59:00Z",
    igMediaId: null,
    igPermalink: null,
    updatedAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
    ...extra,
  };
}

function fakeStore(rows: QueueRow[], opts: { loseTransition?: boolean; loads?: (QueueRow | null | Error)[] } = {}) {
  const map = new Map(rows.map((r) => [r.id, { ...r }]));
  const calls = {
    transitions: [] as { id: string; from: IgPublishStatus; patch: TransitionPatch }[],
    finish: [] as { contentId: string; status: string; error: string | null; extra?: Record<string, unknown> }[],
    owner: [] as { type: string; payload: Record<string, unknown> }[],
    managers: [] as { type: string; payload: Record<string, unknown> }[],
    logs: [] as AdChangeLogRow[],
  };
  const loads = opts.loads ? [...opts.loads] : null;
  const store: PublishStore = {
    async load(id) {
      if (loads && loads.length) {
        const next = loads.shift()!;
        if (next instanceof Error) throw next;
        return next;
      }
      const r = map.get(id);
      return r ? { ...r } : null;
    },
    async listActive(limit) {
      return [...map.values()].filter((r) => r.igPublishStatus === "kuyruk" || r.igPublishStatus === "isleniyor").slice(0, limit);
    },
    async transition(id, from, patch) {
      calls.transitions.push({ id, from, patch });
      if (opts.loseTransition) return false;
      const r = map.get(id);
      if (!r || r.igPublishStatus !== from) return false;
      if (patch.ig_publish_status) r.igPublishStatus = patch.ig_publish_status;
      if ("ig_container_id" in patch) r.igContainerId = patch.ig_container_id ?? null;
      if (patch.ig_media_id) r.igMediaId = patch.ig_media_id;
      if (patch.ig_permalink) r.igPermalink = patch.ig_permalink;
      r.updatedAt = NOW.toISOString();
      return true;
    },
    async signedVideoUrl(path, seconds) {
      return `https://x.supabase.co/storage/v1/object/sign/icerik/${path}?token=t&s=${seconds}`;
    },
    async insertLog(r) {
      calls.logs.push(r);
      return "log1";
    },
    async finishLog(contentId, status, error, extra) {
      calls.finish.push({ contentId, status, error, extra });
    },
    async notifyOwner(_row, type, payload) {
      calls.owner.push({ type, payload });
    },
    async notifyManagers(type, payload) {
      calls.managers.push({ type, payload });
    },
  };
  return { store, map, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** URL'ye göre yanıt veren sahte fetch. */
function fakeFetch(over: Partial<Record<"limit" | "container" | "status" | "publish" | "media" | "list", unknown>> = {}) {
  const fn = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const pick = (k: keyof typeof over, def: unknown) => {
      const v = k in over ? over[k] : def;
      if (v instanceof Response) return v;
      return json(v);
    };
    if (url.includes("/content_publishing_limit")) return pick("limit", fx.limit);
    if (method === "POST" && url.endsWith("/media")) return pick("container", fx.container);
    if (method === "POST" && url.endsWith("/media_publish")) return pick("publish", fx.publish);
    if (url.includes("/17841400000000000/media?")) return pick("list", { data: [], paging: {} });
    if (url.includes("/1799000000000001?")) return pick("status", fx.statusFinished);
    if (url.includes("/17900000000000077?")) return pick("media", fx.media);
    return json({ error: { message: "beklenmeyen", code: 1 } }, 500);
  });
  return fn;
}
const deps = (store: PublishStore, fetchFn: ReturnType<typeof fakeFetch>, env: Record<string, string | undefined> = ON, c: MetaConfig | null = cfg) => ({
  store,
  cfg: c,
  env,
  fetchFn: fetchFn as unknown as typeof fetch,
  now: () => NOW,
});
const metaCalls = (f: ReturnType<typeof fakeFetch>) => f.mock.calls.map(([u, i]) => `${(i as RequestInit | undefined)?.method ?? "GET"} ${String(u).split("?")[0]}`);

describe("processItem", () => {
  it("planlı saat gelmeden hiçbir şey yapılmaz", async () => {
    const { store, calls } = fakeStore([row({ igPublishScheduledAt: "2026-10-24T12:00:00+03:00" })]);
    const f = fakeFetch();
    expect(await processItem(deps(store, f), "c1")).toEqual({ status: "kuyruk", error: null });
    expect(f).not.toHaveBeenCalled();
    expect(calls.transitions).toHaveLength(0);
  });

  it("kuyruk → konteyner → FINISHED → yayında; kayıt ve bildirim", async () => {
    const { store, map, calls } = fakeStore([row()]);
    const f = fakeFetch();
    expect(await processItem(deps(store, f), "c1")).toEqual({ status: "yayinda", error: null });
    const r = map.get("c1")!;
    expect(r.igPublishStatus).toBe("yayinda");
    expect(r.igMediaId).toBe("17900000000000077");
    const last = calls.transitions.at(-1)!;
    expect(last.patch).toMatchObject({
      ig_publish_status: "yayinda",
      ig_permalink: fx.media.permalink,
      ig_published_at: "2026-10-24T09:12:00.000Z",
      ig_publish_error: null,
    });
    expect(calls.finish).toEqual([
      { contentId: "c1", status: "uygulandi", error: null, extra: { mediaId: "17900000000000077", permalink: fx.media.permalink } },
    ]);
    expect(calls.owner).toEqual([{ type: "ig_yayinlandi", payload: { contentId: "c1", code: "R-2644-A" } }]);
    // Konteyner isteği video URL'si, kapak ve açıklamayla gitti
    const create = f.mock.calls.find(([u, i]) => String(u).endsWith("/media") && (i as RequestInit).method === "POST")!;
    const body = String((create[1] as RequestInit).body);
    expect(body).toContain("thumb_offset=1000");
    expect(body).toContain("s%3D3600");
  });

  it("IN_PROGRESS iken isleniyor kalır ve konteyner kimliği yazılır", async () => {
    const { store, map } = fakeStore([row()]);
    const f = fakeFetch({ status: fx.statusInProgress });
    expect(await processItem(deps(store, f), "c1")).toEqual({ status: "isleniyor", error: null });
    expect(map.get("c1")!.igContainerId).toBe("1799000000000001");
    expect(metaCalls(f)).not.toContain("POST https://graph.facebook.com/v26.0/17841400000000000/media_publish");
  });

  it("koşullu güncelleme kaybedilirse Meta'ya gidilmez", async () => {
    const { store } = fakeStore([row()], { loseTransition: true });
    const f = fakeFetch();
    await processItem(deps(store, f), "c1");
    expect(metaCalls(f).filter((c) => c.startsWith("POST"))).toEqual([]);
  });

  it("60 sn içinde güncellenen isleniyor atlanır", async () => {
    const { store } = fakeStore([
      row({ igPublishStatus: "isleniyor", igContainerId: "1799000000000001", updatedAt: new Date(NOW.getTime() - 30_000).toISOString() }),
    ]);
    const f = fakeFetch();
    expect(await processItem(deps(store, f), "c1")).toEqual({ status: "isleniyor", error: null });
    expect(f).not.toHaveBeenCalled();
  });

  it("isleniyor satırı yoklanır ve FINISHED ise yayınlanır", async () => {
    const { store } = fakeStore([row({ igPublishStatus: "isleniyor", igContainerId: "1799000000000001" })]);
    const f = fakeFetch();
    expect((await processItem(deps(store, f), "c1")).status).toBe("yayinda");
    expect(metaCalls(f).filter((c) => c.startsWith("POST"))).toEqual(["POST https://graph.facebook.com/v26.0/17841400000000000/media_publish"]);
  });

  it("onay geri alınmışsa konteyner açılmaz, hata Onay geri alındı", async () => {
    const { store, map, calls } = fakeStore([row({ status: "duzeltme", approverFaceCheck: null })]);
    const f = fakeFetch();
    expect(await processItem(deps(store, f), "c1")).toEqual({ status: "hata", error: APPROVAL_REVOKED });
    expect(f).not.toHaveBeenCalled();
    expect(map.get("c1")!.igPublishStatus).toBe("hata");
    expect(calls.finish[0]).toMatchObject({ status: "hata", error: APPROVAL_REVOKED });
    expect(calls.managers[0].type).toBe("ig_yayin_hata");
  });

  it("yayından hemen önce MEB kutusu kalkmışsa media_publish çağrılmaz", async () => {
    const base = row({ igPublishStatus: "isleniyor", igContainerId: "1799000000000001" });
    const { store } = fakeStore([base], { loads: [base, { ...base, approverFaceCheck: null }] });
    const f = fakeFetch();
    expect(await processItem(deps(store, f), "c1")).toEqual({ status: "hata", error: APPROVAL_REVOKED });
    expect(metaCalls(f).some((c) => c.endsWith("/media_publish"))).toBe(false);
  });

  it("bayrak kapalıyken kuyruk satırı hata olur, Meta'ya istek gitmez", async () => {
    const { store, map } = fakeStore([row()]);
    const f = fakeFetch();
    const res = await processItem(deps(store, f, {}), "c1");
    expect(res).toEqual({ status: "hata", error: "İçerik yayını kapatıldı; açılınca yeniden yayınlayın" });
    expect(f).not.toHaveBeenCalled();
    expect(map.get("c1")!.igPublishStatus).toBe("hata");
  });

  it("Instagram hesabı yoksa hata: bağlantı kurulmadı", async () => {
    const { store } = fakeStore([row()]);
    const f = fakeFetch();
    expect(await processItem(deps(store, f, ON, { ...cfg, instagramUserId: null }), "c1")).toEqual({
      status: "hata",
      error: "Instagram bağlantısı kurulmadı",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("ERROR 2207026 → Türkçe biçim metni, yöneticilere ig_yayin_hata", async () => {
    const { store, calls } = fakeStore([row()]);
    const f = fakeFetch({ status: fx.statusError });
    const res = await processItem(deps(store, f), "c1");
    expect(res.status).toBe("hata");
    expect(res.error).toMatch(/^Video biçimi Instagram'a uymuyor/);
    expect(calls.managers).toEqual([{ type: "ig_yayin_hata", payload: { contentId: "c1", code: "R-2644-A", error: res.error } }]);
  });

  it("günlük hak dolu: planlı satır kuyrukta kalır ve sebebi yazar; şimdi isteği hata olur", async () => {
    const full = { data: [{ quota_usage: 50, config: { quota_total: 50, quota_duration: 86400 } }] };
    const planned = fakeStore([row({ igPublishScheduledAt: "2026-10-24T09:00:00+03:00" })]);
    const f1 = fakeFetch({ limit: full });
    expect(await processItem(deps(planned.store, f1), "c1")).toEqual({ status: "kuyruk", error: DAILY_LIMIT_TEXT });
    expect(planned.map.get("c1")!.igPublishStatus).toBe("kuyruk");
    expect(planned.calls.transitions[0].patch).toEqual({ ig_publish_error: DAILY_LIMIT_TEXT });
    expect(metaCalls(f1).filter((c) => c.startsWith("POST"))).toEqual([]);

    const now = fakeStore([row()]);
    const f2 = fakeFetch({ limit: full });
    expect(await processItem(deps(now.store, f2), "c1")).toEqual({ status: "hata", error: DAILY_LIMIT_TEXT });
  });

  it("günlük hak Meta hatasıyla gelirse planlı satır kuyruğa döner", async () => {
    const planned = fakeStore([row({ igPublishScheduledAt: "2026-10-24T09:00:00+03:00" })]);
    const f = fakeFetch({ container: new Response(JSON.stringify(fx.errorLimit), { status: 400 }) });
    expect(await processItem(deps(planned.store, f), "c1")).toEqual({ status: "kuyruk", error: DAILY_LIMIT_TEXT });
    expect(planned.map.get("c1")!.igPublishStatus).toBe("kuyruk");
  });

  it("hak okunamazsa yayın engellenmez", async () => {
    const { store } = fakeStore([row()]);
    const f = fakeFetch({ limit: new Response("x", { status: 500 }) });
    expect((await processItem(deps(store, f), "c1")).status).toBe("yayinda");
  });

  it("PUBLISHED kurtarma: medya listesinden eşleşen Reels bulunur", async () => {
    const { store, map } = fakeStore([row({ igPublishStatus: "isleniyor", igContainerId: "1799000000000001" })]);
    const f = fakeFetch({
      status: { status_code: "PUBLISHED" },
      list: {
        data: [
          { id: "1790009", permalink: "https://www.instagram.com/reel/OLD/", timestamp: "2026-10-20T08:00:00+0000", caption: "Bahçede ilk gün" },
          { id: "1790010", permalink: "https://www.instagram.com/reel/NEW/", timestamp: "2026-10-24T07:01:00+0000", caption: "Bahçede ilk gün" },
        ],
        paging: {},
      },
    });
    expect(await processItem(deps(store, f), "c1")).toEqual({ status: "yayinda", error: null });
    expect(map.get("c1")!.igMediaId).toBe("1790010");
    expect(map.get("c1")!.igPermalink).toBe("https://www.instagram.com/reel/NEW/");
  });

  it("PUBLISHED kurtarma bulunamazsa elle yapıştırma metni", async () => {
    const { store } = fakeStore([row({ igPublishStatus: "isleniyor", igContainerId: "1799000000000001" })]);
    const f = fakeFetch({ status: { status_code: "PUBLISHED" } });
    expect(await processItem(deps(store, f), "c1")).toEqual({
      status: "hata",
      error: "Instagram'da yayınlandı ama bağlantı bulunamadı; bağlantıyı elle yapıştırın",
    });
  });
});

describe("runPublishQueue", () => {
  it("bir satırın istisnası diğerini durdurmaz", async () => {
    const a = row({ id: "a" });
    const b = row({ id: "b" });
    const { store } = fakeStore([a, b], { loads: [new Error("db koptu")] });
    const f = fakeFetch();
    const res = await runPublishQueue(deps(store, f), 5);
    expect(res).toEqual({ processed: 2, published: 1, failed: 1 });
  });
});
