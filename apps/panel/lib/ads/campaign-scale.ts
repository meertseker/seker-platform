// Z5 "Büyütmeye taşı" düğmesinin görünmesi (saf): yalnız Test setinde yayında olan, içerik kodlu Meta reklamı.
import type { AdSetup } from "./ad-setup";
import type { CampaignRow } from "./campaigns";

/**
 * Meta reklam satırı, içerik kodu dolu, üst reklam seti kurulumdaki Test seti ve yayında (kendisi ya da üstü durmamış).
 * Reklam satırının "yayında" durumu tabloda `reklam`dır (kampanya satırında `yayinda`); ikisi de kabul.
 */
export function canMoveToScale(row: CampaignRow, setup: AdSetup | null): boolean {
  if (!setup) return false;
  if (row.platform !== "meta" || row.level !== "ad" || !row.objectId) return false;
  if (!row.contentCode) return false;
  if (row.adsetId !== setup.testAdsetId) return false;
  if (row.selfPaused || row.parentPaused) return false;
  return row.status === "reklam" || row.status === "yayinda";
}
