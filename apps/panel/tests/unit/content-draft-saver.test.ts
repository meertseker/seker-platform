import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftSaver, type DraftPatch, type SaveState } from "@/lib/content/draft-saver";
import { OFFLINE_SAVE_MESSAGE, mergeDraft } from "@/lib/content/task-flow";

type Reply = { ok: true } | { error: string } | "throw";

/** Her save çağrısı elle çözülen bir söz döner; testler sırayı ve eşzamanlılığı denetler. */
function harness() {
  const calls: { patch: DraftPatch; resolve: (r: Reply) => void }[] = [];
  let active = 0;
  let maxActive = 0;
  const states: SaveState[] = [];
  const save = vi.fn(
    (patch: DraftPatch) =>
      new Promise<{ ok: true } | { error: string }>((resolve, reject) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        calls.push({
          patch,
          resolve: (r) => {
            active -= 1;
            if (r === "throw") reject(new TypeError("Failed to fetch"));
            else resolve(r);
          },
        });
      }),
  );
  const saver = createDraftSaver({ save, delayMs: 1000, onState: (s) => states.push(s) });
  return { saver, save, calls, states, maxActive: () => maxActive };
}

// Zamanlayıcılar sahte; yalnız bekleyen söz zincirleri ilerletilir.
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe("createDraftSaver", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
  afterEach(() => vi.useRealTimers());

  it("yazıyı bekletip tek kayıtta gönderir", async () => {
    const h = harness();
    h.saver.queue({ caption: "a" });
    h.saver.queue({ caption: "ab" });
    expect(h.save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.calls[0].patch).toEqual({ caption: "ab" });
  });

  it("teslimden önce süren kaydı bekler, sonra bekleyeni kaydeder; kayıtlar üst üste binmez", async () => {
    const h = harness();
    h.saver.queue({ caption: "eski" });
    vi.advanceTimersByTime(1000); // "eski" yolda
    h.saver.queue({ caption: "yeni" });
    const flushed = h.saver.flush();
    await tick();
    expect(h.save).toHaveBeenCalledTimes(1);
    h.calls[0].resolve({ ok: true });
    await tick();
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(h.calls[1].patch).toEqual({ caption: "yeni" });
    h.calls[1].resolve({ ok: true });
    expect(await flushed).toEqual({ ok: true });
    expect(h.maxActive()).toBe(1);
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("süren kayıt başarısız olursa teslim durur ve sunucunun mesajı döner", async () => {
    const h = harness();
    h.saver.queue({ caption: "eski" });
    vi.advanceTimersByTime(1000);
    const flushed = h.saver.flush();
    h.calls[0].resolve({ error: "Bu içerik şu an değiştirilemez" });
    expect(await flushed).toEqual({ ok: false, error: "Bu içerik şu an değiştirilemez" });
    expect(h.save).toHaveBeenCalledTimes(1);
    // Kaydedilemeyen yazı kaybolmaz.
    expect(h.saver.hasUnsaved()).toBe(true);
    expect(h.states.at(-1)).toEqual({ state: "error", error: "Bu içerik şu an değiştirilemez" });
  });

  it("bağlantı yoksa çevrimdışı mesajı döner", async () => {
    const h = harness();
    h.saver.queue({ caption: "x" });
    const flushed = h.saver.flush();
    await tick();
    h.calls[0].resolve("throw");
    expect(await flushed).toEqual({ ok: false, error: OFFLINE_SAVE_MESSAGE });
  });

  it("yüz cevabı aynı sıradan gider, bekleyen yazıyla birlikte kaydedilir", async () => {
    const h = harness();
    h.saver.queue({ caption: "metin" });
    h.saver.queue({ faceAnswer: false });
    const flushed = h.saver.flush();
    await tick();
    expect(h.calls[0].patch).toEqual({ caption: "metin", faceAnswer: false });
    h.calls[0].resolve({ ok: true });
    expect(await flushed).toEqual({ ok: true });
  });

  it("başarısız kayıt bağlantı gelince yeniden denenir; arada yazılan daha yeni yazı üstün gelir", async () => {
    const h = harness();
    h.saver.queue({ caption: "a", pageFields: { baslik: "x" } });
    vi.advanceTimersByTime(1000);
    h.calls[0].resolve("throw");
    await tick();
    h.saver.queue({ caption: "b" });
    h.saver.retry();
    await tick();
    expect(h.calls[1].patch).toEqual({ caption: "b", pageFields: { baslik: "x" } });
    h.calls[1].resolve({ ok: true });
    await tick();
    expect(h.saver.hasUnsaved()).toBe(false);
    expect(h.states.at(-1)).toEqual({ state: "saved", error: null });
  });

  it("bekleyen ya da yoldaki kayıt varken kaydedilmemiş sayılır", async () => {
    const h = harness();
    expect(h.saver.hasUnsaved()).toBe(false);
    h.saver.queue({ caption: "a" });
    expect(h.saver.hasUnsaved()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(h.saver.hasUnsaved()).toBe(true);
    h.calls[0].resolve({ ok: true });
    await tick();
    expect(h.saver.hasUnsaved()).toBe(false);
  });

  it("yeni video gelince kaydedilemeyen eski yüz cevabı yeniden gönderilmez", async () => {
    const h = harness();
    h.saver.queue({ caption: "metin", faceAnswer: false });
    const first = h.saver.flush();
    await tick();
    h.calls[0].resolve("throw");
    await first;
    h.saver.drop("faceAnswer");
    h.saver.retry();
    await tick();
    expect(h.calls[1].patch).toEqual({ caption: "metin" });
  });

  it("bekleyen yoksa flush sunucuya gitmez", async () => {
    const h = harness();
    expect(await h.saver.flush()).toEqual({ ok: true });
    expect(h.save).not.toHaveBeenCalled();
  });
});

describe("mergeDraft", () => {
  const server = {
    caption: "sunucu",
    pageFields: { baslik: "s" },
    mediaPath: "a/b/v.mp4",
    mediaMeta: null,
    faceAnswer: false as boolean | null,
  };

  it("yerelde değişmeyen alanlar sunucudan gelir", () => {
    expect(mergeDraft(server, undefined)).toEqual(server);
    expect(mergeDraft({ ...server, faceAnswer: null }, { caption: "yerel" })).toEqual({
      ...server,
      caption: "yerel",
      faceAnswer: null,
    });
  });

  it("yerelde değişen alan sekme değişse de korunur, sunucunun eski değeri üstüne yazmaz", () => {
    expect(mergeDraft(server, { caption: "yeni yazı", faceAnswer: null })).toMatchObject({
      caption: "yeni yazı",
      faceAnswer: null,
    });
  });
});
