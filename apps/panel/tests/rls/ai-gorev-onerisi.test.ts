import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

// AI görev önerileri (0020): personel okur, öğretmen göremez, yazma yalnız service_role.
const WEEK = "2031-01-06"; // Pazartesi, gerçek veriyle çakışmaz

let yon: SupabaseClient, dan: SupabaseClient, ogr: SupabaseClient;

async function cleanup() {
  await admin.from("ai_gorev_onerileri").delete().eq("week_start", WEEK);
}

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
  ogr = await clientFor("ogretmen@test.local");
  await cleanup();
  const { error } = await admin.from("ai_gorev_onerileri").insert({
    week_start: WEEK,
    slot: "reels_a",
    status: "hazir",
    suggestions: [{ baslik: "b", aciklama: "a", dayanak: "d" }],
  });
  if (error) throw error;
});

afterAll(cleanup);

describe("ai_gorev_onerileri", () => {
  it("yönetici ve danışman okur", async () => {
    for (const c of [yon, dan]) {
      const { data, error } = await c.from("ai_gorev_onerileri").select("slot, suggestions").eq("week_start", WEEK);
      expect(error).toBeNull();
      expect(data).toEqual([{ slot: "reels_a", suggestions: [{ baslik: "b", aciklama: "a", dayanak: "d" }] }]);
    }
  });

  it("öğretmen boş görür", async () => {
    const { data } = await ogr.from("ai_gorev_onerileri").select("*").eq("week_start", WEEK);
    expect(data ?? []).toEqual([]);
  });

  it("oturum istemcisi yazamaz", async () => {
    for (const c of [yon, dan]) {
      const ins = await c.from("ai_gorev_onerileri").insert({ week_start: WEEK, slot: "reels_b" });
      expect(ins.error).not.toBeNull();
      await c.from("ai_gorev_onerileri").update({ status: "hata" }).eq("week_start", WEEK);
    }
    const { data } = await admin.from("ai_gorev_onerileri").select("status").eq("week_start", WEEK);
    expect(data).toEqual([{ status: "hazir" }]);
  });

  it("aynı (hafta, yuva) ikinci kez 23505; Pazartesi olmayan hafta ve bilinmeyen yuva reddedilir", async () => {
    expect((await admin.from("ai_gorev_onerileri").insert({ week_start: WEEK, slot: "reels_a" })).error?.code).toBe("23505");
    expect((await admin.from("ai_gorev_onerileri").insert({ week_start: "2031-01-07", slot: "reels_a" })).error?.code).toBe("23514");
    expect((await admin.from("ai_gorev_onerileri").insert({ week_start: WEEK, slot: "reels_c" })).error?.code).toBe("23514");
  });

  it("danışman okul bilgileri anahtarını yazamaz", async () => {
    const { error } = await dan.from("app_settings").upsert({ key: "okul_bilgileri", value: { metin: "x" } });
    expect(error).not.toBeNull();
  });
});
