import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

// 0026: ad_change_log yeni eylem/kaynak check'leri, ad_objects inceleme kolonları, şablon tohumları.
const YON_ID = "00000000-0000-0000-0000-000000000001";
const TEST_OBJ = "reklam-kurulum-rls-test";

let dan: SupabaseClient, ogr: SupabaseClient;

async function cleanup() {
  await admin.from("ad_change_log").delete().eq("object_id", TEST_OBJ);
  await admin.from("ad_objects").delete().eq("object_id", TEST_OBJ);
}

function logRow(over: Record<string, unknown>) {
  return {
    platform: "meta", level: "ad", object_id: TEST_OBJ, action: "reklam_kur",
    source: "icerik", status: "uygulanmadi_kapali", actor_id: YON_ID, ...over,
  };
}

beforeAll(async () => {
  dan = await clientFor("danisman@test.local");
  ogr = await clientFor("ogretmen@test.local");
  await cleanup();
});

afterAll(cleanup);

describe("ad_change_log check'leri (0026)", () => {
  it("ad_change_log yeni eylem ve kaynakları kabul eder", async () => {
    const rows = [
      logRow({ action: "reklam_kur", source: "icerik", level: "ad" }),
      logRow({ action: "kampanya_kur", source: "ayarlar", level: "campaign" }),
      logRow({ action: "kitle_guncelle", source: "cron", level: "audience" }),
      logRow({ action: "ig_yayin", source: "icerik", level: "icerik" }),
      logRow({ action: "buyutmeye_tasi", source: "oneri", level: "ad" }),
      logRow({ action: "sablon", source: "ayarlar", level: "ayarlar", status: "uygulandi" }),
    ];
    for (const r of rows) {
      const { error } = await admin.from("ad_change_log").insert(r);
      expect(error, `${r.action}/${r.source}`).toBeNull();
    }
  });

  it("bilinmeyen eylem ve kaynak reddedilir", async () => {
    const a = await admin.from("ad_change_log").insert(logRow({ action: "sil" }));
    expect(a.error?.code).toBe("23514");
    const s = await admin.from("ad_change_log").insert(logRow({ source: "web" }));
    expect(s.error?.code).toBe("23514");
  });

  it("eski eylemler hâlâ geçer", async () => {
    const p = await admin.from("ad_change_log").insert(logRow({ action: "pause", source: "kampanyalar", level: "campaign" }));
    expect(p.error).toBeNull();
    const b = await admin.from("ad_change_log").insert(logRow({ action: "budget", source: "oneri", level: "campaign" }));
    expect(b.error).toBeNull();
  });

  it("danışman ve öğretmen ad_change_log okuyamaz", async () => {
    for (const c of [dan, ogr]) {
      const { data } = await c.from("ad_change_log").select("id").eq("object_id", TEST_OBJ);
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("ad_objects inceleme kolonları (0026)", () => {
  it("ad_objects inceleme kolonları yazılır", async () => {
    const { error } = await admin.from("ad_objects").insert({
      platform: "meta", level: "ad", object_id: TEST_OBJ, name: "Test",
      effective_status: "DISAPPROVED", review_feedback: "Metin politikaya aykırı",
    });
    expect(error).toBeNull();
    const { data } = await admin.from("ad_objects").select("effective_status, review_feedback")
      .eq("object_id", TEST_OBJ).single();
    expect(data).toEqual({ effective_status: "DISAPPROVED", review_feedback: "Metin politikaya aykırı" });
  });
});

describe("tohumlar (0026)", () => {
  it("şablon ve kurulum tohumları var", async () => {
    const { data } = await admin.from("app_settings").select("key, value")
      .in("key", ["reklam_sablonu", "reklam_kurulum"]);
    const sablon = data?.find((r) => r.key === "reklam_sablonu")?.value as Record<string, unknown> | undefined;
    const kurulum = data?.find((r) => r.key === "reklam_kurulum")?.value;
    expect(sablon?.yaricapKm).toBe(8);
    expect(sablon?.testGunlukTl).toBe(200);
    expect(sablon?.haftalikYeniReklam).toBe(4);
    expect(kurulum).toEqual({});
  });
});
