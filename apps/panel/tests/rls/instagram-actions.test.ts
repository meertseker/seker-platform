import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { clientFor, admin } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

// saveReelVideoMeta'nın kullandığı güncelleme: öğretmen yalnız kendi düzenlenebilir Reels'ine K17 yazar.
const YON_ID = "00000000-0000-0000-0000-000000000001";
const OGR_ID = "00000000-0000-0000-0000-000000000004";
const OGR2_ID = "00000000-0000-0000-0000-000000000005";
const WEEK = "2026-10-19";
let ogr: SupabaseClient;
let seq = 0;

async function cleanup() {
  await admin.from("content_items").delete().like("code", "R-96%");
}
async function newReels(owner: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  const { data, error } = await admin.from("content_items").insert({
    code: `R-${9600 + seq}-A`, kind: "reels", platform: "instagram", week_start: WEEK,
    topic: "K17 RLS", owner_id: owner, created_by: YON_ID, ...extra,
  }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}
const k17 = { durationS: 34, width: 1080, height: 1920, vertical: true, coverOffsetMs: 1000, subtitled: true };
function update(id: string) {
  return ogr
    .from("content_items")
    .update({ media_meta: k17 })
    .eq("id", id)
    .eq("owner_id", OGR_ID)
    .in("status", ["taslak", "duzeltme"])
    .eq("kind", "reels")
    .select("id");
}

beforeAll(async () => {
  await cleanup();
  ogr = await clientFor("ogretmen@test.local");
});
afterAll(cleanup);

describe("saveReelVideoMeta güncellemesi (RLS)", () => {
  it("kendi taslağında 1 satır", async () => {
    const id = await newReels(OGR_ID);
    const { data, error } = await update(id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
  it("teslim edilmiş içerikte 0 satır", async () => {
    const id = await newReels(OGR_ID);
    const sub = await admin.from("content_items")
      .update({ status: "teslim", face_answer: false, media_path: `${OGR_ID}/${id}/v.mp4` }).eq("id", id);
    if (sub.error) throw sub.error;
    const { data } = await update(id);
    expect(data ?? []).toHaveLength(0);
  });
  it("başkasının içeriğinde 0 satır", async () => {
    const id = await newReels(OGR2_ID);
    const { data } = await update(id);
    expect(data ?? []).toHaveLength(0);
  });
});
