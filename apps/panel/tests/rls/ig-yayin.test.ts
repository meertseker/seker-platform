import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { clientFor, admin } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

// 0025 ig_yayin: Instagram yayın durumu kolonları yalnız servis rolüyle yazılır (K16);
// ad_change_log ig_yayin eylemini ve yeni kaynakları kabul eder (spec §15 B2).
const YON_ID = "00000000-0000-0000-0000-000000000001";
const OGR_ID = "00000000-0000-0000-0000-000000000004";
const WEEK = "2026-10-19";
const OBJ = "11111111-2222-3333-4444-555555555555";

let ogr: SupabaseClient, yon: SupabaseClient;
let seq = 0;
async function cleanup() {
  await admin.from("content_items").delete().like("code", "R-97%");
  await admin.from("ad_change_log").delete().eq("object_id", OBJ);
}
async function newReels(extra: Record<string, unknown> = {}) {
  seq += 1;
  const { data, error } = await admin.from("content_items").insert({
    code: `R-${9700 + seq}-A`, kind: "reels", platform: "instagram", week_start: WEEK,
    topic: "IG yayın testi", owner_id: OGR_ID, created_by: YON_ID, ...extra,
  }).select().single();
  if (error) throw error;
  return data as Record<string, unknown> & { id: string };
}

beforeAll(async () => {
  await cleanup();
  ogr = await clientFor("ogretmen@test.local");
  yon = await clientFor("yonetici@test.local");
});
afterAll(cleanup);

describe("0025 content_items yayın durumu", () => {
  it("yeni içerik ig_publish_status yok ile başlar", async () => {
    const row = await newReels();
    expect(row.ig_publish_status).toBe("yok");
    for (const k of ["ig_container_id", "ig_publish_error", "ig_publish_scheduled_at", "ig_publish_requested_by", "ig_publish_requested_at"]) {
      expect(row[k]).toBeNull();
    }
  });

  it("geçersiz yayın durumu reddedilir", async () => {
    const row = await newReels();
    const { error } = await admin.from("content_items").update({ ig_publish_status: "bitti" }).eq("id", row.id);
    expect(error?.code).toBe("23514");
  });

  it("öğretmen ig_* kolonlarına yazamaz", async () => {
    const row = await newReels();
    const patches: Record<string, unknown>[] = [
      { ig_publish_status: "kuyruk" },
      { ig_container_id: "1" },
      { ig_publish_error: "x" },
      { ig_publish_scheduled_at: "2026-10-24T10:00:00Z" },
      { ig_publish_requested_by: OGR_ID },
      { ig_publish_requested_at: "2026-10-24T10:00:00Z" },
      { ig_media_id: "1" },
      { ig_published_at: "2026-10-24T10:00:00Z" },
      { ig_permalink: "https://www.instagram.com/reel/x/" },
    ];
    for (const p of patches) {
      const { error } = await ogr.from("content_items").update(p).eq("id", row.id);
      expect(error, JSON.stringify(p)).not.toBeNull();
      expect(error?.code).toBe("42501");
    }
    const ok = await ogr.from("content_items").update({ caption: "Bahçede ilk gün" }).eq("id", row.id).select("id");
    expect(ok.error).toBeNull();
    expect(ok.data).toHaveLength(1);
  });

  it("yönetici oturumu da ig_* yazamaz (yalnız servis rolü)", async () => {
    const row = await newReels();
    const { error } = await yon.from("content_items").update({ ig_publish_status: "kuyruk" }).eq("id", row.id);
    expect(error).not.toBeNull();
  });

  it("öğretmen kendi içeriğinin yayın durumunu okur", async () => {
    const row = await newReels();
    const { data, error } = await ogr.from("content_items").select("ig_publish_status, ig_publish_error").eq("id", row.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("0025 ad_change_log", () => {
  const base = { platform: "meta", level: "icerik", object_id: OBJ, status: "uygulanmadi_kapali", actor_id: YON_ID };
  it("ig_yayin ve yeni kaynakları kabul eder", async () => {
    for (const source of ["icerik", "ayarlar", "cron"]) {
      const { error } = await admin.from("ad_change_log").insert({ ...base, action: "ig_yayin", source });
      expect(error, source).toBeNull();
    }
    const old = await admin.from("ad_change_log").insert({ ...base, action: "pause", source: "kampanyalar" });
    expect(old.error).toBeNull();
  });
  it("bilinmeyen eylem ve kaynak reddedilir", async () => {
    const a = await admin.from("ad_change_log").insert({ ...base, action: "olmayan_eylem", source: "icerik" });
    expect(a.error?.code).toBe("23514");
    const s = await admin.from("ad_change_log").insert({ ...base, action: "ig_yayin", source: "baska" });
    expect(s.error?.code).toBe("23514");
  });
});
