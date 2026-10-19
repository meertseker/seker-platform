import { createAdminSupabase } from "@seker/auth/admin";
import { istanbulDateString } from "@/lib/cron-rules";
import { flushOutbox, type FlushResult } from "./flush";
import { supabaseWaStore } from "./store";
import { getSession, readWahaConfig, sendText } from "./waha";

type Db = ReturnType<typeof createAdminSupabase>;

/** Bağlantı koptuğunda yöneticilere günde en fazla bir panel bildirimi. */
async function notifyDisconnected(db: Db) {
  const today = istanbulDateString();
  const { data: yoneticiler } = await db.from("profiles").select("id").eq("role", "yonetici").eq("is_active", true);
  for (const y of yoneticiler ?? []) {
    const { data: existing } = await db
      .from("notifications")
      .select("id")
      .eq("user_id", y.id)
      .eq("type", "wa_baglanti_koptu")
      .eq("payload->>tarih", today)
      .limit(1);
    if (existing?.length) continue;
    await db.from("notifications").insert({ user_id: y.id, type: "wa_baglanti_koptu", payload: { tarih: today } });
  }
}

let running: Promise<FlushResult | { skipped: string }> | null = null;

/** Kuyruğu boşaltır. Cron ve işlem sonrası tetik aynı süreçte çakışmasın diye tek seferde bir koşu. */
export function runWaFlush(): Promise<FlushResult | { skipped: string }> {
  if (running) return running;
  running = (async () => {
    const cfg = readWahaConfig();
    if (!cfg) return { skipped: "WAHA yapılandırılmamış" };
    const db = createAdminSupabase();
    const result = await flushOutbox({
      store: supabaseWaStore(db),
      sender: {
        isReady: async () => (await getSession(cfg)).status === "WORKING",
        send: (chatId, text) => sendText(cfg, chatId, text),
      },
    });
    if (result.notReady) {
      try {
        await notifyDisconnected(db);
      } catch (e) {
        console.error("[wa] bildirim yazılamadı", (e as Error).message);
      }
    }
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** İşlemden ~20 sn sonra kuyruğu boşalt; peş peşe işlemler tek mesajda birleşsin.
 *  Dakikalık cron zaten yedek; bu yalnızca gecikmeyi kısaltır. */
export function scheduleWaFlush(delayMs = 20_000) {
  if (!process.env.WAHA_URL) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    runWaFlush().catch((e) => console.error("[wa] kuyruk boşaltılamadı", (e as Error).message));
  }, delayMs);
  timer.unref?.();
}
