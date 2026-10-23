import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { actionText, changeLine, latestByKey, statusText, whenText, type ChangeLogEntry } from "@/lib/ads/change-log";
import { loadChangeLog, loadProfileNames } from "@/lib/queries/change-log";

// 12 Kasım 2026 13:00 İstanbul.
const NOW = new Date("2026-11-12T10:00:00Z");

function entry(over: Partial<ChangeLogEntry> = {}): ChangeLogEntry {
  return {
    id: "log-1",
    createdAt: "2026-11-10T05:14:00Z", // 10 Kasım 08:14 İstanbul
    platform: "meta",
    level: "ad",
    objectId: "120000000001",
    objectName: "S-2644-I",
    action: "pause",
    oldValue: { status: "ACTIVE" },
    newValue: { status: "PAUSED" },
    reason: null,
    status: "uygulandi",
    source: "kampanyalar",
    recommendationId: null,
    actorId: "u-zehra",
    ...over,
  };
}

describe("tasarımdaki örnek satırlar", () => {
  it("Z5: durdurma satırı gerekçeyle", () => {
    const e = entry({ reason: "3 kat harcadı, nitelikli yok" });
    expect(changeLine(e, "Zehra Gürsel", NOW)).toBe(
      '✓ Uygulandı · S-2644-I durduruldu · Zehra Gürsel · 10 Kasım 08:14 · gerekçe: "3 kat harcadı, nitelikli yok"',
    );
  });

  it("Z5: öneriden gelen satır panel önerisi ile biter", () => {
    const e = entry({ reason: "3 kat harcadı, nitelikli yok", source: "oneri", recommendationId: "rec-1" });
    expect(changeLine(e, "Zehra Gürsel", NOW)).toBe(
      '✓ Uygulandı · S-2644-I durduruldu · Zehra Gürsel · 10 Kasım 08:14 · gerekçe: "3 kat harcadı, nitelikli yok" · panel önerisi',
    );
  });

  it("M2: bütçe satırı (Büyütme · Instagram bütçesi 400 → 480 TL)", () => {
    const e = entry({
      action: "budget",
      level: "campaign",
      objectName: "Büyütme · Instagram",
      oldValue: { daily_budget_tl: 400, budget_resource: "1" },
      newValue: { daily_budget_tl: 480, budget_resource: "1" },
    });
    expect(actionText(e)).toBe("Büyütme · Instagram bütçesi 400 → 480 TL");
  });

  it("M2: Büyütme'ye taşıma satırı", () => {
    const e = entry({
      action: "buyutmeye_tasi",
      objectName: "R-2644-A · Bahçe oyunu",
      newValue: { mode: "kur", contentCode: "R-2644-A" },
    });
    expect(actionText(e)).toBe("R-2644-A Büyütme'ye taşındı · Test'teki reklam durdu");
  });

  it("gerekçesiz satırda son parça yok; bugün yazılır", () => {
    const e = entry({ createdAt: "2026-11-12T05:14:00Z" });
    expect(changeLine(e, "Zehra Gürsel", NOW)).toBe("✓ Uygulandı · S-2644-I durduruldu · Zehra Gürsel · bugün 08:14");
  });

  it("öneriden gelen gerekçesiz satır", () => {
    const e = entry({ source: "oneri" });
    expect(changeLine(e, "Zehra Gürsel", NOW)).toBe("✓ Uygulandı · S-2644-I durduruldu · Zehra Gürsel · 10 Kasım 08:14 · panel önerisi");
  });
});

