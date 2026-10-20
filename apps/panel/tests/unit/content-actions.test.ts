import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// İçerik sunucu eylemleri: oturum istemcisi (öğretmen) ve gizli anahtarlı istemci (yönetici) ayrı izlenir.
type Op = { client: "session" | "admin"; table: string; op: string; payload?: unknown; filters: unknown[][] };
let ops: Op[] = [];
let respond: (o: Op) => { data?: unknown; error?: unknown } = () => ({ data: null, error: null });

function builder(client: Op["client"], table: string) {
  const o: Op = { client, table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const filter = (name: string) => (...a: unknown[]) => (o.filters.push([name, ...a]), b);
  for (const f of ["eq", "is", "not", "in", "gte", "lt", "like", "order", "limit"]) b[f] = filter(f);
  b.select = () => b;
  b.insert = (p: unknown) => ((o.op = "insert"), (o.payload = p), b);
  b.update = (p: unknown) => ((o.op = "update"), (o.payload = p), b);
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

const createSignedUploadUrl = vi.fn();
const list = vi.fn();
const storageFrom = vi.fn(() => ({ createSignedUploadUrl, list }));
const sessionClient = { from: (t: string) => builder("session", t) };
const adminClient = { from: (t: string) => builder("admin", t), storage: { from: storageFrom } };
const createAdminSupabase = vi.fn(() => adminClient);

type Me = { id: string; full_name: string; role: "yonetici" | "danisman" | "ogretmen"; can_edit_site: boolean };
let me: Me;
const requireRole = vi.fn(async (...roles: string[]) => {
  if (!roles.includes(me.role)) {
    // Gerçek requireRole redirect() fırlatır.
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
  }
  return me;
});

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...r: string[]) => requireRole(...r) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => sessionClient }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => createAdminSupabase() }));

import {
  approveContent,
  createContentTask,
  linkInstagramPost,
  moveContentStage,
  requestRevision,
  requestVideoUpload,
  saveContentDraft,
  saveLearnedNote,
  submitContent,
} from "@/actions/content";
import { notificationText } from "@/lib/notification-text";

const YON: Me = { id: "00000000-0000-0000-0000-000000000001", full_name: "Mehtap Hanım", role: "yonetici", can_edit_site: true };
const DAN: Me = { id: "00000000-0000-0000-0000-000000000002", full_name: "Zehra Hanım", role: "danisman", can_edit_site: false };
const OGR: Me = { id: "00000000-0000-0000-0000-000000000004", full_name: "Rüya Yılmaz", role: "ogretmen", can_edit_site: false };
const CID = "11111111-1111-1111-1111-111111111111";
const MB = 1024 * 1024;
const UPDATED = "2026-10-20T08:00:00.123456+00:00";
const SUBMITTED = "2026-10-20T07:00:00.5+00:00";

const ofOps = (client: Op["client"], table: string, op: string) =>
  ops.filter((o) => o.client === client && o.table === table && o.op === op);
const payloads = (client: Op["client"], table: string, op: string) =>
  ofOps(client, table, op).map((o) => o.payload as Record<string, unknown>);
const writes = () => ops.filter((o) => o.op !== "select");

const taskInput = {
  kind: "reels" as const,
  ownerId: OGR.id,
  topic: "Sabah karşılama",
  audience: "3-4 yaş velisi",
  brief: "Kapıda karşılama anı",
  dueAt: "2026-10-22T17:00",
  weekOf: "2026-10-19",
};

