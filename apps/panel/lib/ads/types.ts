import type { ConversionAction } from "@/lib/constants";

export type FetchFn = typeof fetch;

export interface SpendRow {
  date: string; // YYYY-MM-DD (hesap saat dilimi)
  campaignId: string;
  campaignName: string;
  costMicros: number;
  clicks: number;
  impressions: number;
}

export interface PendingConversion {
  id: string;
  leadId: string;
  gclid: string;
  action: ConversionAction;
  conversionAt: string; // ISO (DB timestamptz)
  clickAt: string; // ISO; Google 90 gün sınırı tıklamadan sayılır
  value: number | null; // TL
  adUserData: "granted" | "denied" | null;
}

export interface UploadOutcome {
  id: string;
  status: "gonderildi" | "hata" | "atlandi";
  error: string | null;
}

export interface AdsStore {
  upsertSpend(rows: SpendRow[]): Promise<void>;
  listPending(limit: number): Promise<PendingConversion[]>;
  saveOutcomes(outcomes: UploadOutcome[]): Promise<void>;
}

export type AdPlatform = "google" | "meta";

/** Platform bilgili harcama satırı. Google satırları `SpendRow` olarak kalır; Meta reklam seviyesi bunu kullanır. */
export interface PlatformSpendRow extends SpendRow {
  platform: AdPlatform;
  level: "campaign" | "adset" | "ad";
  objectId: string;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  contentCode: string | null;
  reach: number | null;
  frequency: number | null;
  platformResults: number | null;
}
