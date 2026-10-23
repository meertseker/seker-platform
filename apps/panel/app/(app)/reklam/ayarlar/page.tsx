import type { Metadata } from "next";
import { AdSettingsForm } from "@/components/ad-settings-form";
import { ConnectionsCard } from "@/components/ads/ConnectionsCard";
import { loadConnections } from "@/lib/ads/connections-cache";
import { AdTemplateSection } from "@/components/ads/AdTemplateSection";
import { requireRole } from "@/lib/auth";
import { getAdSettings } from "@/lib/ads/ad-settings";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ayarlar ve hedefler" };
export const dynamic = "force-dynamic";

export default async function ReklamAyarlarPage() {
  await requireRole("yonetici");
  const supabase = await createServerSupabase();
  const settings = await getAdSettings(supabase);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Ayarlar ve hedefler</h1>
        <p className="mt-1 text-sm text-muted-foreground">Reklam kararlarında kullanılan hedef, kapı eşikleri, bütçe ve içerik kontrolleri.</p>
      </header>
      <ConnectionsCard snapshot={await loadConnections()} />
      <AdTemplateSection />
      <AdSettingsForm settings={settings} />
    </div>
  );
}
