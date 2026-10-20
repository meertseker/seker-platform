import type { Metadata } from "next";
import { createAdminSupabase } from "@seker/auth/admin";
import { ContentBoard } from "@/components/content-board";
import { requireRole } from "@/lib/auth";
import { emptyPerf, loadBoardItems, loadContentPerf, loadTeachers, type BoardItem, type ContentPerf } from "@/lib/content/board";
import { getContentRules } from "@/lib/content/settings";
import { CONTENT_BUCKET } from "@/lib/content/store";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "İçerik panosu" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const VIDEO_URL_SECONDS = 600;

/** Kontrol'deki Reels videoları için 10 dakikalık imzalı okuma adresleri (kova gizli). */
async function videoUrls(items: BoardItem[]): Promise<Record<string, string>> {
  const pending = items.filter((i) => i.stage === "kontrol" && i.kind === "reels" && i.mediaPath);
  if (pending.length === 0) return {};
  const admin = createAdminSupabase();
  const out: Record<string, string> = {};
  await Promise.all(
    pending.map(async (i) => {
      const { data, error } = await admin.storage.from(CONTENT_BUCKET).createSignedUrl(i.mediaPath!, VIDEO_URL_SECONDS);
      if (data?.signedUrl) out[i.id] = data.signedUrl;
      else console.error("[icerik] video adresi alınamadı:", error?.message ?? "bilinmeyen");
    }),
  );
  return out;
}

export default async function IcerikPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("yonetici");
  const params = await searchParams;
  const kod = typeof params.kod === "string" ? params.kod : null;

  const supabase = await createServerSupabase();
  const [items, teachers, settings] = await Promise.all([
    loadBoardItems(supabase),
    loadTeachers(supabase),
    getContentRules(supabase),
  ]);

  let perfError = false;
  let perfMap = new Map<string, ContentPerf>();
  try {
    perfMap = await loadContentPerf(supabase, items.map((i) => i.code));
  } catch (e) {
    console.error("[icerik] reklam sayıları okunamadı:", e instanceof Error ? e.message : "bilinmeyen");
    perfError = true;
  }
  const perf: Record<string, ContentPerf> = {};
  for (const i of items) perf[i.code] = perfMap.get(i.code) ?? emptyPerf();

  return (
    <ContentBoard
      items={items}
      perf={perf}
      perfError={perfError}
      rules={settings.rules}
      teachers={teachers}
      videoUrls={await videoUrls(items)}
      initialCode={kod}
      nowIso={new Date().toISOString()}
    />
  );
}
