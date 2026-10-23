// Bağlantı durumu anlık görüntüsü (app_settings.baglanti_durumu, anahtarsız JSON). Yalnız sunucu.
// Ayarlar ve içerik panosu 15 dakikadan eskiyse yeniden hesaplar; sabah /api/cron/ads her gün yeniler.
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@seker/auth/admin";
import { requestNow } from "@/lib/time";
import { checkConnections, CONNECTIONS_KEY, parseSnapshot, SNAPSHOT_TTL_MS, type ConnectionSnapshot } from "./connections";

async function writeSnapshot(db: SupabaseClient, snap: ConnectionSnapshot): Promise<void> {
  const { error } = await db.from("app_settings").upsert({ key: CONNECTIONS_KEY, value: snap }, { onConflict: "key" });
  if (error) console.error("[baglanti_durumu] yazılamadı:", error.message);
}

/** İstek içinde bir kez; 15 dakikadan yeni kayıt varsa onu döner. Hiç fırlatmaz. */
export const loadConnections = cache(async (): Promise<ConnectionSnapshot> => {
  const now = await requestNow();
  const db = createAdminSupabase();
  try {
    const { data } = await db.from("app_settings").select("value").eq("key", CONNECTIONS_KEY).maybeSingle();
    const snap = parseSnapshot((data as { value?: unknown } | null)?.value);
    if (snap && now.getTime() - Date.parse(snap.checkedAt) < SNAPSHOT_TTL_MS) return snap;
  } catch (e) {
    console.error("[baglanti_durumu] okunamadı:", (e as Error).message);
  }
  const fresh = await checkConnections({ env: process.env, now });
  try {
    await writeSnapshot(db, fresh);
  } catch (e) {
    console.error("[baglanti_durumu] yazılamadı:", (e as Error).message);
  }
  return fresh;
});

/** Cron için: her zaman yeniden hesaplar ve yazar. */
export async function refreshConnections(db: SupabaseClient, now: Date = new Date()): Promise<ConnectionSnapshot> {
  const snap = await checkConnections({ env: process.env, now });
  await writeSnapshot(db, snap);
  return snap;
}
