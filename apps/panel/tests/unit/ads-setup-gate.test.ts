import { describe, it, expect, vi } from "vitest";
import { executeSetupChange, type SetupChangeInput, type SetupDeps } from "@/lib/ads/setup-gate";
import type { AdChangeLogRow, AdChangeStore, GateStatus } from "@/lib/ads/writes";
import { ref, type SetupStep } from "@/lib/ads/meta/setup";

type Logged = AdChangeLogRow & { id: string };

function fakeStore(opts: { insertFails?: boolean; updateLogFails?: boolean } = {}) {
  const logs: Logged[] = [];
  const store: AdChangeStore = {
    loadObject: vi.fn(async () => null),
    weekBudgetBaselineTl: vi.fn(async () => null),
    insertLog: vi.fn(async (row: AdChangeLogRow) => {
      if (opts.insertFails) throw new Error("db");
      const id = `log-${logs.length + 1}`;
      logs.push(structuredClone({ ...row, id }));
      return id;
    }),
    updateLog: vi.fn(async (id, patch) => {
      if (opts.updateLogFails) throw new Error("db");
      const row = logs.find((l) => l.id === id);
      if (!row) return;
      row.status = patch.status;
      row.error = patch.error;
      if (patch.newValue) row.newValue = structuredClone(patch.newValue);
    }),
    updateObject: vi.fn(async () => undefined),
    updateBudgetRows: vi.fn(async () => undefined),
  };
  return { store, logs };
}

const STEPS: SetupStep[] = [
  {
    key: "creative",
    label: "Kreatif: R-2643",
    path: "act_42/adcreatives",
    params: { name: "R-2643", object_id: "111", url_tags: "utm_campaign={{campaign.id}}" },
    result: "id",
  },
  {
    key: "ad",
    label: "Reklam: R-2643 · Konu",
    path: "act_42/ads",
    params: { name: "R-2643 · Konu", adset_id: "555", creative: { creative_id: ref("creative") }, status: "PAUSED" },
    result: "id",
  },
  { key: "activate", label: "Reklamı aç", path: { ref: "ad", suffix: "" }, params: { status: "ACTIVE" }, result: "success" },
];

const CONTENT_ID = "0b6c8f8e-9d55-4c55-9d3a-2c3c4a5b6d7e";
const SUMMARY = ["Kreatif: Reels R-2643", "Reklam: R-2643 · Konu (DURAKLATILMIŞ kurulur, sonra açılır)"];

function input(over: Partial<SetupChangeInput> = {}): SetupChangeInput {
  return {
    action: "reklam_kur",
    level: "ad",
    objectId: CONTENT_ID,
    objectName: "R-2643 · Konu",
    source: "icerik",
    mode: "kur",
    oldValue: null,
    planned: { steps: STEPS, summary: SUMMARY },
    ...over,
  };
}

function deps(
  over: {
    enabled?: boolean;
    gate?: GateStatus | "throws";
    store?: AdChangeStore;
    run?: SetupDeps["run"];
  } = {},
) {
  const { store, logs } = fakeStore();
  const gate = over.gate ?? { red: false, labels: [] };
  const gateStatus = vi.fn(async () => {
    if (gate === "throws") throw new Error("db");
    return gate;
  });
  const run = vi.fn(over.run ?? (async () => ({ ok: true as const, ids: { creative: "901", ad: "902" } })));
  const d: SetupDeps = {
    store: over.store ?? store,
    actorId: "user-1",
    env: { ADS_WRITE_ENABLED: over.enabled === false ? "false" : "true", META_ACCESS_TOKEN: "META-GIZLI-ANAHTAR" },
    gateStatus,
    run,
  };
  return { d, logs, run, gateStatus, store: d.store };
}

const RED: GateStatus = { red: true, labels: ["Randevu verilen · geçen hafta"] };

