// Tek seferlik Meta kurulumunun kimlikleri (K18, app_settings.reklam_kurulum).
// Tohum "{}"tır; dört kimlik yoksa kurulum yapılmamış sayılır.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdSetup = {
  testCampaignId: string;
  testAdsetId: string;
  scaleCampaignId: string;
  scaleAdsetId: string;
  exclusionAudienceId: string | null;
  createdAt: string;
  createdBy: string;
};

export const AD_SETUP_KEY = "reklam_kurulum";

const META_ID = /^\d{1,30}$/;

function metaId(value: unknown): string | null {
  return typeof value === "string" && META_ID.test(value) ? value : null;
}

/** Kayıttaki kurulumu okur; dört kimlikten biri eksik ya da bozuksa null. */
export function parseAdSetup(value: unknown): AdSetup | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const testCampaignId = metaId(v.testCampaignId);
  const testAdsetId = metaId(v.testAdsetId);
  const scaleCampaignId = metaId(v.scaleCampaignId);
  const scaleAdsetId = metaId(v.scaleAdsetId);
  if (!testCampaignId || !testAdsetId || !scaleCampaignId || !scaleAdsetId) return null;
  return {
    testCampaignId,
    testAdsetId,
    scaleCampaignId,
    scaleAdsetId,
    exclusionAudienceId: metaId(v.exclusionAudienceId),
    createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
    createdBy: typeof v.createdBy === "string" ? v.createdBy : "",
  };
}

/** Kurulumu okur; yapılmamışsa null. */
export async function getAdSetup(supabase: SupabaseClient): Promise<AdSetup | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", AD_SETUP_KEY).maybeSingle();
  return parseAdSetup((data as { value?: unknown } | null)?.value);
}
