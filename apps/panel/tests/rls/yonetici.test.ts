import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

// Yönetici ekranı tabloları (0018): okuma yalnız yönetici, yazma yalnız service_role.
const YON_ID = "00000000-0000-0000-0000-000000000001";
const WEEK = "2026-10-12"; // Pazartesi
const TEST_OBJ = "yonetici-rls-test";

let yon: SupabaseClient, dan: SupabaseClient, ogr: SupabaseClient;

async function cleanup() {
  await admin.from("ad_change_log").delete().eq("object_id", TEST_OBJ);
  await admin.from("ad_recommendations").delete().eq("object_key", TEST_OBJ);
  await admin.from("ad_content_links").delete().eq("ad_id", TEST_OBJ);
  await admin.from("ad_objects").delete().eq("object_id", TEST_OBJ);
  await admin.from("weekly_reviews").delete().eq("week_start", WEEK);
}

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
  ogr = await clientFor("ogretmen@test.local");
  await cleanup();

  const rows = await Promise.all([
    admin.from("ad_objects").insert({ platform: "google", level: "campaign", object_id: TEST_OBJ, name: "Test" }),
    admin.from("ad_content_links").insert({ platform: "google", ad_id: TEST_OBJ, content_code: "R-2642-A" }),
    admin.from("ad_change_log").insert({
      platform: "google", level: "campaign", object_id: TEST_OBJ, action: "pause",
      source: "kampanyalar", status: "uygulanmadi_kapali", actor_id: YON_ID,
    }),
    admin.from("ad_recommendations").insert({
      week_start: WEEK, rule_key: "durdur", object_key: TEST_OBJ, title: "t", why: "w",
    }),
    admin.from("weekly_reviews").insert({ week_start: WEEK, topic: "t" }),
  ]);
  for (const r of rows) if (r.error) throw r.error;
});

afterAll(cleanup);

const TABLES = ["ad_objects", "ad_content_links", "ad_change_log", "ad_recommendations", "weekly_reviews"] as const;

describe("yönetici tabloları: okuma", () => {
  for (const t of TABLES) {
    it(`${t}: yönetici okur`, async () => {
      const { data, error } = await yon.from(t).select("*");
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });
    it(`${t}: danışman ve öğretmen boş görür`, async () => {
      for (const c of [dan, ogr]) {
        const { data } = await c.from(t).select("*");
        expect(data ?? []).toEqual([]);
      }
    });
  }
});

describe("yönetici tabloları: yazma", () => {
  it("yönetici istemcisiyle ad_change_log insert hata verir", async () => {
    const { error } = await yon.from("ad_change_log").insert({
      platform: "google", level: "campaign", object_id: TEST_OBJ, action: "pause",
      source: "kampanyalar", status: "uygulandi", actor_id: YON_ID,
    });
    expect(error).not.toBeNull();
  });

  it("ad_recommendations aynı (hafta, kural, nesne) ikinci kez 23505", async () => {
    const { error } = await admin.from("ad_recommendations").insert({
      week_start: WEEK, rule_key: "durdur", object_key: TEST_OBJ, title: "t2", why: "w2",
    });
    expect(error?.code).toBe("23505");
  });

  it("ad_content_links geçersiz içerik kodunu reddeder", async () => {
    const { error } = await admin.from("ad_content_links").insert({
      platform: "meta", ad_id: TEST_OBJ, content_code: "kotu-kod",
    });
    expect(error?.code).toBe("23514");
  });
});

describe("app_settings tohumları", () => {
  it("reklam_kurallari Aşama 3 alanlarını korur ve yenileri ekler", async () => {
    const { data } = await admin.from("app_settings").select("value").eq("key", "reklam_kurallari").single();
    expect(data?.value).toMatchObject({
      hedef_nitelikli_tl: 1000, durdur_kat: 3, kazan_min_nitelikli: 5, sonucsuz_hafta: 3,
      buyutme_yuzde: 20, yorgunluk_siklik: 3, yorgunluk_ctr_dusus_yuzde: 30,
    });
  });
  it("kapi_esikleri ve aylik_butce tohumlanır", async () => {
    const { data } = await admin.from("app_settings").select("key,value").in("key", ["kapi_esikleri", "aylik_butce"]);
    expect(data?.length).toBe(2);
  });
});
