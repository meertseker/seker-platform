import { redirect } from "next/navigation";
import { PriceItemsEditor, type PriceItemRow } from "@/components/price-items-editor";
import { SiteEditorToggle } from "@/components/site-editor-toggle";
import { SeasonManager, type SeasonItem } from "@/components/season-manager";
import { WhatsappSettings, type WaOutboxView } from "@/components/whatsapp-settings";
import { getSessionProfile } from "@/lib/auth";
import type { Program } from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ayarlar" };

export const dynamic = "force-dynamic";

interface PriceListRow {
  id: string;
  season: string;
  is_active: boolean;
}

interface PriceListItemRow {
  program: Program;
  monthly_fee: number;
  registration_fee: number;
}

export default async function AyarlarPage() {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") redirect("/bugun");

  const supabase = await createServerSupabase();
  const { data: priceLists } = await supabase
    .from("price_lists")
    .select("id, season, is_active")
    .order("season", { ascending: false });

  const { data: staffRows } = await supabase
    .from("profiles")
    .select("id, full_name, can_edit_site")
    .eq("is_active", true)
    .order("full_name");
  const staff = (staffRows ?? []).map((s) => ({ id: s.id, fullName: s.full_name, canEditSite: s.can_edit_site }));

  const { data: waSettingRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["wa_enabled", "wa_group_id", "wa_group_name"]);
  const waSetting = new Map((waSettingRows ?? []).map((r) => [r.key, r.value as unknown]));
  const { data: outboxRows } = await supabase
    .from("wa_outbox")
    .select("id, status, created_at, sent_at, error, message")
    .in("status", ["gonderildi", "hata"])
    .order("created_at", { ascending: false })
    .limit(60);
  // Birleştirilen işlemler aynı mesajı paylaşır; ekranda bir kez görünsün.
  const seenMessages = new Set<string>();
  const waRecent: WaOutboxView[] = [];
  for (const r of outboxRows ?? []) {
    const key = r.status === "gonderildi" ? `${r.sent_at}|${r.message}` : r.id;
    if (seenMessages.has(key)) continue;
    seenMessages.add(key);
    waRecent.push({ id: r.id, status: r.status, createdAt: r.created_at, sentAt: r.sent_at, error: r.error, message: r.message });
    if (waRecent.length >= 10) break;
  }
  const { count: waFailed } = await supabase
    .from("wa_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "hata");

  const rows = (priceLists ?? []) as PriceListRow[];
  const seasons: SeasonItem[] = rows.map((row) => ({
    id: row.id,
    season: row.season,
    isActive: row.is_active,
  }));

  const activeList = rows.find((row) => row.is_active) ?? null;

  let activeItems: PriceItemRow[] = [];
  if (activeList) {
    const { data: items } = await supabase
      .from("price_list_items")
      .select("program, monthly_fee, registration_fee")
      .eq("price_list_id", activeList.id);

    activeItems = ((items ?? []) as PriceListItemRow[]).map((item) => ({
      program: item.program,
      monthlyFeeTl: Number(item.monthly_fee),
      registrationFeeTl: Number(item.registration_fee),
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Ayarlar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sezon ve fiyat listesi yönetimi burada yapılır.
        </p>
      </div>

      <SeasonManager seasons={seasons} />

      {activeList ? (
        <PriceItemsEditor priceListId={activeList.id} items={activeItems} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Fiyat düzenlemek için önce bir sezonu aktif yapın.
        </p>
      )}

      <SiteEditorToggle staff={staff} />

      <WhatsappSettings
        enabled={waSetting.get("wa_enabled") === true}
        groupId={typeof waSetting.get("wa_group_id") === "string" ? (waSetting.get("wa_group_id") as string) : ""}
        groupName={typeof waSetting.get("wa_group_name") === "string" ? (waSetting.get("wa_group_name") as string) : ""}
        recent={waRecent}
        failedCount={waFailed ?? 0}
      />
    </div>
  );
}
