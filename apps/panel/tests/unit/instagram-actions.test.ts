import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { QueueRow } from "@/lib/content/publish-queue";

// publishReel ve saveReelVideoMeta: rol kapısı, metin kontrolü, MEB, bayrak (B5), kayıt önce (B2).
type Me = { id: string; full_name: string; role: "yonetici" | "danisman" | "ogretmen"; can_edit_site: boolean };
let me: Me;
const requireRole = vi.fn(async (...roles: string[]) => {
  if (!roles.includes(me.role)) throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
  return me;
});

// Oturum istemcisi (öğretmen) — yalnız saveReelVideoMeta kullanır.
type Op = { table: string; op: string; payload?: unknown; filters: unknown[][] };
let ops: Op[] = [];
let respond: (o: Op) => { data?: unknown; error?: unknown } = () => ({ data: null, error: null });
function builder(table: string) {
  const o: Op = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const filter = (name: string) => (...a: unknown[]) => (o.filters.push([name, ...a]), b);
  for (const f of ["eq", "in", "is"]) b[f] = filter(f);
  b.select = () => b;
  b.update = (p: unknown) => ((o.op = "update"), (o.payload = p), b);
  b.maybeSingle = () => b;
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    ops.push(o);
    const r = respond(o);
    return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve, reject);
  };
  return b;
}
const sessionClient = { from: (t: string) => builder(t) };
const adminClient = { from: () => ({}) };
const createAdminSupabase = vi.fn(() => adminClient);

const getContentRules = vi.fn(async () => ({
  banned: ["en iyi"],
  limits: { reelsCaption: 150, pageTitle: 60, min: 5 },
  rules: { targetTl: 1000, stopMultiple: 2, winMin: 3, noResultWeeks: 2 },
}));

let stored: QueueRow | null;
const store = {
  load: vi.fn(async () => stored),
  transition: vi.fn(async () => true),
  insertLog: vi.fn(async () => "log1"),
  finishLog: vi.fn(async () => {}),
};
const processItem = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...r: string[]) => requireRole(...r) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => sessionClient }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => createAdminSupabase() }));
vi.mock("@/lib/content/settings", () => ({ getContentRules: () => getContentRules() }));
vi.mock("@/lib/content/publish-store", () => ({
  LOG_PENDING: "Yayın sürüyor",
  supabasePublishStore: () => store,
}));
vi.mock("@/lib/content/publish-runner", () => ({ processItem: (...a: unknown[]) => processItem(...a) }));

import { publishReel, saveReelVideoMeta } from "@/actions/instagram";

const YON: Me = { id: "00000000-0000-0000-0000-000000000001", full_name: "Zehra", role: "yonetici", can_edit_site: false };
const DAN: Me = { id: "00000000-0000-0000-0000-000000000002", full_name: "Dan", role: "danisman", can_edit_site: false };
const OGR: Me = { id: "00000000-0000-0000-0000-000000000004", full_name: "Rüya", role: "ogretmen", can_edit_site: false };
const CID = "11111111-1111-1111-1111-111111111111";
const meta = { durationS: 34, width: 1080, height: 1920, vertical: true, coverOffsetMs: 1000, subtitled: true };