let row: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  ops = [];
  me = YON;
  delete process.env.CONTENT_VIDEO_MAX_MB;
  row = {
    id: CID, code: "R-2643-A", kind: "reels", owner_id: OGR.id, status: "taslak", stage: "gorev",
    caption: "Sabah kapıda her çocuğu adıyla karşılıyoruz.", page_fields: null,
    media_path: `${OGR.id}/${CID}/video.mp4`, face_answer: false,
    submitted_at: null, updated_at: UPDATED,
  };
  list.mockResolvedValue({ data: [{ name: "video.mp4" }], error: null });
  createSignedUploadUrl.mockResolvedValue({
    data: { signedUrl: "https://x/upload?token=t", token: "t", path: `${OGR.id}/${CID}/video.mp4` },
    error: null,
  });
  respond = (o) => {
    if (o.table === "profiles" && o.filters.some((f) => f[0] === "eq" && f[1] === "id")) {
      return { data: { id: OGR.id, full_name: "Rüya Yılmaz", role: "ogretmen", is_active: true, phone: "+905321112233" } };
    }
    if (o.table === "profiles") return { data: [{ id: YON.id }, { id: "00000000-0000-0000-0000-000000000009" }] };
    if (o.table === "content_items" && o.op === "select") {
      return o.filters.some((f) => f[1] === "week_start") ? { data: [] } : { data: row };
    }
    if (o.table === "content_items" && o.op === "insert") return { data: { id: CID } };
    if (o.table === "content_items" && o.op === "update") return { data: [{ id: CID }] };
    if (o.table === "app_settings") return { data: [] };
    return { data: null };
  };
});
afterEach(() => {
  delete process.env.CONTENT_VIDEO_MAX_MB;
});

describe("yetki", () => {
  it("danışman görev açamaz", async () => {
    me = DAN;
    await expect(createContentTask(taskInput)).rejects.toThrow("NEXT_REDIRECT");
    expect(createAdminSupabase).not.toHaveBeenCalled();
    expect(writes()).toHaveLength(0);
  });

  it("öğretmen yönetici eylemlerini çağıramaz, gizli anahtarlı istemci oluşturulmaz", async () => {
    me = OGR;
    const calls: [string, () => Promise<unknown>][] = [
      ["approveContent", () => approveContent(CID, { noStudentFaceOrName: true, submittedAt: SUBMITTED })],
      ["requestRevision", () => requestRevision(CID, "Sesi kısık")],
      ["moveContentStage", () => moveContentStage(CID, "test")],
      ["createContentTask", () => createContentTask(taskInput)],
      ["linkInstagramPost", () => linkInstagramPost(CID, "https://www.instagram.com/reel/AbC123/")],
      ["saveLearnedNote", () => saveLearnedNote(CID, "Sabah çekimi iyi gitti")],
    ];
    for (const [name, call] of calls) {
      await expect(call(), name).rejects.toThrow("NEXT_REDIRECT");
    }
    expect(requireRole).toHaveBeenCalledTimes(calls.length);
    for (const c of requireRole.mock.calls) expect(c).toEqual(["yonetici"]);
    expect(createAdminSupabase).not.toHaveBeenCalled();
    expect(ops).toHaveLength(0);
  });

  it("yönetici öğretmen eylemlerini çağıramaz", async () => {
    me = YON;
    await expect(requestVideoUpload(CID, "a.mp4", MB, "video/mp4")).rejects.toThrow("NEXT_REDIRECT");
    await expect(submitContent(CID)).rejects.toThrow("NEXT_REDIRECT");
    await expect(saveContentDraft(CID, { caption: "x" })).rejects.toThrow("NEXT_REDIRECT");
    expect(createAdminSupabase).not.toHaveBeenCalled();
  });
});

