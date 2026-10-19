import { describe, expect, it, vi } from "vitest";
import { flushOutbox, type WaOutboxRow, type WaStore } from "@/lib/wa/flush";
import { emptyContext } from "@/lib/wa/format";
import { parseGroups } from "@/lib/wa/waha";

const NOW = new Date("2026-10-19T12:00:00.000Z");

function row(id: string, createdAt: string, overrides: Partial<NonNullable<WaOutboxRow["item"]>> = {}): WaOutboxRow {
  return {
    id,
    attempts: 0,
    createdAt,
    item: {
      outboxId: id,
      eventType: "lead_olusturuldu",
      entityType: "lead",
      entityId: "L1",
      actorId: "u1",
      payload: {},
      createdAt,
      ...overrides,
    },
  };
}

function makeStore(rows: WaOutboxRow[], settings = { enabled: true, groupId: "123@g.us" }) {
  const ctx = emptyContext();
  ctx.actors.set("u1", "Merve");
  ctx.leads.set("L1", { parentName: "Ayşe", childName: null, phone: "05321234547", source: "referans" });
  ctx.leads.set("L2", { parentName: "Fatma", childName: null, phone: "05329998877", source: "telefon" });
  const store = {
    settings: vi.fn(async () => settings),
    releaseStale: vi.fn(async () => {}),
    listPending: vi.fn(async () => rows),
    loadContext: vi.fn(async () => ctx),
    claim: vi.fn(async (ids: string[]) => ids),
    markSent: vi.fn(async () => {}),
    markRetry: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    markSkipped: vi.fn(async () => {}),
  } satisfies WaStore;
  return store;
}

const noSleep = async () => {};

describe("flushOutbox", () => {
  it("kapalıyken hiçbir şey okumaz", async () => {
    const store = makeStore([], { enabled: false, groupId: "123@g.us" });
    const sender = { isReady: vi.fn(), send: vi.fn() };
    const result = await flushOutbox({ store, sender }, { now: NOW });
    expect(result.disabled).toBe(true);
    expect(store.listPending).not.toHaveBeenCalled();
  });

  it("yerleşmiş grupları gönderir, yeni işlemleri bekletir", async () => {
    const store = makeStore([
      row("a", "2026-10-19T11:59:00.000Z"),
      row("b", "2026-10-19T11:59:55.000Z", { entityId: "L2" }),
    ]);
    const sender = { isReady: vi.fn(async () => true), send: vi.fn(async () => {}) };
    const result = await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
    expect(result).toMatchObject({ sent: 1, waiting: 1 });
    expect(sender.send).toHaveBeenCalledWith("123@g.us", expect.stringContaining("*Ayşe*"));
    expect(store.markSent).toHaveBeenCalledWith(["a"], expect.any(String));
  });

  it("kaynaksız ve 24 saatten eski satırları atlar", async () => {
    const store = makeStore([
      { id: "x", attempts: 0, createdAt: "2026-10-19T11:00:00.000Z", item: null },
      row("old", "2026-10-17T11:00:00.000Z"),
    ]);
    const sender = { isReady: vi.fn(async () => true), send: vi.fn() };
    const result = await flushOutbox({ store, sender }, { now: NOW });
    expect(result.skipped).toBe(2);
    expect(store.markSkipped).toHaveBeenCalledWith(["x"], expect.any(String));
    expect(store.markSkipped).toHaveBeenCalledWith(["old"], expect.any(String));
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("bağlantı yoksa satırlara dokunmadan bildirir", async () => {
    const store = makeStore([row("a", "2026-10-19T11:59:00.000Z")]);
    const sender = { isReady: vi.fn(async () => false), send: vi.fn() };
    const result = await flushOutbox({ store, sender }, { now: NOW });
    expect(result.notReady).toBe(true);
    expect(store.claim).not.toHaveBeenCalled();
  });

  it("geçici hatada geri çekilerek yeniden dener ve sıradakileri göndermez", async () => {
    const store = makeStore([
      row("a", "2026-10-19T11:58:00.000Z"),
      row("b", "2026-10-19T11:58:30.000Z", { entityId: "L2" }),
    ]);
    const sender = {
      isReady: vi.fn(async () => true),
      send: vi.fn(async () => {
        throw Object.assign(new Error("WAHA 503"), { status: 503 });
      }),
    };
    await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(store.markRetry).toHaveBeenCalledWith(["a"], "WAHA 503", 1, "2026-10-19T12:02:00.000Z");
  });

  it("kalıcı hatada satırı 'hata' yapar", async () => {
    const store = makeStore([row("a", "2026-10-19T11:58:00.000Z")]);
    const sender = {
      isReady: vi.fn(async () => true),
      send: vi.fn(async () => {
        throw Object.assign(new Error("WAHA 404"), { status: 404 });
      }),
    };
    const result = await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
    expect(result.failed).toBe(1);
    expect(store.markFailed).toHaveBeenCalledWith(["a"], "WAHA 404", 1);
  });

  it("başka bir koşu kilitlediyse göndermez", async () => {
    const store = makeStore([row("a", "2026-10-19T11:58:00.000Z")]);
    store.claim.mockResolvedValueOnce([]);
    const sender = { isReady: vi.fn(async () => true), send: vi.fn() };
    await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
    expect(sender.send).not.toHaveBeenCalled();
  });
});

describe("parseGroups", () => {
  it("dizi ve sözlük biçimlerini okur, grup olmayanları eler", () => {
    expect(
      parseGroups([
        { id: "111@g.us", subject: "Şeker Ekip" },
        { id: { _serialized: "222@g.us" }, name: "Aileler" },
        { id: "905321234567@c.us", name: "Kişi" },
      ]),
    ).toEqual([
      { id: "222@g.us", name: "Aileler" },
      { id: "111@g.us", name: "Şeker Ekip" },
    ]);
    expect(parseGroups({ "333@g.us": { JID: "333@g.us", Name: "Muhasebe" } })).toEqual([{ id: "333@g.us", name: "Muhasebe" }]);
  });
});
