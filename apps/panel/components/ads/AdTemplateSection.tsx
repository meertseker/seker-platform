// Z6 alt yarısı (sunucu): kampanya kurulum kartı (Ruling P3: şablonun üstünde) ve reklam şablonu formu.
// "Şimdi"yi okumaz; "Son değişiklik" kayıttaki updatedAt'ten biçimlenir.

import { getAdSetup } from "@/lib/ads/ad-setup";
import { getAdTemplate } from "@/lib/ads/ad-template";
import { templateUpdatedText } from "@/lib/ads/ad-template-form";
import { adsWriteEnabled } from "@/lib/ads/writes";
import { loadProfileNames } from "@/lib/queries/change-log";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdSetupCard } from "./AdSetupCard";
import { AdTemplateForm } from "./AdTemplateForm";

export async function AdTemplateSection() {
  const supabase = await createServerSupabase();
  const [template, setup] = await Promise.all([getAdTemplate(supabase), getAdSetup(supabase)]);

  let updatedBy: string | null = null;
  if (template.updatedBy) {
    try {
      updatedBy = (await loadProfileNames(supabase, [template.updatedBy])).get(template.updatedBy) ?? null;
    } catch {
      updatedBy = null; // ad okunamazsa yalnız tarih yazılır
    }
  }

  return (
    <div className="space-y-4">
      <AdSetupCard setup={setup} writeEnabled={adsWriteEnabled()} />
      <AdTemplateForm template={template} updatedText={templateUpdatedText(updatedBy, template.updatedAt)} />
    </div>
  );
}
