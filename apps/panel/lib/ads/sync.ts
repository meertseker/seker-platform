import type { AdsConfig } from "./config";
import { fetchCampaignSpend, ingestConversion } from "./googleAds";
import type { AdsStore, FetchFn, UploadOutcome } from "./types";

export interface SyncDeps {
  cfg: AdsConfig;
  token: string;
  store: AdsStore;
  fetchFn?: FetchFn;
}

/** Türkiye 2016'dan beri sabit UTC+3 (yaz saati yok). */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

const MAX_CLICK_AGE_MS = 89 * 86400000;

/** ISO zaman damgasını Data Manager'ın beklediği "+03:00" ofsetli biçime çevirir. */
export function toIstanbulOffsetTimestamp(iso: string): string {
  const local = new Date(new Date(iso).getTime() + ISTANBUL_OFFSET_MS);
  return `${local.toISOString().slice(0, 19)}+03:00`;
}

/** İstanbul takvimine göre `days` gün önceki tarihi YYYY-MM-DD döner. */
export function istanbulDaysAgo(days: number, now: Date = new Date()): string {
  const local = new Date(now.getTime() + ISTANBUL_OFFSET_MS - days * 86400000);
  return local.toISOString().slice(0, 10);
}

/** Harcamayı çeker ve idempotent biçimde yazar (aynı gün tekrar çekilirse üzerine yazar). */
export async function syncSpend(deps: SyncDeps, from: string, to: string): Promise<number> {
  const rows = await fetchCampaignSpend(deps.cfg, deps.token, from, to, deps.fetchFn);
  if (rows.length > 0) await deps.store.upsertSpend(rows);
  return rows.length;
}

/** Bekleyen dönüşümleri tek tek gönderir; her satırın sonucunu kaydeder. */
export async function uploadPending(
  deps: SyncDeps,
  limit = 50,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const pending = await deps.store.listPending(limit);
  const outcomes: UploadOutcome[] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const conv of pending) {
    if (conv.adUserData === "denied") {
      outcomes.push({ id: conv.id, status: "atlandi", error: "reklam verisi onayı yok" });
      skipped += 1;
      continue;
    }
    // Google'ın 90 günlük sınırı tıklamadan sayılır; 89 gün güvenlik payı.
    const clickMs = Date.parse(conv.clickAt);
    if (Number.isNaN(clickMs) || Date.now() - clickMs > MAX_CLICK_AGE_MS) {
      outcomes.push({ id: conv.id, status: "atlandi", error: "tıklama 90 günden eski" });
      skipped += 1;
      continue;
    }
    try {
      const result = await ingestConversion(
        deps.cfg,
        deps.token,
        conv,
        toIstanbulOffsetTimestamp(conv.conversionAt),
        deps.fetchFn,
      );
      if (result.ok) {
        outcomes.push({ id: conv.id, status: "gonderildi", error: null });
        sent += 1;
      } else {
        outcomes.push({ id: conv.id, status: "hata", error: result.error });
        failed += 1;
      }
    } catch (error) {
      outcomes.push({ id: conv.id, status: "hata", error: (error as Error).message.slice(0, 500) });
      failed += 1;
    }
  }

  if (outcomes.length > 0) await deps.store.saveOutcomes(outcomes);
  return { sent, failed, skipped };
}