describe("actionText", () => {
  it("tüm eylemler", () => {
    expect(actionText(entry({ action: "resume" }))).toBe("S-2644-I yeniden başlatıldı");
    expect(
      actionText(
        entry({
          action: "budget",
          objectName: "Test · Instagram",
          oldValue: { daily_budget_tl: 1000 },
          newValue: { daily_budget_tl: 1200 },
        }),
      ),
    ).toBe("Test · Instagram bütçesi 1.000 → 1.200 TL");
    expect(
      actionText(entry({ action: "budget", oldValue: { daily_budget_tl: null }, newValue: { daily_budget_tl: 150.5 } })),
    ).toBe("S-2644-I bütçesi ? → 150,50 TL");
    expect(
      actionText(
        entry({ action: "reklam_kur", objectId: "c-uuid", objectName: "R-2645-B · Konu", newValue: { contentCode: "R-2645-B" } }),
      ),
    ).toBe("R-2645-B reklamı kuruldu · Test · Instagram");
    expect(actionText(entry({ action: "reklam_kur", objectName: "R-2645-B · Konu", newValue: { mode: "kur" } }))).toBe(
      "R-2645-B reklamı kuruldu · Test · Instagram",
    );
    expect(actionText(entry({ action: "kampanya_kur", objectId: "kurulum", newValue: {} }))).toBe(
      "Test ve Büyütme kampanyaları kuruldu",
    );
    expect(actionText(entry({ action: "kitle_guncelle", objectId: "kitle", newValue: { count: 1234, skipped: 2 } }))).toBe(
      "Mevcut veli kitlesi güncellendi (1.234 telefon)",
    );
    expect(actionText(entry({ action: "ig_yayin", objectName: "R-2645-B", newValue: { contentCode: "R-2645-C" } }))).toBe(
      "R-2645-C Instagram'da yayınlandı",
    );
    expect(actionText(entry({ action: "ig_yayin", objectName: "R-2645-B", newValue: null }))).toBe(
      "R-2645-B Instagram'da yayınlandı",
    );
    expect(actionText(entry({ action: "sablon", objectId: "reklam_sablonu", newValue: {} }))).toBe(
      "Reklam şablonu güncellendi",
    );
  });

  it("kurulum eylemlerinde fiil duruma uyar (uygulandı / sadece göster / hata)", () => {
    const at = (action: ChangeLogEntry["action"], status: ChangeLogEntry["status"], newValue: Record<string, unknown> = {}) =>
      actionText(entry({ action, status, objectName: "R-2645-B · Konu", newValue: { contentCode: "R-2645-B", ...newValue } }));
    expect(at("reklam_kur", "uygulandi")).toBe("R-2645-B reklamı kuruldu · Test · Instagram");
    expect(at("reklam_kur", "uygulanmadi_kapali")).toBe("R-2645-B reklamı kurulacaktı · Test · Instagram");
    expect(at("reklam_kur", "hata")).toBe("R-2645-B reklamı kurulamadı · Test · Instagram");
    expect(at("buyutmeye_tasi", "uygulandi")).toBe("R-2645-B Büyütme'ye taşındı · Test'teki reklam durdu");
    expect(at("buyutmeye_tasi", "uygulanmadi_kapali")).toBe("R-2645-B Büyütme'ye taşınacaktı · Test'teki reklam duracaktı");
    expect(at("buyutmeye_tasi", "hata")).toBe("R-2645-B Büyütme'ye taşınamadı");
    expect(at("kampanya_kur", "uygulandi")).toBe("Test ve Büyütme kampanyaları kuruldu");
    expect(at("kampanya_kur", "uygulanmadi_kapali")).toBe("Test ve Büyütme kampanyaları kurulacaktı");
    expect(at("kampanya_kur", "hata")).toBe("Test ve Büyütme kampanyaları kurulamadı");
    expect(at("kitle_guncelle", "uygulandi", { count: 12 })).toBe("Mevcut veli kitlesi güncellendi (12 telefon)");
    expect(at("kitle_guncelle", "uygulanmadi_kapali", { count: 12 })).toBe("Mevcut veli kitlesi güncellenecekti (12 telefon)");
    expect(at("kitle_guncelle", "hata", { count: 12 })).toBe("Mevcut veli kitlesi güncellenemedi (12 telefon)");
    expect(at("sablon", "uygulandi")).toBe("Reklam şablonu güncellendi");
    expect(at("sablon", "uygulanmadi_kapali")).toBe("Reklam şablonu güncellenecekti");
    expect(at("sablon", "hata")).toBe("Reklam şablonu güncellenemedi");
  });

  it("sadece göster satırı: 'kuruldu' demez", () => {
    const e = entry({ action: "reklam_kur", status: "uygulanmadi_kapali", objectName: "R-2644-A · Konu", newValue: { mode: "goster" } });
    expect(changeLine(e, "Zehra Gürsel", NOW)).toBe(
      "Kaydedildi · uygulanmadı · R-2644-A reklamı kurulacaktı · Test · Instagram · Zehra Gürsel · 10 Kasım 08:14",
    );
  });
});

describe("statusText ve önekler", () => {
  it("üç durum", () => {
    expect(statusText("uygulandi")).toBe("✓ Uygulandı");
    expect(statusText("uygulanmadi_kapali")).toBe("Kaydedildi · uygulanmadı");
    expect(statusText("hata")).toBe("Hata");
  });
  it("uygulanmadi_kapali öneki", () => {
    const e = entry({ status: "uygulanmadi_kapali" });
    expect(changeLine(e, "Mehtap Şeker", NOW)).toBe(
      "Kaydedildi · uygulanmadı · S-2644-I durduruldu · Mehtap Şeker · 10 Kasım 08:14",
    );
  });
});