function row(extra: Partial<QueueRow> = {}): QueueRow {
  return {
    id: CID, code: "R-2644-A", topic: "Bahçe", ownerId: OGR.id, kind: "reels", status: "onaylandi", stage: "organik",
    approverFaceCheck: true, mediaPath: `${OGR.id}/${CID}/v.mp4`, mediaMeta: meta, caption: "Eski metin burada",
    igPublishStatus: "yok", igContainerId: null, igPublishScheduledAt: null, igPublishRequestedBy: null,
    igPublishRequestedAt: null, igMediaId: null, igPermalink: null, updatedAt: "2026-10-24T06:00:00Z", ...extra,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T10:00:00+03:00"));
  ops = [];
  respond = () => ({ data: null, error: null });
  stored = row();
  for (const f of [store.load, store.transition, store.insertLog, store.finishLog, processItem, createAdminSupabase, revalidatePath]) f.mockClear();
  store.transition.mockImplementation(async () => true);
  store.insertLog.mockImplementation(async () => "log1");
  vi.unstubAllEnvs();
  vi.stubEnv("IG_PUBLISH_ENABLED", "");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("publishReel", () => {
  it("öğretmen ve danışman çağıramaz; gizli anahtarlı istemci oluşturulmaz", async () => {
    for (const who of [OGR, DAN]) {
      me = who;
      await expect(publishReel(CID, { caption: "Bahçede ilk gün" })).rejects.toThrow("NEXT_REDIRECT");
    }
    expect(createAdminSupabase).not.toHaveBeenCalled();
  });

  it("yasaklı ifadeli açıklama reddedilir, kayıt yazılmaz", async () => {
    me = YON;
    expect(await publishReel(CID, { caption: "En iyi okul burada" })).toEqual({ error: "\"en iyi\" kanıt ister, kullanılamaz" });
    expect(store.insertLog).not.toHaveBeenCalled();
  });

  it("MEB kutusu işaretsizse ve elle bağlanmışsa reddedilir", async () => {
    me = YON;
    stored = row({ approverFaceCheck: null });
    expect(await publishReel(CID, { caption: "Bahçede ilk gün" })).toEqual({ error: "MEB kutusu işaretlenmeden yayınlanamaz" });
    stored = row({ igPermalink: "https://www.instagram.com/reel/X/" });
    expect(await publishReel(CID, { caption: "Bahçede ilk gün" })).toEqual({ error: "Bu içerik zaten Instagram'a bağlı" });
    expect(store.insertLog).not.toHaveBeenCalled();
  });

  it("eski yüklemede biçim bilgisi yok metni döner", async () => {
    me = YON;
    stored = row({ mediaMeta: null });
    const res = await publishReel(CID, { caption: "Bahçede ilk gün" });
    expect("error" in res && res.error).toMatch(/^Video biçim bilgisi yok/);
  });

  it("geçersiz kimlik", async () => {
    me = YON;
    expect(await publishReel("x", { caption: "Bahçede ilk gün" })).toEqual({ error: "İçerik bulunamadı" });
  });

  it("bayrak kapalı: uygulanmadi_kapali kaydı, durum değişmez, processItem yok", async () => {
    me = YON;
    const res = await publishReel(CID, { caption: "Bahçede ilk gün" });
    expect(res).toEqual({ ok: true, state: "kapali", message: "Kaydedildi · yayınlanmadı: içerik yayını kapalı" });
    expect(store.insertLog).toHaveBeenCalledTimes(1);
    expect(store.insertLog.mock.calls[0][0]).toMatchObject({
      platform: "meta", level: "icerik", objectId: CID, objectName: "R-2644-A · Bahçe", action: "ig_yayin",
      source: "icerik", status: "uygulanmadi_kapali", error: null, actorId: YON.id, gateRed: false,
      oldValue: { ig_publish_status: "yok", caption: "Eski metin burada" },
      newValue: { caption: "Bahçede ilk gün", scheduledAt: null, thumbOffsetMs: 1000, shareToFeed: true },
    });
    expect(store.transition).not.toHaveBeenCalled();
    expect(processItem).not.toHaveBeenCalled();
  });

  it("bayrak açık + şimdi: kayıt bekliyor, kuyruğa alınır, processItem bir kez, yayında mesajı", async () => {
    me = YON;
    vi.stubEnv("IG_PUBLISH_ENABLED", "true");
    processItem.mockResolvedValue({ status: "yayinda", error: null });
    const res = await publishReel(CID, { caption: "Bahçede ilk gün" });
    expect(res).toEqual({ ok: true, state: "yayinda", message: "Yayında · 72 saat başladı" });
    expect(store.insertLog.mock.calls[0][0]).toMatchObject({ status: "hata", error: "Yayın sürüyor" });
    expect(store.transition).toHaveBeenCalledWith(CID, "yok", expect.objectContaining({
      ig_publish_status: "kuyruk", ig_publish_requested_by: YON.id, ig_publish_scheduled_at: null,
      ig_publish_error: null, ig_container_id: null, caption: "Bahçede ilk gün",
    }));
    expect(processItem).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/reklam/icerik");
  });

  it("bayrak açık + 23:30 planı: kuyruk, processItem yok, uyarı dolu", async () => {
    me = YON;
    vi.stubEnv("IG_PUBLISH_ENABLED", "true");
    const res = await publishReel(CID, { caption: "Bahçede ilk gün", scheduledAt: "2026-10-24T23:30" });
    expect(res).toMatchObject({ ok: true, state: "kuyruk" });
    expect("warning" in res && res.warning).toMatch(/07:00–23:00 dışında/);
    expect("message" in res && res.message).toMatch(/^Planlandı · /);
    expect(processItem).not.toHaveBeenCalled();
    expect(store.transition.mock.calls[0][2]).toMatchObject({ ig_publish_scheduled_at: "2026-10-24T20:30:00.000Z" });
  });

  it("geçersiz plan saati reddedilir", async () => {
    me = YON;
    vi.stubEnv("IG_PUBLISH_ENABLED", "true");
    expect(await publishReel(CID, { caption: "Bahçede ilk gün", scheduledAt: "2026-10-24T10:05" })).toEqual({
      error: "En erken 10 dakika sonrası seçilebilir",
    });
  });

  it("processItem hata dönerse Yayınlanamadı: sebep", async () => {
    me = YON;
    vi.stubEnv("IG_PUBLISH_ENABLED", "true");
    processItem.mockResolvedValue({ status: "hata", error: "Instagram videoyu indiremedi; tekrar deneyin" });
    expect(await publishReel(CID, { caption: "Bahçede ilk gün" })).toEqual({
      error: "Yayınlanamadı: Instagram videoyu indiremedi; tekrar deneyin",
    });
  });

  it("işleniyor dönerse bilgi mesajı", async () => {
    me = YON;
    vi.stubEnv("IG_PUBLISH_ENABLED", "true");
    processItem.mockResolvedValue({ status: "isleniyor", error: null });
    expect(await publishReel(CID, { caption: "Bahçede ilk gün" })).toEqual({
      ok: true, state: "isleniyor", message: "Instagram videoyu işliyor; birkaç dakika içinde yayınlanır",
    });
  });

  it("kayıt yazılamazsa yayın yapılmaz", async () => {
    me = YON;
    vi.stubEnv("IG_PUBLISH_ENABLED", "true");
    store.insertLog.mockRejectedValue(new Error("db"));
    expect(await publishReel(CID, { caption: "Bahçede ilk gün" })).toEqual({ error: "Kayıt yazılamadı; yayınlanmadı." });
    expect(store.transition).not.toHaveBeenCalled();
    expect(processItem).not.toHaveBeenCalled();
  });

  it("koşullu geçiş kaybedilirse içerik değişti ve kayıt kapanır", async () => {
    me = YON;
    vi.stubEnv("IG_PUBLISH_ENABLED", "true");
    store.transition.mockResolvedValue(false);
    expect(await publishReel(CID, { caption: "Bahçede ilk gün" })).toEqual({ error: "İçerik değişti, sayfayı yenileyin" });
    expect(store.finishLog).toHaveBeenCalledWith(CID, "hata", "İçerik değişti, sayfayı yenileyin");
    expect(processItem).not.toHaveBeenCalled();
  });
});

describe("saveReelVideoMeta", () => {
  it("yatay videoyu reddeder, yazmaz", async () => {
    me = OGR;
    expect(await saveReelVideoMeta(CID, { durationS: 20, width: 1920, height: 1080, subtitled: false })).toEqual({
      error: "Video dikey değil. Telefonu dik tutup 9:16 çek.",
    });
    expect(ops.filter((o) => o.op === "update")).toHaveLength(0);
  });

  it("yönetici çağıramaz", async () => {
    me = YON;
    await expect(saveReelVideoMeta(CID, { durationS: 20, width: 1080, height: 1920, subtitled: false })).rejects.toThrow("NEXT_REDIRECT");
  });

  it("mevcut media_meta ile birleştirir ve yalnız kendi düzenlenebilir Reels'ine yazar", async () => {
    me = OGR;
    respond = (o) => {
      if (o.op === "select") return { data: { id: CID, owner_id: OGR.id, kind: "reels", status: "taslak", media_meta: { name: "v.mp4", size: 10 } } };
      return { data: [{ id: CID }] };
    };
    expect(await saveReelVideoMeta(CID, { durationS: 34.04, width: 1080, height: 1920, coverOffsetMs: 2500, subtitled: true })).toEqual({ ok: true });
    const upd = ops.find((o) => o.op === "update")!;
    expect(upd.payload).toEqual({
      media_meta: { name: "v.mp4", size: 10, durationS: 34, width: 1080, height: 1920, vertical: true, coverOffsetMs: 2500, subtitled: true },
    });
    expect(upd.filters).toEqual(
      expect.arrayContaining([["eq", "id", CID], ["eq", "owner_id", OGR.id], ["in", "status", ["taslak", "duzeltme"]], ["eq", "kind", "reels"]]),
    );
  });

  it("teslim edilmiş içerik değiştirilemez", async () => {
    me = OGR;
    respond = (o) => {
      if (o.op === "select") return { data: { id: CID, owner_id: OGR.id, kind: "reels", status: "teslim", media_meta: null } };
      return { data: [] };
    };
    expect(await saveReelVideoMeta(CID, { durationS: 34, width: 1080, height: 1920, subtitled: true })).toEqual({
      error: "Bu içerik şu an değiştirilemez",
    });
  });
});
