import { redirect } from "next/navigation";
import { PriceItemsEditor, type PriceItemRow } from "@/components/price-items-editor";
import { SiteEditorToggle } from "@/components/site-editor-toggle";
import { SeasonManager, type SeasonItem } from "@/components/season-manager";
import { getSessionProfile } from "@/lib/auth";
import type { Program } from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";

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
  if (profile.role !== "yonetici") redirect("/pipeline");

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
    </div>
  );
}
