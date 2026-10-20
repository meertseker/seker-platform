import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

// İçerik eylemleri gerçek DB'ye karşı, öğretmenin oturum istemcisiyle çalışır (RLS + kolon yetkisi).
const YON_ID = "00000000-0000-0000-0000-000000000001";
const OGR_ID = "00000000-0000-0000-0000-000000000004";
const OGR2_ID = "00000000-0000-0000-0000-000000000005";
const WEEK = "2026-10-19"; // Pazartesi

let current: SupabaseClient;
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => admin }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => current }));
vi.mock("@/lib/auth", () => ({
  requireRole: async () => ({ id: OGR_ID, full_name: "Öğretmen (Test)", role: "ogretmen", can_edit_site: false }),
}));

import { saveContentDraft, submitContent } from "@/actions/content";

// Kodlar 98xx haftasında (icerik.test.ts 99xx kullanır ve kendi artığını siler).
let seq = 0;
const created: string[] = [];
const uploaded: string[] = [];

async function cleanup() {
  const { data } = await admin.from("content_items").select("id").like("code", "_-98%");
  const ids = (data ?? []).map((r) => r.id as string);
  if (ids.length > 0) {
    await admin.from("notifications").delete().in("payload->>contentId", ids);
  }
  await admin.from("content_items").delete().like("code", "_-98%");
}

async function newReels(owner: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  const { data, error } = await admin.from("content_items").insert({
    code: `R-${9800 + seq}-A`, kind: "reels", platform: "instagram", week_start: WEEK,
    topic: "Eylem RLS konusu", owner_id: owner, created_by: YON_ID, ...extra,
  }).select("id, owner_id").single();
  if (error) throw error;
  created.push(data!.id as string);
  return data as { id: string; owner_id: string };
}

beforeAll(async () => {
  await cleanup();
  current = await clientFor("ogretmen@test.local");
});

afterAll(async () => {
  if (uploaded.length > 0) await admin.storage.from("icerik").remove(uploaded);
  await cleanup();
});

describe("saveContentDraft (öğretmen oturumu)", () => {
  it("kendi taslağına yazar", async () => {
    const item = await newReels(OGR_ID);
    const res = await saveContentDraft(item.id, { caption: "Sabah kapıda karşılama", faceAnswer: false });
    expect(res).toEqual({ ok: true });
    const { data } = await admin.from("content_items").select("caption, face_answer").eq("id", item.id).single();
    expect(data).toEqual({ caption: "Sabah kapıda karşılama", face_answer: false });
  });

  it("video değişince eski yüz cevabı silinir", async () => {
    const item = await newReels(OGR_ID, { face_answer: false, media_path: null });
    const path = `${OGR_ID}/${item.id}/yeni-1.mp4`;
    expect(await saveContentDraft(item.id, { mediaPath: path })).toEqual({ ok: true });
    const { data } = await admin.from("content_items").select("media_path, face_answer").eq("id", item.id).single();
    expect(data).toEqual({ media_path: path, face_answer: null });
  });

  it("başka öğretmenin içeriğine yazamaz", async () => {
    const item = await newReels(OGR2_ID, { caption: "dokunulmaz" });
    const res = await saveContentDraft(item.id, { caption: "değiştirildi" });
    expect(res).toHaveProperty("error");
    const { data } = await admin.from("content_items").select("caption").eq("id", item.id).single();
    expect(data!.caption).toBe("dokunulmaz");
  });

  it("teslimden sonra taslak kaydı hata döner ve içerik değişmez", async () => {
    const item = await newReels(OGR_ID);
    const path = `${OGR_ID}/${item.id}/video.mp4`;
    const up = await admin.storage.from("icerik").upload(path, new Blob([new Uint8Array(16)], { type: "video/mp4" }), {
      contentType: "video/mp4",
    });
    if (up.error) throw up.error;
    uploaded.push(path);

    expect(
      await saveContentDraft(item.id, {
        caption: "Sabah kapıda her çocuğu adıyla karşılıyoruz.",
        mediaPath: path,
        mediaMeta: { name: "video.mp4", size: 16, durationSec: 12 },
        faceAnswer: false,
      }),
    ).toEqual({ ok: true });

    const sub = await submitContent(item.id);
    expect(sub).toEqual({ ok: true, done: ["Otomatik kontrol geçti", "Yöneticinin onayında"] });
    // Öğretmenin oturumu durumu doğrudan değiştiremez.
    const direct = await current.from("content_items").update({ status: "taslak" }).eq("id", item.id).select();
    expect(direct.error).not.toBeNull();
    const { data: after } = await admin
      .from("content_items").select("status, stage, submitted_at").eq("id", item.id).single();
    expect(after).toMatchObject({ status: "teslim", stage: "kontrol" });
    expect(after!.submitted_at).not.toBeNull();

    const res = await saveContentDraft(item.id, { caption: "teslimden sonra değişiklik" });
    expect(res).toHaveProperty("error");
    const { data: still } = await admin.from("content_items").select("caption").eq("id", item.id).single();
    expect(still!.caption).toBe("Sabah kapıda her çocuğu adıyla karşılıyoruz.");

    const { data: notes } = await admin
      .from("notifications").select("user_id, type").eq("payload->>contentId", item.id);
    expect(notes).toContainEqual({ user_id: YON_ID, type: "icerik_teslim" });
  });
});
