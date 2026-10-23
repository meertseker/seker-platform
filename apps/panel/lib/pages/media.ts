// Reklam sayfası görselinin sitedeki mutlak adresi (Paket C reklam görseli için de kullanır).
import { LP_MEDIA_OPTIONS, type LpMediaKey } from "@seker/shared/landing";
import { siteBaseUrl } from "./site";

export function mediaUrlFor(mediaKey: LpMediaKey): string {
  const option = LP_MEDIA_OPTIONS.find((o) => o.key === mediaKey);
  if (!option) throw new Error(`Bilinmeyen görsel: ${mediaKey}`);
  return `${siteBaseUrl()}${option.src}`;
}
