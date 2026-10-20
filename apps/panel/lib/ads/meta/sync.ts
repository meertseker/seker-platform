import type { FetchFn } from "../types";
import type { MetaStore } from "../store";
import type { MetaConfig } from "./config";
import { fetchMetaAdSpend } from "./insights";

/** Meta harcama düzeltmeleri geç gelebildiği için son 7 gün her sabah yeniden çekilir. */
export const META_RESYNC_DAYS = 7;

/** Meta reklam harcamasını çeker ve idempotent biçimde yazar. Yazılan satır sayısını döner. */
export async function syncMetaSpend(
  deps: { cfg: MetaConfig; store: MetaStore; fetchFn?: FetchFn },
  from: string,
  to: string,
): Promise<number> {
  const rows = await fetchMetaAdSpend(deps.cfg, from, to, deps.fetchFn);
  if (rows.length > 0) await deps.store.upsertSpend(rows);
  return rows.length;
}
