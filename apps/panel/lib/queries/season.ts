/**
 * Aktif sezon — tek kaynak. Sistemde aktif sezon, `price_lists.is_active = true` satırının `season` değeridir
 * (Ayarlar → sezon yöneticisi; yeni plan da bu sezonla açılır).
 *
 * Para toplamları (Rapor, Ödemeler özeti, Bugün kartı, Öğrenciler listesi) varsayılan olarak yalnız bu sezonun
 * planlarını sayar: geçmiş sezonun ödenmiş taksitleri bu yılın aylık rakamlarına karışmasın.
 * Gecikenler bilinçli olarak sezon ayırmaz (geçen sezondan kalan borç da takip edilir).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Aktif fiyat listesinin sezonu; okunamazsa ya da aktif liste yoksa null (null = sezon süzgeci yok). */
export async function fetchActiveSeason(db: SupabaseClient): Promise<string | null> {
  const { data, error } = await db.from("price_lists").select("season").eq("is_active", true).maybeSingle();
  if (error || !data) return null;
  const season = (data as { season: string | null }).season;
  return season ? season : null;
}

/** Satırın sezonu süzgeçten geçer mi. Süzgeç null ise (aktif sezon bilinmiyor) her satır geçer. */
export function inSeason(rowSeason: string | null | undefined, season: string | null): boolean {
  return season === null || rowSeason === season;
}