describe("createContentTask", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T09:00:00+03:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("geçmiş teslim zamanı reddedilir", async () => {
    expect(await createContentTask({ ...taskInput, dueAt: "2026-10-18T17:00" })).toEqual({
      error: "Teslim zamanı geçmiş olamaz",
    });
    expect(ofOps("admin", "content_items", "insert")).toHaveLength(0);
  });

  it("öğretmen olmayan profile görev atanamaz", async () => {
    const base = respond;
    respond = (o) =>
      o.table === "profiles" && o.op === "select"
        ? { data: { id: DAN.id, full_name: "Zehra Hanım", role: "danisman", is_active: true, phone: null } }
        : base(o);
    const res = await createContentTask({ ...taskInput, ownerId: DAN.id });
    expect(res).toEqual({ error: "Görev yalnız etkin bir öğretmene verilebilir" });
    expect(ofOps("admin", "content_items", "insert")).toHaveLength(0);
  });

  it("pasif öğretmene görev atanamaz", async () => {
    const base = respond;
    respond = (o) =>
      o.table === "profiles" && o.op === "select"
        ? { data: { id: OGR.id, full_name: "Rüya Yılmaz", role: "ogretmen", is_active: false, phone: null } }
        : base(o);
    expect(await createContentTask(taskInput)).toEqual({ error: "Görev yalnız etkin bir öğretmene verilebilir" });
  });

  it("kod çakışmasında bir sonraki harf denenir", async () => {
    const base = respond;
    let inserts = 0;
    respond = (o) => {
      if (o.table === "content_items" && o.op === "select" && o.filters.some((f) => f[1] === "week_start")) {
        // İlk okumada boş; eşzamanlı açılış A'yı aldıktan sonra A görünür.
        return { data: inserts === 0 ? [] : [{ code: "R-2643-A" }] };
      }
      if (o.table === "content_items" && o.op === "insert") {
        inserts += 1;
        return inserts === 1 ? { error: { code: "23505", message: "duplicate key" } } : { data: { id: CID } };
      }
      return base(o);
    };
    const res = await createContentTask(taskInput);
    expect(res).toMatchObject({ id: CID, code: "R-2643-B" });
    expect(payloads("admin", "content_items", "insert").map((p) => p.code)).toEqual(["R-2643-A", "R-2643-B"]);
  });

  it("üç denemede de çakışırsa hata döner", async () => {
    const base = respond;
    respond = (o) =>
      o.table === "content_items" && o.op === "insert" ? { error: { code: "23505", message: "dup" } } : base(o);
    const res = await createContentTask(taskInput);
    expect(res).toHaveProperty("error");
    expect(ofOps("admin", "content_items", "insert")).toHaveLength(3);
  });

  it("görev açılınca öğretmene icerik_gorev bildirimi yazılır ve WhatsApp bağlantısı döner", async () => {
    const res = await createContentTask(taskInput);
    expect(res).toMatchObject({ id: CID, code: "R-2643-A" });
    const insert = payloads("admin", "content_items", "insert")[0];
    expect(insert).toMatchObject({
      code: "R-2643-A", kind: "reels", platform: "instagram", week_start: "2026-10-19",
      topic: "Sabah karşılama", audience: "3-4 yaş velisi", brief: "Kapıda karşılama anı",
      owner_id: OGR.id, created_by: YON.id, due_at: new Date("2026-10-22T17:00:00+03:00").toISOString(),
    });
    expect(payloads("admin", "notifications", "insert")).toEqual([
      { user_id: OGR.id, type: "icerik_gorev", payload: { contentId: CID, code: "R-2643-A" } },
    ]);
    const waLink = (res as { waLink: string | null }).waLink!;
    expect(waLink.startsWith("https://wa.me/905321112233?text=")).toBe(true);
    expect(decodeURIComponent(waLink.split("text=")[1])).toBe(
      "Rüya Hocam, bu haftanın Reels görevi panelde: Sabah karşılama. Teslim: Perşembe 22 Ekim 17:00. Görevim ekranından açabilirsin.",
    );
  });

  it("telefonu olmayan öğretmende waLink null", async () => {
    const base = respond;
    respond = (o) =>
      o.table === "profiles" && o.op === "select" && o.filters.some((f) => f[1] === "id")
        ? { data: { id: OGR.id, full_name: "Rüya Yılmaz", role: "ogretmen", is_active: true, phone: null } }
        : base(o);
    const res = await createContentTask(taskInput);
    expect(res).toMatchObject({ waLink: null });
  });

  it("Instagram sayfası I koduyla, instagram platformuyla açılır", async () => {
    const res = await createContentTask({ ...taskInput, kind: "sayfa", pagePlatform: "instagram" });
    expect(res).toMatchObject({ code: "S-2643-I" });
    expect(payloads("admin", "content_items", "insert")[0]).toMatchObject({ kind: "sayfa", platform: "instagram" });
  });

  it("konu ve teslim zamanı zorunlu", async () => {
    expect(await createContentTask({ ...taskInput, topic: "  " })).toHaveProperty("error");
    expect(await createContentTask({ ...taskInput, dueAt: "bozuk" })).toHaveProperty("error");
    expect(ofOps("admin", "content_items", "insert")).toHaveLength(0);
  });
});