describe("whenText İstanbul gece yarısı", () => {
  const now = new Date("2026-11-12T05:00:00Z"); // 12 Kasım 08:00 İstanbul
  it("İstanbul'da bugün 00:30 (UTC'de dün) → bugün", () => {
    expect(whenText("2026-11-11T21:30:00Z", now)).toBe("bugün 00:30");
  });
  it("İstanbul'da dün 23:59 → tarih", () => {
    expect(whenText("2026-11-11T20:59:00Z", now)).toBe("11 Kasım 23:59");
  });
  it("tek haneli gün ve ay adı", () => {
    expect(whenText("2026-01-03T06:05:00Z", now)).toBe("3 Ocak 09:05");
  });
});

describe("latestByKey", () => {
  const older = entry({
    id: "a",
    createdAt: "2026-11-10T05:00:00Z",
    action: "reklam_kur",
    objectId: "content-uuid",
    newValue: { contentCode: "R-2645-B" },
  });
  const newer = entry({
    id: "b",
    createdAt: "2026-11-11T05:00:00Z",
    action: "reklam_kur",
    objectId: "content-uuid",
    newValue: { contentCode: "R-2645-B", adId: "120000000777", ids: { creative: "9", ad: "120000000777" } },
    recommendationId: "rec-9",
  });
  it("reklam kimliği, içerik kodu, nesne ve öneri ile en yeni kaydı bulur (sıradan bağımsız)", () => {
    const m = latestByKey([newer, older]);
    expect(m.get("120000000777")?.id).toBe("b");
    expect(m.get("R-2645-B")?.id).toBe("b");
    expect(m.get("content-uuid")?.id).toBe("b");
    expect(m.get("rec-9")?.id).toBe("b");
    expect(latestByKey([older, newer]).get("R-2645-B")?.id).toBe("b");
  });
  it("kurulum kimlikleri (ids.ad) de anahtar olur", () => {
    const e = entry({ id: "c", action: "reklam_kur", objectId: "x", newValue: { ids: { ad: "555" } } });
    expect(latestByKey([e]).get("555")?.id).toBe("c");
  });
});

type Call = { table: string; ops: [string, unknown[]][] };

function fakeDb(rows: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const op of ["select", "gte", "lt", "order", "limit", "in"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push([op, args]);
          return builder;
        };
      }
      builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows[table] ?? [], error: null });
      return builder;
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

describe("sorgular", () => {
  it("loadChangeLog satırı eşler, aralık ve sınır uygular", async () => {
    const { db, calls } = fakeDb({
      ad_change_log: [
        {
          id: "l1",
          created_at: "2026-11-10T05:14:00Z",
          platform: "meta",
          level: "ad",
          object_id: "1",
          object_name: "S-2644-I",
          action: "pause",
          old_value: { status: "ACTIVE" },
          new_value: { status: "PAUSED" },
          reason: null,
          status: "uygulandi",
          source: "oneri",
          recommendation_id: "r1",
          actor_id: "u1",
        },
      ],
    });
    const out = await loadChangeLog(db, "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z", 50);
    expect(out).toEqual([entry({ id: "l1", objectId: "1", source: "oneri", recommendationId: "r1", actorId: "u1" })]);
    const ops = calls[0].ops;
    expect(calls[0].table).toBe("ad_change_log");
    expect(ops).toContainEqual(["gte", ["created_at", "2026-11-01T00:00:00Z"]]);
    expect(ops).toContainEqual(["lt", ["created_at", "2026-12-01T00:00:00Z"]]);
    expect(ops).toContainEqual(["limit", [50]]);
  });

  it("loadProfileNames full_name döner; boş listede sorgu yok", async () => {
    const { db, calls } = fakeDb({ profiles: [{ id: "u1", full_name: "Zehra Gürsel" }] });
    expect(await loadProfileNames(db, [])).toEqual(new Map());
    expect(calls).toHaveLength(0);
    const m = await loadProfileNames(db, ["u1", "u1"]);
    expect(m.get("u1")).toBe("Zehra Gürsel");
    expect(calls[0].ops).toContainEqual(["in", ["id", ["u1"]]]);
  });
});
