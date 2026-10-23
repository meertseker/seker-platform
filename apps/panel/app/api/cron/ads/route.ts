import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@seker/auth/admin";
import { readAdsConfig } from "@/lib/ads/config";
import { getAccessToken } from "@/lib/ads/googleAds";
import { readMetaConfig } from "@/lib/ads/meta/config";
import { uploadMetaPending } from "@/lib/ads/meta/capi";
import { META_RESYNC_DAYS, syncMetaSpend } from "@/lib/ads/meta/sync";
import { fetchGoogleCampaignStates } from "@/lib/ads/google-objects";
import { fetchMetaObjects } from "@/lib/ads/meta/objects";
import { upsertAdObjects } from "@/lib/ads/objects-store";
import { syncOrganicStats } from "@/lib/content/organic";
import { refreshConnections } from "@/lib/ads/connections-cache";
import { supabaseAdsStore, supabaseMetaStore } from "@/lib/ads/store";
import { istanbulDaysAgo, syncSpend, uploadPending } from "@/lib/ads/sync";
import { istanbulDateString } from "@/lib/cron-rules";
import { insertNotifications } from "@/lib/notifications/insert";

export const dynamic = "force-dynamic";

/** Google maliyeti birkaç gün düzeltebildiği için son 3 gün her sabah yeniden çekilir. */
const RESYNC_DAYS = 3;

async function notifyYoneticiler(db: ReturnType<typeof createAdminSupabase>, message: string) {
  const today = istanbulDateString();
  const { data: yoneticiler } = await db.from("profiles").select("id").eq("role", "yonetici").eq("is_active", true);
  for (const y of yoneticiler ?? []) {
    const { data: existing } = await db
      .from("notifications")
      .select("id")
      .eq("user_id", y.id)
      .eq("type", "ads_senkron_hata")
      .eq("payload->>tarih", today)
      .limit(1);
    if (existing?.length) continue;
    const { error } = await insertNotifications(db, [{ user_id: y.id, type: "ads_senkron_hata", payload: { message, tarih: today } }]);
    if (error) console.error(`Bildirim yazılamadı: ${error.message}`);
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = readAdsConfig();
  const metaCfg = readMetaConfig();
  if (!cfg && !metaCfg) return NextResponse.json({ ok: true, skipped: "yapilandirilmamis" });

  const db = createAdminSupabase();
  const errors: string[] = [];
  let spendRows: number | null = null;
  let upload = { sent: 0, failed: 0, skipped: 0 };
  let googleObjects: number | null = null;

  if (cfg) {
    try {
      const token = await getAccessToken(cfg);
      const deps = { cfg, token, store: supabaseAdsStore(db) };

      // Harcama ve dönüşüm birbirinden bağımsız: Cloud projesi Explorer erişimi almadan harcama patlasa da dönüşümler gider.
      try {
        spendRows = await syncSpend(deps, istanbulDaysAgo(RESYNC_DAYS), istanbulDaysAgo(1));
      } catch (e) {
        errors.push(`Harcama: ${(e as Error).message.slice(0, 240)}`);
      }
      try {
        upload = await uploadPending(deps);
        if (upload.failed > 0) errors.push(`Dönüşüm: ${upload.failed} kayıt gönderilemedi`);
      } catch (e) {
        // saveOutcomes patlarsa gönderilenler bir sonraki koşuda transactionId ile güvenle yeniden denenir.
        errors.push(`Dönüşüm: ${(e as Error).message.slice(0, 240)}`);
      }
      // Kampanya durumu ve bütçesi: harcama ve dönüşümden sonra, kendi try'ında; patlarsa onlar zaten yazılmıştır.
      try {
        googleObjects = await upsertAdObjects(db, await fetchGoogleCampaignStates(cfg, token));
      } catch (e) {
        errors.push(`Google durum: ${(e as Error).message.slice(0, 240)}`);
      }
    } catch (e) {
      errors.push(`OAuth: ${(e as Error).message.slice(0, 240)}`);
    }
  }

  // Meta, Google'dan bağımsız: biri patlasa öteki yine çalışır. Yapılandırılmamışsa yanıtta `meta` anahtarı yoktur.
  let meta:
    | { spendRows: number | null; sent: number; failed: number; skipped: number; capi: "acik" | "kapali"; organic?: number | null; objects?: number | null }
    | undefined;
  if (metaCfg) {
    const metaStore = supabaseMetaStore(db);
    meta = { spendRows: null, sent: 0, failed: 0, skipped: 0, capi: metaCfg.capiEnabled ? "acik" : "kapali" };
    try {
      meta.spendRows = await syncMetaSpend({ cfg: metaCfg, store: metaStore }, istanbulDaysAgo(META_RESYNC_DAYS), istanbulDaysAgo(1));
    } catch (e) {
      errors.push(`Meta harcama: ${(e as Error).message.slice(0, 240)}`);
    }
    try {
      // Boş ya da yalnız boşluk değer de varsayılana düşer; aksi halde her Lead "site adresi yok" ile atlanır.
      const siteUrl = process.env.SITE_PUBLIC_URL?.trim() || "https://yeni.sekeranaokulu.com";
      const result = await uploadMetaPending({ cfg: metaCfg, store: metaStore, siteUrl });
      meta = { ...meta, ...result };
      if (result.failed > 0) errors.push(`Meta dönüşüm: ${result.failed} kayıt gönderilemedi`);
    } catch (e) {
      errors.push(`Meta dönüşüm: ${(e as Error).message.slice(0, 240)}`);
    }
  }

  // Meta nesne durumu: harcama ve CAPI'den sonra, kendi try'ında.
  if (metaCfg && meta) {
    meta.objects = null;
    try {
      meta.objects = await upsertAdObjects(db, await fetchMetaObjects(metaCfg));
    } catch (e) {
      errors.push(`Meta durum: ${(e as Error).message.slice(0, 240)}`);
    }
  }

  // Organik Instagram sayıları: yalnız hesap kimliği verilmişse; harcama ve CAPI'den bağımsız, hatası onları bozmaz.
  if (metaCfg?.instagramUserId && meta) {
    meta.organic = null;
    try {
      meta.organic = await syncOrganicStats({ cfg: metaCfg, db });
    } catch (e) {
      errors.push(`Meta organik: ${(e as Error).message.slice(0, 240)}`);
    }
  }

  // Ayarlar'daki bağlantı kartları (Reklam Konsolu Z6): kendi try'ında; hatası diğer adımları ve ok'u bozmaz.
  let connections: "yenilendi" | "hata" | undefined;
  if (metaCfg) {
    try {
      await refreshConnections(db);
      connections = "yenilendi";
    } catch (e) {
      connections = "hata";
      console.error("[cron/ads] bağlantı durumu yenilenemedi", (e as Error).message);
    }
  }

  const googleBody = cfg ? { spendRows, ...upload, objects: googleObjects } : { skipped: "yapilandirilmamis" };
  const withMeta = meta ? { ...googleBody, meta } : googleBody;
  const body = connections ? { ...withMeta, connections } : withMeta;

  if (errors.length === 0) return NextResponse.json({ ok: true, ...body });

  const message = errors.join(" | ").slice(0, 500);
  console.error("[cron/ads]", message);
  try {
    await notifyYoneticiler(db, message);
  } catch (e) {
    console.error("[cron/ads] bildirim yazılamadı", (e as Error).message);
  }
  return NextResponse.json({ ok: false, error: message, ...body }, { status: 500 });
}