describe("requestVideoUpload", () => {
  beforeEach(() => {
    me = OGR;
  });

  it("sınırı aşan video için Türkçe hata döner, adres verilmez", async () => {
    const res = await requestVideoUpload(CID, "IMG_0001.MOV", 80 * MB, "video/quicktime");
    expect(res).toEqual({
      error:
        "Video 80 MB, en fazla 50 MB olabilir. Telefon kamerasında 1080p 30 kare seçip yeniden çek ya da videoyu paylaşırken 'daha küçük boyut' seç.",
    });
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("50 MB üstü video adresi verilmez, 50 MB verilir", async () => {
    expect(await requestVideoUpload(CID, "a.mp4", 50 * MB + 1, "video/mp4")).toHaveProperty("error");
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
    const ok = await requestVideoUpload(CID, "a.mp4", 50 * MB, "video/mp4");
    expect(ok).toEqual({ path: createSignedUploadUrl.mock.calls[0][0], signedUrl: "https://x/upload?token=t", token: "t" });
  });

  it("CONTENT_VIDEO_MAX_MB sınırı yükseltir", async () => {
    process.env.CONTENT_VIDEO_MAX_MB = "100";
    expect(await requestVideoUpload(CID, "a.mp4", 80 * MB, "video/mp4")).not.toHaveProperty("error");
    expect(await requestVideoUpload(CID, "a.mp4", 120 * MB, "video/mp4")).toEqual({
      error: expect.stringContaining("Video 120 MB, en fazla 100 MB olabilir."),
    });
  });

  it("dosya adını güvenli yapar ve yolu sahibin klasörüne koyar", async () => {
    await requestVideoUpload(CID, "../Sabah Çekimi (1)..MP4", MB, "video/mp4");
    expect(storageFrom).toHaveBeenCalledWith("icerik");
    const path = createSignedUploadUrl.mock.calls[0][0] as string;
    expect(path.startsWith(`${OGR.id}/${CID}/`)).toBe(true);
    const name = path.slice(`${OGR.id}/${CID}/`.length);
    expect(name).toMatch(/^[a-z0-9._-]+$/);
    expect(name).not.toContain("..");
    expect(name).toMatch(/^sabah-cekimi-1-[a-z0-9]+\.mp4$/);
  });

  it("her istek yeni bir dosya adı alır ve üzerine yazmaz", async () => {
    await requestVideoUpload(CID, "video.mp4", MB, "video/mp4");
    await requestVideoUpload(CID, "video.mp4", MB, "video/mp4");
    const [a, b] = createSignedUploadUrl.mock.calls;
    expect(a[0]).not.toBe(b[0]);
    expect(a[1]).toEqual({ upsert: false });
    expect(b[1]).toEqual({ upsert: false });
  });

  it("izinsiz tür, başkasının içeriği, teslim edilmiş içerik ve sayfa görevi reddedilir", async () => {
    expect(await requestVideoUpload(CID, "a.avi", MB, "video/x-msvideo")).toHaveProperty("error");
    row = { ...row, owner_id: "00000000-0000-0000-0000-000000000005" };
    expect(await requestVideoUpload(CID, "a.mp4", MB, "video/mp4")).toHaveProperty("error");
    row = { ...row, owner_id: OGR.id, status: "teslim" };
    expect(await requestVideoUpload(CID, "a.mp4", MB, "video/mp4")).toHaveProperty("error");
    row = { ...row, status: "taslak", kind: "sayfa" };
    expect(await requestVideoUpload(CID, "a.mp4", MB, "video/mp4")).toHaveProperty("error");
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
});

describe("saveContentDraft", () => {
  beforeEach(() => {
    me = OGR;
  });

  it("yalnız verilen alanları oturum istemcisiyle yazar", async () => {
    expect(await saveContentDraft(CID, { caption: "Yeni açıklama", faceAnswer: false })).toEqual({ ok: true });
    expect(createAdminSupabase).not.toHaveBeenCalled();
    expect(payloads("session", "content_items", "update")).toEqual([{ caption: "Yeni açıklama", face_answer: false }]);
  });

  it("video değişip yüz cevabı birlikte gelmezse cevap sıfırlanır", async () => {
    const path = `${OGR.id}/${CID}/yeni-abc.mp4`;
    expect(await saveContentDraft(CID, { mediaPath: path })).toEqual({ ok: true });
    expect(payloads("session", "content_items", "update")).toEqual([{ media_path: path, face_answer: null }]);
  });

  it("aynı video yeniden yazılınca ya da cevap birlikte gelince cevap korunur", async () => {
    expect(await saveContentDraft(CID, { mediaPath: row.media_path as string, caption: "x" })).toEqual({ ok: true });
    const path = `${OGR.id}/${CID}/yeni-abc.mp4`;
    expect(await saveContentDraft(CID, { mediaPath: path, faceAnswer: false })).toEqual({ ok: true });
    expect(payloads("session", "content_items", "update")).toEqual([
      { caption: "x", media_path: row.media_path },
      { media_path: path, face_answer: false },
    ]);
  });

  it("satır güncellenmezse hata döner", async () => {
    const base = respond;
    respond = (o) => (o.table === "content_items" && o.op === "update" ? { data: [] } : base(o));
    expect(await saveContentDraft(CID, { caption: "x" })).toHaveProperty("error");
  });

  it("başka klasöre video yolu yazılamaz", async () => {
    expect(await saveContentDraft(CID, { mediaPath: `baska/${CID}/a.mp4` })).toHaveProperty("error");
    expect(writes()).toHaveLength(0);
  });
});

describe("submitContent", () => {
  beforeEach(() => {
    me = OGR;
  });

  it("yüz Evet iken teslim reddedilir ve hiçbir yazım yapılmaz", async () => {
    row = { ...row, face_answer: true };
    const res = await submitContent(CID);
    expect(res).toMatchObject({ error: expect.any(String), blockers: ["Öğrenci yüzü ya da adı olan içerik kullanılamaz"] });
    expect(writes()).toHaveLength(0);
    expect(list).not.toHaveBeenCalled();
  });

  it("yüz sorusu cevapsızsa teslim reddedilir", async () => {
    row = { ...row, face_answer: null };
    expect(await submitContent(CID)).toMatchObject({ blockers: ["Yüz sorusunu cevapla"] });
    expect(writes()).toHaveLength(0);
  });

  it("depoda video yoksa teslim reddedilir", async () => {
    list.mockResolvedValue({ data: [], error: null });
    expect(await submitContent(CID)).toEqual({ error: "Video bulunamadı, yeniden yükle" });
    expect(list).toHaveBeenCalledWith(`${OGR.id}/${CID}`, expect.anything());
    expect(writes()).toHaveLength(0);
  });

  it("teslim yöneticilere bildirim yazar ve aşamayı kontrol yapar", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T09:00:00Z"));
    try {
      const res = await submitContent(CID);
      expect(res).toEqual({ ok: true, done: ["Otomatik kontrol geçti", "Yöneticinin onayında"] });
    } finally {
      vi.useRealTimers();
    }
    // Öğretmen durumu değiştiremez: teslim, kontrollerden sonra gizli anahtarlı istemciyle yazılır;
    // submitted_at, stage='kontrol' ve stage_changed_at DB tetikleyicisinde aynı güncellemede damgalanır.
    expect(payloads("session", "content_items", "update")).toEqual([]);
    const adminUpdate = ofOps("admin", "content_items", "update");
    expect(adminUpdate.map((o) => o.payload)).toEqual([{ status: "teslim" }]);
    expect(adminUpdate[0].filters).toContainEqual(["eq", "owner_id", OGR.id]);
    expect(adminUpdate[0].filters).toContainEqual(["in", "status", ["taslak", "duzeltme"]]);
    expect(payloads("admin", "notifications", "insert")).toEqual([
      { user_id: YON.id, type: "icerik_teslim", payload: { contentId: CID, code: "R-2643-A" } },
      { user_id: "00000000-0000-0000-0000-000000000009", type: "icerik_teslim", payload: { contentId: CID, code: "R-2643-A" } },
    ]);
    const managers = ofOps("admin", "profiles", "select")[0];
    expect(managers.filters).toContainEqual(["eq", "role", "yonetici"]);
    expect(managers.filters).toContainEqual(["eq", "is_active", true]);
  });

  it("sayfa başlığı kontrolden geçmezse teslim edilmez", async () => {
    row = { ...row, kind: "sayfa", code: "S-2643-G", media_path: null, face_answer: null, caption: null,
      page_fields: { baslik: "Bölgenin en iyi anaokulu" } };
    const res = await submitContent(CID);
    expect(res).toMatchObject({ blockers: ['"en iyi" kanıt ister, kullanılamaz'] });
    expect(writes()).toHaveLength(0);
  });

  it("kontrol edilen yazı sürümü teslim edilir; arada değiştiyse teslim edilmez", async () => {
    expect(await submitContent(CID)).toMatchObject({ ok: true });
    expect(ofOps("admin", "content_items", "update")[0].filters).toContainEqual(["eq", "updated_at", UPDATED]);
    ops = [];
    const base = respond;
    respond = (o) => (o.table === "content_items" && o.op === "update" ? { data: [] } : base(o));
    expect(await submitContent(CID)).toEqual({ error: "Yazı değişti, tekrar dene" });
    expect(payloads("admin", "notifications", "insert")).toHaveLength(0);
  });

  it("teslim edilmiş içerik yeniden teslim edilemez", async () => {
    row = { ...row, status: "teslim" };
    expect(await submitContent(CID)).toHaveProperty("error");
    expect(writes()).toHaveLength(0);
  });
});

describe("approveContent", () => {
  beforeEach(() => {
    row = { ...row, status: "teslim", stage: "kontrol", submitted_at: SUBMITTED };
  });

  it("onay, yöneticinin gördüğü teslime bağlıdır", async () => {
    expect(await approveContent(CID, { noStudentFaceOrName: true, submittedAt: SUBMITTED })).toEqual({ ok: true });
    expect(ofOps("admin", "content_items", "update")[0].filters).toContainEqual(["eq", "submitted_at", SUBMITTED]);
  });

  it("görülen teslimden sonra içerik değiştiyse onaylanmaz", async () => {
    const changed = { error: "İçerik değişti, sayfayı yenileyin" };
    expect(await approveContent(CID, { noStudentFaceOrName: true, submittedAt: "2026-10-19T07:00:00+00:00" })).toEqual(changed);
    expect(await approveContent(CID, { noStudentFaceOrName: true } as never)).toEqual(changed);
    expect(writes()).toHaveLength(0);
    // Okuma ile yazma arasında yeniden teslim edildiyse satır eşleşmez.
    const base = respond;
    respond = (o) => (o.table === "content_items" && o.op === "update" ? { data: [] } : base(o));
    expect(await approveContent(CID, { noStudentFaceOrName: true, submittedAt: SUBMITTED })).toEqual(changed);
    expect(payloads("admin", "notifications", "insert")).toHaveLength(0);
  });

  it("onay Reels'i organik, sayfayı test aşamasına taşır", async () => {
    expect(await approveContent(CID, { noStudentFaceOrName: true, submittedAt: SUBMITTED })).toEqual({ ok: true });
    const reels = payloads("admin", "content_items", "update")[0];
    expect(reels).toMatchObject({
      status: "onaylandi", approved_by: YON.id, approver_face_check: true, stage: "organik",
    });
    expect(typeof reels.approved_at).toBe("string");
    expect(ofOps("admin", "content_items", "update")[0].filters).toContainEqual(["eq", "status", "teslim"]);
    expect(payloads("admin", "notifications", "insert")).toEqual([
      { user_id: OGR.id, type: "icerik_onay", payload: { contentId: CID, code: "R-2643-A" } },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/gorevim");

    ops = [];
    row = { ...row, kind: "sayfa", code: "S-2643-G", face_answer: null, media_path: null };
    expect(await approveContent(CID, { noStudentFaceOrName: false, submittedAt: SUBMITTED })).toEqual({ ok: true });
    expect(payloads("admin", "content_items", "update")[0]).toMatchObject({ status: "onaylandi", stage: "test" });
  });

  it("Reels onayı yüz/isim onay kutusu işaretlenmeden reddedilir", async () => {
    expect(await approveContent(CID, { noStudentFaceOrName: false, submittedAt: SUBMITTED })).toEqual({
      error: "Videoyu izleyip öğrenci yüzü ve adı olmadığını onaylayın",
    });
    expect(writes()).toHaveLength(0);
  });

  it("öğretmenin cevabı Hayır değilse Reels onaylanmaz", async () => {
    row = { ...row, face_answer: null };
    expect(await approveContent(CID, { noStudentFaceOrName: true, submittedAt: SUBMITTED })).toHaveProperty("error");
    row = { ...row, face_answer: true };
    expect(await approveContent(CID, { noStudentFaceOrName: true, submittedAt: SUBMITTED })).toHaveProperty("error");
    expect(writes()).toHaveLength(0);
  });

  it("teslim edilmemiş içerik onaylanmaz", async () => {
    row = { ...row, status: "taslak" };
    expect(await approveContent(CID, { noStudentFaceOrName: true, submittedAt: SUBMITTED })).toHaveProperty("error");
    expect(writes()).toHaveLength(0);
  });
});

describe("requestRevision", () => {
  beforeEach(() => {
    row = { ...row, status: "teslim", stage: "kontrol" };
  });

  it("düzeltme notsuz reddedilir", async () => {
    expect(await requestRevision(CID, "  ")).toHaveProperty("error");
    expect(await requestRevision(CID, "ab")).toHaveProperty("error");
    expect(writes()).toHaveLength(0);
  });

  it("not ile görevi öğretmene geri yollar ve bildirim yazar", async () => {
    expect(await requestRevision(CID, " Sesi kısık, yeniden çek ")).toEqual({ ok: true });
    expect(payloads("admin", "content_items", "update")[0]).toMatchObject({
      status: "duzeltme", stage: "gorev", review_note: "Sesi kısık, yeniden çek",
      face_answer: null, approver_face_check: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/gorevim");
    expect(payloads("admin", "notifications", "insert")).toEqual([
      { user_id: OGR.id, type: "icerik_duzeltme", payload: { contentId: CID, code: "R-2643-A", note: "Sesi kısık, yeniden çek" } },
    ]);
  });
});

describe("moveContentStage", () => {
  it("geçersiz aşama geçişi reddedilir", async () => {
    row = { ...row, status: "onaylandi", stage: "organik" };
    expect(await moveContentStage(CID, "kazanan")).toHaveProperty("error");
    row = { ...row, stage: "arsiv" };
    expect(await moveContentStage(CID, "gorev")).toHaveProperty("error");
    row = { ...row, stage: "kontrol" };
    expect(await moveContentStage(CID, "test")).toHaveProperty("error");
    expect(await moveContentStage(CID, "bilinmez" as never)).toHaveProperty("error");
    expect(writes()).toHaveLength(0);
  });

  it("izinli geçişi yazar", async () => {
    row = { ...row, status: "onaylandi", stage: "organik" };
    expect(await moveContentStage(CID, "test")).toEqual({ ok: true });
    const u = ofOps("admin", "content_items", "update")[0];
    expect(u.payload).toMatchObject({ stage: "test" });
    expect(u.filters).toContainEqual(["eq", "stage", "organik"]);
  });
});

describe("linkInstagramPost ve saveLearnedNote", () => {
  it("Instagram bağlantısını doğrular ve sade biçimde yazar", async () => {
    expect(await linkInstagramPost(CID, "https://example.com/reel/x/")).toHaveProperty("error");
    expect(await linkInstagramPost(CID, "http://www.instagram.com/reel/AbC/")).toHaveProperty("error");
    expect(writes()).toHaveLength(0);
    expect(await linkInstagramPost(CID, " https://www.instagram.com/reel/AbC_1-x?igsh=xyz ")).toEqual({ ok: true });
    expect(payloads("admin", "content_items", "update")[0]).toEqual({ ig_permalink: "https://www.instagram.com/reel/AbC_1-x/", ig_media_id: null, ig_published_at: null });
    expect(ofOps("admin", "content_organic_stats", "delete")).toHaveLength(1);
  });

  it("öğrenilen notu yazar", async () => {
    expect(await saveLearnedNote(CID, " Sabah ışığı iyi ")).toEqual({ ok: true });
    expect(payloads("admin", "content_items", "update")[0]).toEqual({ learned_note: "Sabah ışığı iyi" });
  });
});

describe("bildirim metinleri", () => {
  it("içerik bildirimlerini Türkçe yazar", () => {
    expect(notificationText({ type: "icerik_gorev", payload: { code: "R-2643-A" } })).toBe("Yeni içerik görevi: R-2643-A");
    expect(notificationText({ type: "icerik_teslim", payload: { code: "R-2643-A" } })).toBe("R-2643-A teslim edildi, onayını bekliyor");
    expect(notificationText({ type: "icerik_duzeltme", payload: { code: "R-2643-A", note: "Sesi kısık" } })).toBe(
      "R-2643-A için düzeltme istendi: Sesi kısık",
    );
    expect(notificationText({ type: "icerik_onay", payload: { code: "R-2643-A" } })).toBe("R-2643-A onaylandı");
  });
});
