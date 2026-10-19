import { NextRequest, NextResponse } from "next/server";
import { runWaFlush } from "@/lib/wa/run";

export const dynamic = "force-dynamic";

/** Dakikalık cron: WhatsApp kuyruğunu boşaltır (işlem sonrası tetik kaçarsa yedek). */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runWaFlush();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = (e as Error).message.slice(0, 300);
    console.error("[cron/wa]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
