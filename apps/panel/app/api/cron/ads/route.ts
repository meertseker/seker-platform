import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@seker/auth/admin";
import { readAdsConfig } from "@/lib/ads/config";
import { getAccessToken } from "@/lib/ads/googleAds";
import { supabaseAdsStore } from "@/lib/ads/store";
import { istanbulDaysAgo, syncSpend, uploadPending } from "@/lib/ads/sync";
import { istanbulDateString } from "@/lib/cron-rules";

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
    await db.from("notifications").insert({ user_id: y.id, type: "ads_senkron_hata", payload: { message, tarih: today } });
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = readAdsConfig();
  if (!cfg) return NextResponse.json({ ok: true, skipped: "yapilandirilmamis" });

  const db = createAdminSupabase();
  const errors: string[] = [];
  let spendRows: number | null = null;
  let upload = { sent: 0, failed: 0, skipped: 0 };

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

  if (errors.length === 0) return NextResponse.json({ ok: true, spendRows, ...upload });

  const message = errors.join(" | ").slice(0, 500);
  console.error("[cron/ads]", message);
  try {
    await notifyYoneticiler(db, message);
  } catch (e) {
    console.error("[cron/ads] bildirim yazılamadı", (e as Error).message);
  }
  return NextResponse.json({ ok: false, error: message, spendRows, ...upload }, { status: 500 });
}
