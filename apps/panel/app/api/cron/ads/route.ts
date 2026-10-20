import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@seker/auth/admin";
import { readAdsConfig } from "@/lib/ads/config";
import { getAccessToken } from "@/lib/ads/googleAds";
import { readMetaConfig } from "@/lib/ads/meta/config";
import { uploadMetaPending } from "@/lib/ads/meta/capi";
import { META_RESYNC_DAYS, syncMetaSpend } from "@/lib/ads/meta/sync";
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
    } catch (e) {
      errors.push(`OAuth: ${(e as Error).message.slice(0, 240)}`);
    }
  }

  // Meta, Google'dan bağımsız: biri patlasa öteki yine çalışır. Yapılandırılmamışsa yanıtta `meta` anahtarı yoktur.
  let meta: { spendRows: number | null; sent: number; failed: number; skipped: number; capi: "acik" | "kapali" } | undefined;
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

  const googleBody = cfg ? { spendRows, ...upload } : { skipped: "yapilandirilmamis" };
  const body = meta ? { ...googleBody, meta } : googleBody;

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
