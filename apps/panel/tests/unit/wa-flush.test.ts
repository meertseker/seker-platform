import { describe, expect, it, vi } from "vitest";
import { flushOutbox, type WaOutboxRow, type WaSettings, type WaStore } from "@/lib/wa/flush";
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

function makeStore(rows: WaOutboxRow[], settings: WaSettings = { enabled: true, groupId: "123@g.us" }) {
  const ctx = emptyContext();
  ctx.actors.set("u1", "Merve");
  ctx.leads.set("L1", { parentName: "Ayşe", childName: null, phone: "05321234547", source: "referans" });
  ctx.leads.set("L2", { parentName: "Fatma", childName: null, phone: "05329998877", source: "telefon" });
  ctx.students.set("S1", { fullName: "Ali Yılmaz", parentName: "Ayşe", program: null });
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

describe("flushOutbox · ödeme grubu", () => {
  const ANA = "ana@g.us";
  const ODEME = "odeme@g.us";
  const ikiGrup: WaSettings = { enabled: true, groupId: ANA, finansGroupId: ODEME };

  /** Aynı kişinin aynı öğrencide peş peşe yaptığı kayıt + ödeme planı. */
  function kayitVePlan() {
    return [
      row("k", "2026-10-19T11:58:00.000Z", { eventType: "ogrenciye_donusturuldu", entityType: "student", entityId: "S1" }),
      row("p", "2026-10-19T11:58:20.000Z", {
        eventType: "plan_olusturuldu", entityType: "student", entityId: "S1", payload: { itemType: "aidat", totalTl: 30000, count: 10 },
      }),
    ];
  }

  it("ödeme türlerini ödeme grubuna, kayıt türlerini ana gruba gönderir", async () => {
    const store = makeStore([
      row("a", "2026-10-19T11:58:00.000Z"),
      row("o", "2026-10-19T11:58:10.000Z", { eventType: "odeme_alindi", entityType: "student", entityId: "S1", payload: { totalTl: 3500 } }),
    ], ikiGrup);
    const sender = { isReady: vi.fn(async () => true), send: vi.fn(async () => {}) };
    const result = await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
    expect(result.sent).toBe(2);
    expect(sender.send).toHaveBeenCalledWith(ANA, expect.stringContaining("*Ayşe*"));
    expect(sender.send).toHaveBeenCalledWith(ODEME, expect.stringContaining("Ödeme alındı"));
    expect(store.markSent).toHaveBeenCalledWith(["a"], expect.any(String));
    expect(store.markSent).toHaveBeenCalledWith(["o"], expect.any(String));
  });

  it("ödeme grubu seçili değilse eskisi gibi her şey ana grupta, aynı mesajda birleşir", async () => {
    for (const settings of [
      { enabled: true, groupId: ANA },
      { enabled: true, groupId: ANA, finansGroupId: "" },
    ] satisfies WaSettings[]) {
      const store = makeStore(kayitVePlan(), settings);
      const sender = { isReady: vi.fn(async () => true), send: vi.fn(async () => {}) };
      const result = await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
      expect(result.sent).toBe(1);
      expect(sender.send).toHaveBeenCalledTimes(1);
      const [chatId, text] = sender.send.mock.calls[0] as unknown as [string, string];
      expect(chatId).toBe(ANA);
      expect(text).toContain("Kayıt yapıldı");
      expect(text).toContain("Ödeme planı oluşturuldu");
      expect(store.markSent).toHaveBeenCalledWith(["k", "p"], text);
    }
  });

  it("farklı gruplara giden işlemler aynı kişiden olsa da aynı mesajda birleşmez", async () => {
    const store = makeStore(kayitVePlan(), ikiGrup);
    const sender = { isReady: vi.fn(async () => true), send: vi.fn(async () => {}) };
    const result = await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
    expect(result.sent).toBe(2);
    const calls = sender.send.mock.calls as unknown as [string, string][];
    const ana = calls.find(([id]) => id === ANA)?.[1] ?? "";
    const odeme = calls.find(([id]) => id === ODEME)?.[1] ?? "";
    expect(ana).toContain("Kayıt yapıldı");
    expect(ana).not.toContain("Ödeme planı");
    expect(odeme).toContain("Ödeme planı oluşturuldu");
    expect(odeme).not.toContain("Kayıt yapıldı");
    expect(odeme).toContain("*Ali Yılmaz*");
    expect(store.markSent).toHaveBeenCalledWith(["k"], ana);
    expect(store.markSent).toHaveBeenCalledWith(["p"], odeme);
  });

  it("aynı grupta peş peşe ödeme işlemleri tek mesajda birleşir", async () => {
    const store = makeStore([
      row("p", "2026-10-19T11:58:00.000Z", { eventType: "plan_olusturuldu", entityType: "student", entityId: "S1", payload: {} }),
      row("a", "2026-10-19T11:58:05.000Z"),
      row("o", "2026-10-19T11:58:20.000Z", { eventType: "odeme_alindi", entityType: "student", entityId: "S1", payload: {} }),
    ], ikiGrup);
    const sender = { isReady: vi.fn(async () => true), send: vi.fn(async () => {}) };
    await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
    expect(store.markSent).toHaveBeenCalledWith(["p", "o"], expect.any(String));
    expect(store.markSent).toHaveBeenCalledWith(["a"], expect.any(String));
  });

  it("bir grubun geçici hatası diğer grubun mesajlarını durdurmaz", async () => {
    const store = makeStore([
      row("o1", "2026-10-19T11:57:00.000Z", { eventType: "odeme_alindi", entityType: "student", entityId: "S1", payload: {} }),
      row("a", "2026-10-19T11:58:00.000Z"),
      row("o2", "2026-10-19T11:59:00.000Z", { eventType: "iade_kaydedildi", entityType: "student", entityId: "S2", payload: {} }),
      row("b", "2026-10-19T11:59:10.000Z", { entityId: "L2" }),
    ], ikiGrup);
    const sender = {
      isReady: vi.fn(async () => true),
      send: vi.fn(async (chatId: string) => {
        if (chatId === ODEME) throw Object.assign(new Error("WAHA 503"), { status: 503 });
      }),
    };
    const result = await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
    // Ödeme grubuna bir kez denendi; sıradaki ödeme mesajı aynı hataya sürüklenmedi.
    expect(sender.send.mock.calls.filter(([id]) => id === ODEME)).toHaveLength(1);
    expect(store.markRetry).toHaveBeenCalledWith(["o1"], "WAHA 503", 1, "2026-10-19T12:02:00.000Z");
    expect(store.claim).not.toHaveBeenCalledWith(["o2"]);
    // Ana grubun iki mesajı da gitti.
    expect(store.markSent).toHaveBeenCalledWith(["a"], expect.any(String));
    expect(store.markSent).toHaveBeenCalledWith(["b"], expect.any(String));
    expect(result).toMatchObject({ sent: 2, waiting: 2 });
  });

  it("bir grubun kalıcı hatası diğer grubu etkilemez", async () => {
    const store = makeStore([
      row("o1", "2026-10-19T11:57:00.000Z", { eventType: "odeme_alindi", entityType: "student", entityId: "S1", payload: {} }),
      row("a", "2026-10-19T11:58:00.000Z"),
    ], ikiGrup);
    const sender = {
      isReady: vi.fn(async () => true),
      send: vi.fn(async (chatId: string) => {
        if (chatId === ODEME) throw Object.assign(new Error("WAHA 404"), { status: 404 });
      }),
    };
    const result = await flushOutbox({ store, sender }, { now: NOW, sleep: noSleep });
    expect(store.markFailed).toHaveBeenCalledWith(["o1"], "WAHA 404", 1);
    expect(store.markSent).toHaveBeenCalledWith(["a"], expect.any(String));
    expect(result).toMatchObject({ sent: 1, failed: 1 });
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
