import type { AdsConfig } from "./config";
import { searchStream } from "./googleAds";
import type { AdObjectSyncRow } from "./objects-store";
import type { FetchFn } from "./types";

interface CampaignStateResult {
  campaign?: { id?: string; name?: string; status?: string };
  campaignBudget?: { resourceName?: string; amountMicros?: string };
}

/**
 * Kampanya durumu ve günlük bütçesi. Harcama sorgusundan ayrı bir GAQL'dir (harcama sorgusuna dokunulmaz);
 * biri patlarsa öteki etkilenmez. Silinmiş (REMOVED) kampanyalar gelmez.
 * `amount_micros` zaten mikro (TL × 1.000.000): ağ geçidiyle aynı birim, çevirme yok.
 */
export async function fetchGoogleCampaignStates(
  cfg: AdsConfig,
  token: string,
  fetchFn: FetchFn = fetch,
): Promise<AdObjectSyncRow[]> {
  const query =
    "SELECT campaign.id, campaign.name, campaign.status, campaign_budget.resource_name, campaign_budget.amount_micros " +
    "FROM campaign WHERE campaign.status != 'REMOVED'";
  const results = (await searchStream(cfg, token, query, fetchFn)) as CampaignStateResult[];
  return results.flatMap((row): AdObjectSyncRow[] => {
    const id = row.campaign?.id ? String(row.campaign.id) : "";
    if (!id) return [];
    const amount = row.campaignBudget?.amountMicros;
    return [
      {
        platform: "google",
        level: "campaign",
        objectId: id,
        parentId: null,
        campaignId: id,
        name: row.campaign?.name ?? "",
        status: row.campaign?.status ?? null,
        dailyBudgetMicros: amount === undefined || amount === "" ? null : Number(amount),
        budgetResource: row.campaignBudget?.resourceName ?? null,
        contentCode: null,
      },
    ];
  });
}
