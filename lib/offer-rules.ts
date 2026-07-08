import type { OfferStatus } from "./constants";

/** spec §5.6: liste fiyatı ve üzeri otomatik onaylanır. */
export function isAutoApproved(offeredKurus: number, listKurus: number): boolean {
  return offeredKurus >= listKurus;
}
export function initialOfferStatus(offeredKurus: number, listKurus: number): Extract<OfferStatus, "onaylandi" | "onay_bekliyor"> {
  return isAutoApproved(offeredKurus, listKurus) ? "onaylandi" : "onay_bekliyor";
}
