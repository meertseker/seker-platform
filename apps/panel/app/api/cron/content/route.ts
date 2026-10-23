import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@seker/auth/admin";
import { readMetaConfig } from "@/lib/ads/meta/config";
import { runPublishQueue } from "@/lib/content/publish-runner";
import { supabasePublishStore } from "@/lib/content/publish-store";

export const dynamic = "force-dynamic";

/**
 * Instagram yayın kuyruğu (spec K15, §15 B6): 5 dakikada bir, İstanbul 07–22 (crontab `*\/5 7-22 * * *`).
 * Bayrak kapalıyken de çalışır: koşucu kuyruktaki satırları "kapatıldı" hatasıyla kapatır, Meta'ya istek gitmez.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const store = supabasePublishStore(createAdminSupabase());
    const result = await runPublishQueue({ store, cfg: readMetaConfig(), env: process.env }, 5);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const message = cronSecret ? raw.split(cronSecret).join("[gizli]") : raw;
    console.error("[cron/content]", message);
    return NextResponse.json({ ok: false, error: "Yayın kuyruğu çalışmadı" }, { status: 500 });
  }
}
