import type { Metadata } from "next";
import { createAdminSupabase } from "@seker/auth/admin";
import { ContentBoard } from "@/components/content-board";
import { requireRole } from "@/lib/auth";
import { emptyPerf, loadBoardItems, loadContentPerf, loadTeachers, perfCodes, type BoardItem, type ContentPerf } from "@/lib/content/board";
import { igPublishEnabled, readMetaConfig } from "@/lib/ads/meta/config";
import { loadConnections } from "@/lib/ads/connections-cache";
import { reelReviewChecks, type ReelPanelContext } from "@/lib/content/reel-review";
import { requestNow } from "@/lib/time";
import { loadOrganicInfo, type OrganicInfo } from "@/lib/content/organic";
import { getContentRules } from "@/lib/content/settings";
import { CONTENT_BUCKET } from "@/lib/content/store";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "İçerik panosu" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const VIDEO_URL_SECONDS = 600;

/** Kontrol'deki ve henüz yayınlanmamış organik Reels videoları için 10 dakikalık imzalı okuma adresleri (kova gizli). */
async function videoUrls(items: BoardItem[]): Promise<Record<string, string>> {
  const pending = items.filter(
    (i) =>
      i.kind === "reels" &&
      i.mediaPath &&
      (i.stage === "kontrol" || (i.stage === "organik" && i.igPublishStatus !== "yayinda" && !i.igPermalink)),
  );
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
  const [loaded, teachers, settings] = await Promise.all([
    loadBoardItems(supabase),
    loadTeachers(supabase),
    getContentRules(supabase),
  ]);

  // Z1 otomatik kontroller (Paket B): Kontrol ve Organik aşamadaki Reels.
  const items = loaded.map((i) =>
    i.kind === "reels" && (i.stage === "kontrol" || i.stage === "organik")
      ? { ...i, reelChecks: reelReviewChecks(i, { banned: settings.banned, limits: settings.limits }) }
      : i,
  );

  let perfError = false;
  let perfMap = new Map<string, ContentPerf>();
  try {
    perfMap = await loadContentPerf(supabase, perfCodes(items));
  } catch (e) {
    console.error("[icerik] reklam sayıları okunamadı:", e instanceof Error ? e.message : "bilinmeyen");
    perfError = true;
  }
  const perf: Record<string, ContentPerf> = {};
  for (const i of items) perf[i.code] = perfMap.get(i.code) ?? emptyPerf();

  // Organik sayılar Instagram bağlıysa okunur; okunamazsa kartlar sayısız kalır, sayfa açılır.
  const now = await requestNow();
  let organic: Record<string, OrganicInfo> = {};
  try {
    organic = await loadOrganicInfo(supabase, items, Boolean(readMetaConfig()?.instagramUserId), now);
  } catch (e) {
    console.error("[icerik] organik sayılar okunamadı:", e instanceof Error ? e.message : "bilinmeyen");
  }

  // Instagram'a yayın bağlamı: yalnız Kontrol/Organik'te Reels varsa (yoksa Meta'ya gidilmez).
  let reel: ReelPanelContext | null = null;
  if (items.some((i) => i.kind === "reels" && (i.stage === "kontrol" || i.stage === "organik"))) {
    const snap = await loadConnections();
    reel = {
      publishEnabled: igPublishEnabled(),
      igUsername: snap.igUsername,
      igReady: snap.igReady,
      remaining: snap.publishLimit?.remaining ?? null,
      total: snap.publishLimit?.total ?? null,
      limits: settings.limits,
      banned: settings.banned,
    };
  }

  return (
    <ContentBoard
      items={items}
      perf={perf}
      perfError={perfError}
      rules={settings.rules}
      teachers={teachers}
      videoUrls={await videoUrls(items)}
      initialCode={kod}
      nowIso={now.toISOString()}
      organic={organic}
      reel={reel}
    />
  );
}
