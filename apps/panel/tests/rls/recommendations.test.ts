import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";
import { supabaseRecommendationStore, syncRecommendations, type RecDraft } from "@/lib/ads/recommendations";
import { loadWeekRecommendations } from "@/lib/queries/recommendations";

// Öneri kaydı (0018 ad_recommendations): (hafta, kural, nesne) tekil; bekletilen aynı hafta yeniden açılmaz (Review Focus 3).
const WEEK = "2026-09-07"; // Pazartesi
const NEXT_WEEK = "2026-09-14";
const YON_ID = "00000000-0000-0000-0000-000000000001";

let yon: SupabaseClient, dan: SupabaseClient;

function draft(over: Partial<RecDraft>): RecDraft {
  return {
    ruleKey: "durdur",
    objectKey: "R-9937-A",
    platform: "meta",
    title: "R-9937-A'yı durdur",
    why: "3.150 TL harcadı, hiç nitelikli veli getirmedi.",
    action: { platform: "meta", level: "ad", objectId: "990001", objectName: "R-9937-A", kind: "pause" },
    blockedReason: null,
    ...over,
  };
}

async function cleanup() {
  await admin.from("ad_recommendations").delete().in("week_start", [WEEK, NEXT_WEEK]);
}

async function rows(week = WEEK) {
  const { data, error } = await admin
    .from("ad_recommendations")
    .select("id, rule_key, object_key, status, why, blocked_reason, result, decided_by")
    .eq("week_start", week)
    .order("rule_key");
  if (error) throw error;
  return data as { id: string; rule_key: string; object_key: string; status: string; why: string; blocked_reason: string | null; result: string | null; decided_by: string | null }[];
}

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
});
beforeEach(cleanup);
afterAll(cleanup);

describe("syncRecommendations", () => {
  it("ikinci çağrıda kopya açmaz", async () => {
    const drafts = [draft({}), draft({ ruleKey: "buyut", objectKey: "R-9937-B", action: null })];
    await syncRecommendations(admin, WEEK, drafts);
    await syncRecommendations(admin, WEEK, drafts);
    const r = await rows();
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.status === "acik")).toBe(true);
  });

  it("bekletilene dokunmaz; gelecek hafta yeniden sorulur", async () => {
    await syncRecommendations(admin, WEEK, [draft({})]);
    const [row] = await rows();
    const store = supabaseRecommendationStore(admin);
    expect(await store.hold(row.id, YON_ID, "Bekletiliyor · gelecek hafta tekrar sorulur", new Date().toISOString())).toBe(true);

    await syncRecommendations(admin, WEEK, [draft({ why: "yeni metin" })]);
    const after = await rows();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ status: "bekletildi", why: row.why, result: "Bekletiliyor · gelecek hafta tekrar sorulur", decided_by: YON_ID });

    // Kural tutmasa da bekletilen geçersiz sayılmaz.
    await syncRecommendations(admin, WEEK, []);
    expect((await rows())[0].status).toBe("bekletildi");

    await syncRecommendations(admin, NEXT_WEEK, [draft({})]);
    expect((await rows(NEXT_WEEK)).map((x) => x.status)).toEqual(["acik"]);
  });

  it("artık üretilmeyen açık öneri geçersiz; yeniden üretilirse açılır ve tazelenir", async () => {
    await syncRecommendations(admin, WEEK, [draft({ ruleKey: "butce_artir", objectKey: "meta:990001", blockedReason: "Kapı kırmızı" })]);
    await syncRecommendations(admin, WEEK, []);
    expect((await rows())[0].status).toBe("gecersiz");
    await syncRecommendations(admin, WEEK, [draft({ ruleKey: "butce_artir", objectKey: "meta:990001", blockedReason: null, why: "kapılar yeşil" })]);
    expect((await rows())[0]).toMatchObject({ status: "acik", blocked_reason: null, why: "kapılar yeşil" });
  });

  it("onaylanmış öneriye dokunmaz; ikinci ayırma başarısız", async () => {
    await syncRecommendations(admin, WEEK, [draft({})]);
    const [row] = await rows();
    const store = supabaseRecommendationStore(admin);
    expect(await store.claim(row.id, YON_ID)).toMatchObject({ id: row.id, status: "onaylandi", action: { kind: "pause", objectId: "990001" } });
    expect(await store.claim(row.id, YON_ID)).toBeNull();
    await store.finish(row.id, "Kaydedildi · uygulanmadı: canlı yazım kapalı");
    await syncRecommendations(admin, WEEK, []);
    expect((await rows())[0]).toMatchObject({ status: "onaylandi", result: "Kaydedildi · uygulanmadı: canlı yazım kapalı" });
  });

  it("serbest bırakılan öneri yeniden açık", async () => {
    await syncRecommendations(admin, WEEK, [draft({})]);
    const [row] = await rows();
    const store = supabaseRecommendationStore(admin);
    await store.claim(row.id, YON_ID);
    await store.release(row.id);
    expect((await rows())[0]).toMatchObject({ status: "acik", decided_by: null });
  });
});

describe("loadWeekRecommendations ve yetki", () => {
  it("yönetici geçerli önerileri görür (geçersizler hariç), danışman hiç görmez", async () => {
    await syncRecommendations(admin, WEEK, [draft({}), draft({ ruleKey: "sonucsuz", objectKey: "R-9937-C" })]);
    await syncRecommendations(admin, WEEK, [draft({})]);
    const list = await loadWeekRecommendations(yon, WEEK);
    expect(list.map((r) => [r.ruleKey, r.status])).toEqual([["durdur", "acik"]]);
    expect(list[0].action).toMatchObject({ kind: "pause", objectId: "990001" });
    expect(await loadWeekRecommendations(dan, WEEK)).toEqual([]);
  });

  it("danışman ve yönetici oturumu öneriyi değiştiremez (yazma yalnız service_role)", async () => {
    await syncRecommendations(admin, WEEK, [draft({})]);
    const [row] = await rows();
    for (const c of [dan, yon]) {
      await c.from("ad_recommendations").update({ status: "onaylandi" }).eq("id", row.id);
    }
    expect((await rows())[0].status).toBe("acik");
  });
});