describe("executeSetupChange", () => {
  it("bayrak kapalı: run çağrılmaz, kayıt uygulanmadi_kapali, new_value.steps var, summary döner", async () => {
    const { d, logs, run } = deps({ enabled: false });
    const res = await executeSetupChange(d, input());
    expect(run).not.toHaveBeenCalled();
    expect(res).toEqual({
      ok: true,
      status: "uygulanmadi_kapali",
      summary: SUMMARY,
      message: "Kaydedildi · uygulanmadı: canlı yazım kapalı",
    });
    expect(logs).toHaveLength(1);
    const row = logs[0];
    expect(row.status).toBe("uygulanmadi_kapali");
    expect(row.error).toBeNull();
    expect(row.platform).toBe("meta");
    expect(row.action).toBe("reklam_kur");
    expect(row.level).toBe("ad");
    expect(row.objectId).toBe(CONTENT_ID);
    expect(row.source).toBe("icerik");
    expect(row.actorId).toBe("user-1");
    const nv = row.newValue as Record<string, unknown>;
    expect(nv.mode).toBe("kur");
    expect(nv.summary).toEqual(SUMMARY);
    expect(nv.steps).toEqual(STEPS.map((s) => ({ key: s.key, label: s.label, path: s.path, params: s.params })));
  });

  it("bayrak açık + goster: run çağrılmaz, mesaj sadece göster", async () => {
    const { d, logs, run, gateStatus } = deps({ enabled: true });
    const res = await executeSetupChange(d, input({ mode: "goster" }));
    expect(run).not.toHaveBeenCalled();
    expect(gateStatus).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali", message: "Kaydedildi · uygulanmadı: sadece göster" });
    expect(logs[0].status).toBe("uygulanmadi_kapali");
    expect((logs[0].newValue as Record<string, unknown>).mode).toBe("goster");
  });

  it("bayrak açık + kur: önce kayıt (hata + bekleniyor), sonra run, sonra uygulandi + ids", async () => {
    const order: string[] = [];
    const { store, logs } = fakeStore();
    const insert = store.insertLog;
    store.insertLog = vi.fn(async (row: AdChangeLogRow) => {
      order.push(`insert:${row.status}:${row.error}`);
      return insert(row);
    });
    const { d, run } = deps({
      store,
      run: async () => {
        order.push("run");
        return { ok: true, ids: { creative: "901", ad: "902" } };
      },
    });
    const res = await executeSetupChange(d, input());
    expect(order).toEqual(["insert:hata:Platform yanıtı bekleniyor", "run"]);
    expect(run).toHaveBeenCalledWith(STEPS);
    expect(res).toMatchObject({ ok: true, status: "uygulandi", ids: { creative: "901", ad: "902" } });
    expect(logs[0].status).toBe("uygulandi");
    expect(logs[0].error).toBeNull();
    const nv = logs[0].newValue as Record<string, unknown>;
    expect(nv.ids).toEqual({ creative: "901", ad: "902" });
    expect(nv.steps).toBeDefined();
    expect(nv.summary).toEqual(SUMMARY);
  });

  it("kırmızı kapı reklam_kur gerekçesiz → needsReason, insertLog çağrılmaz", async () => {
    const { d, store, run } = deps({ gate: RED });
    const res = await executeSetupChange(d, input({ reason: "kısa" }));
    expect(res).toEqual({
      error: "Bir kapı kırmızı (Randevu verilen · geçen hafta). Yine de yapacaksanız nedenini yazın (en az 10 karakter).",
      needsReason: true,
    });
    expect(store.insertLog).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("kırmızı kapı reklam_kur gerekçeyle → gate_red true, reason kayda geçer", async () => {
    const { d, logs, run } = deps({ gate: RED });
    const res = await executeSetupChange(d, input({ reason: "  Okul açılış haftası, deniyoruz  " }));
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect(run).toHaveBeenCalled();
    expect(logs[0].gateRed).toBe(true);
    expect(logs[0].reason).toBe("Okul açılış haftası, deniyoruz");
  });

  it("kırmızı kapı buyutmeye_tasi gerekçesiz → needsReason", async () => {
    const { d, store } = deps({ gate: RED });
    const res = await executeSetupChange(d, input({ action: "buyutmeye_tasi", objectId: "902", source: "oneri" }));
    expect(res).toMatchObject({ needsReason: true });
    expect(store.insertLog).not.toHaveBeenCalled();
  });

  it("kapı hesaplanamazsa reklam_kur kurulamaz", async () => {
    const { d, store } = deps({ gate: "throws" });
    const res = await executeSetupChange(d, input({ reason: "yeterince uzun gerekçe" }));
    expect(res).toEqual({ error: "Bu haftanın kapıları hesaplanamadı; şimdilik kurulamaz." });
    expect(store.insertLog).not.toHaveBeenCalled();
  });

  it("kırmızı kapı kampanya_kur ve kitle_guncelle gerekçe istemez (gateStatus çağrılmaz)", async () => {
    for (const [action, level, objectId, source] of [
      ["kampanya_kur", "campaign", "kurulum", "ayarlar"],
      ["kitle_guncelle", "audience", "kitle", "cron"],
    ] as const) {
      const { d, logs, gateStatus, run } = deps({ gate: RED });
      const res = await executeSetupChange(d, input({ action, level, objectId, source }));
      expect(res).toMatchObject({ ok: true, status: "uygulandi" });
      expect(gateStatus).not.toHaveBeenCalled();
      expect(run).toHaveBeenCalled();
      expect(logs[0].gateRed).toBe(false);
      expect(logs[0].action).toBe(action);
      expect(logs[0].level).toBe(level);
    }
  });

  it("goster modunda kırmızı kapı gerekçe istemez", async () => {
    const { d, logs, gateStatus } = deps({ gate: RED });
    const res = await executeSetupChange(d, input({ mode: "goster" }));
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali" });
    expect(gateStatus).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
  });

  it("extraReasonRequired + 5 karakter → needsReason", async () => {
    const { d, store } = deps();
    const res = await executeSetupChange(
      d,
      input({ extraReasonRequired: "72 saatten önce teste alınamaz · kalan 20 saat", reason: "acele" }),
    );
    expect(res).toEqual({
      error: "72 saatten önce teste alınamaz · kalan 20 saat. Yine de yapacaksanız nedenini yazın (en az 10 karakter).",
      needsReason: true,
    });
    expect(store.insertLog).not.toHaveBeenCalled();
  });

  it("goster modunda extraReasonRequired gerekçe istemez", async () => {
    const { d, logs, run } = deps();
    const res = await executeSetupChange(d, input({ mode: "goster", extraReasonRequired: "72 saatten önce teste alınamaz" }));
    expect(res).toMatchObject({ ok: true, status: "uygulanmadi_kapali" });
    expect(run).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
  });

  it("extraReasonRequired gerekçeyle geçer; gate_red etkilenmez", async () => {
    const { d, logs } = deps();
    const res = await executeSetupChange(
      d,
      input({ extraReasonRequired: "72 saatten önce teste alınamaz · kalan 20 saat", reason: "Etkinlik yarın, bekleyemeyiz" }),
    );
    expect(res).toMatchObject({ ok: true, status: "uygulandi" });
    expect(logs[0].gateRed).toBe(false);
    expect(logs[0].reason).toBe("Etkinlik yarın, bekleyemeyiz");
  });

  it("kayıt yazılamazsa run çağrılmaz", async () => {
    const { store } = fakeStore({ insertFails: true });
    const { d, run } = deps({ store });
    const res = await executeSetupChange(d, input());
    expect(res).toEqual({ error: "Kayıt yazılamadı; değişiklik yapılmadı." });
    expect(run).not.toHaveBeenCalled();
  });

  it("kayıt yazılamazsa bayrak kapalıyken de özet dönmez", async () => {
    const { store } = fakeStore({ insertFails: true });
    const { d } = deps({ store, enabled: false });
    const res = await executeSetupChange(d, input());
    expect(res).toEqual({ error: "Kayıt yazılamadı; değişiklik yapılmadı." });
  });

  it("run yarıda patlarsa: updateLog hata + ids, hata mesajı kimlikleri yazar", async () => {
    const { d, logs } = deps({
      run: async () => ({ ok: false, ids: { creative: "901" }, failedKey: "ad", error: "Reklam: R-2643 · Konu: (#100) Invalid" }),
    });
    const res = await executeSetupChange(d, input());
    expect(res).toEqual({
      error:
        "Uygulanamadı: Reklam: R-2643 · Konu: (#100) Invalid · kayda geçti · Yarım kalan nesneler (hepsi DURAKLATILMIŞ): 901",
      ids: { creative: "901" },
    });
    expect(logs[0].status).toBe("hata");
    expect(logs[0].error).toBe("Reklam: R-2643 · Konu: (#100) Invalid");
    const nv = logs[0].newValue as Record<string, unknown>;
    expect(nv.ids).toEqual({ creative: "901" });
    expect(nv.failedKey).toBe("ad");
    expect(nv.summary).toEqual(SUMMARY);
  });

  it("ilk adımda patlarsa yarım kalan nesne satırı yok", async () => {
    const { d } = deps({ run: async () => ({ ok: false, ids: {}, failedKey: "creative", error: "Kreatif: hata" }) });
    const res = await executeSetupChange(d, input());
    expect(res).toEqual({ error: "Uygulanamadı: Kreatif: hata · kayda geçti", ids: {} });
  });

  it("run atarsa genel metin, anahtar sızmaz, kayıt hata", async () => {
    const { d, logs } = deps({
      run: async () => {
        throw new Error("boom META-GIZLI-ANAHTAR");
      },
    });
    const res = await executeSetupChange(d, input());
    expect("error" in res && res.error).toBe("Uygulanamadı: Platform isteği başarısız (Error) · kayda geçti");
    expect(JSON.stringify(res)).not.toContain("META-GIZLI-ANAHTAR");
    expect(JSON.stringify(logs)).not.toContain("META-GIZLI-ANAHTAR");
    expect(logs[0].status).toBe("hata");
  });

  it("run hatası metnindeki anahtar kayda ve ekrana gizlenerek geçer", async () => {
    const { d, logs } = deps({
      run: async () => ({ ok: false, ids: {}, failedKey: "creative", error: "x access_token=META-GIZLI-ANAHTAR" }),
    });
    const res = await executeSetupChange(d, input());
    expect(JSON.stringify(res)).not.toContain("META-GIZLI-ANAHTAR");
    expect(JSON.stringify(logs)).not.toContain("META-GIZLI-ANAHTAR");
  });

  it("uygulandı ama kayıt güncellenemezse başarı + kimlikler, mesajda kayıt güncellenemedi", async () => {
    const { store } = fakeStore({ updateLogFails: true });
    const { d } = deps({ store });
    const res = await executeSetupChange(d, input());
    expect(res).toMatchObject({ ok: true, status: "uygulandi", ids: { creative: "901", ad: "902" } });
    expect("message" in res && res.message).toContain("· kayıt güncellenemedi");
  });

  it("logSteps false iken new_value.steps yok", async () => {
    const { d, logs } = deps({ enabled: false });
    await executeSetupChange(
      d,
      input({
        action: "kitle_guncelle",
        level: "audience",
        objectId: "kitle",
        source: "cron",
        logSteps: false,
        logExtra: { count: 120 },
      }),
    );
    const nv = logs[0].newValue as Record<string, unknown>;
    expect(nv).not.toHaveProperty("steps");
    expect(nv.count).toBe(120);
    expect(nv.summary).toBeDefined();
  });

  it("logSteps false iken uygulandıktan sonra da steps yazılmaz", async () => {
    const { d, logs } = deps();
    await executeSetupChange(
      d,
      input({ action: "kitle_guncelle", level: "audience", objectId: "kitle", source: "cron", logSteps: false }),
    );
    expect(logs[0].status).toBe("uygulandi");
    expect(logs[0].newValue).not.toHaveProperty("steps");
  });

  it("kayıtta access_token / appsecret_proof anahtarı yok", async () => {
    const { d, logs, store } = deps();
    await executeSetupChange(d, input());
    const all = JSON.stringify([logs, vi.mocked(store.insertLog).mock.calls, vi.mocked(store.updateLog).mock.calls]);
    expect(all).not.toContain("access_token");
    expect(all).not.toContain("appsecret_proof");
    expect(all).not.toContain("META-GIZLI-ANAHTAR");
  });

  it("geçersiz girdi: kayıt yok", async () => {
    const cases: Partial<SetupChangeInput>[] = [
      { action: "pause" as never },
      { level: "campaign" },
      { mode: "x" as never },
      { source: "baska" as never },
      { objectId: "" },
      { recommendationId: "abc" },
      { planned: { steps: [], summary: [] } },
    ];
    for (const c of cases) {
      const { d, store } = deps();
      const res = await executeSetupChange(d, input(c));
      expect(res).toHaveProperty("error");
      expect(store.insertLog).not.toHaveBeenCalled();
    }
  });

  it("logExtra çekirdek alanları ezemez (mode, summary, steps, ids; satırın status/action'ı)", async () => {
    const extra = {
      mode: "sahte",
      summary: ["sahte"],
      steps: [],
      ids: { x: "1" },
      status: "uygulandi",
      action: "sablon",
      count: 3,
    };
    const closed = deps({ enabled: false });
    await executeSetupChange(closed.d, input({ logExtra: extra }));
    const row = closed.logs[0];
    expect(row.status).toBe("uygulanmadi_kapali");
    expect(row.action).toBe("reklam_kur");
    const nv = row.newValue as Record<string, unknown>;
    expect(nv.mode).toBe("kur");
    expect(nv.summary).toEqual(SUMMARY);
    expect((nv.steps as unknown[]).length).toBe(STEPS.length);
    expect(nv.count).toBe(3);

    const live = deps();
    await executeSetupChange(live.d, input({ logExtra: extra }));
    const applied = live.logs[0];
    expect(applied.status).toBe("uygulandi");
    expect(applied.action).toBe("reklam_kur");
    const anv = applied.newValue as Record<string, unknown>;
    expect(anv.mode).toBe("kur");
    expect(anv.summary).toEqual(SUMMARY);
    expect((anv.steps as unknown[]).length).toBe(STEPS.length);
    expect(anv.ids).toEqual({ creative: "901", ad: "902" });
  });

  it("recommendationId kayda geçer", async () => {
    const { d, logs } = deps();
    await executeSetupChange(d, input({ recommendationId: CONTENT_ID, source: "oneri" }));
    expect(logs[0].recommendationId).toBe(CONTENT_ID);
  });
});
