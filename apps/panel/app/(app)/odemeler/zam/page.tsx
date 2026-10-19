import { redirect } from "next/navigation";
import { PriceIncreaseForm } from "@/components/price-increase-form";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

/** "2026-2027" -> Eylül 2026 … Haziran 2027 */
function seasonMonths(season: string) {
  const match = /^(\d{4})-(\d{4})$/.exec(season);
  if (!match) return [];
  const start = Number(match[1]);
  const keys = [9, 10, 11, 12]
    .map((m) => `${start}-${String(m).padStart(2, "0")}`)
    .concat([1, 2, 3, 4, 5, 6].map((m) => `${start + 1}-${String(m).padStart(2, "0")}`));
  return keys.map((value) => ({
    value,
    label: monthFormatter.format(new Date(`${value}-01T12:00:00+03:00`)),
  }));
}

export default async function PriceIncreasePage() {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") redirect("/odemeler");

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("price_lists")
    .select("season")
    .eq("is_active", true)
    .order("season", { ascending: false })
    .limit(1);
  const season = (data?.[0]?.season as string | undefined) ?? "";
  const months = seasonMonths(season);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Ödeme takibi</p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Toplu zam</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {season
            ? `${season} sezonunda tutarı henüz kesinleşmemiş aidat planları için.`
            : "Aktif sezon bulunamadı."}
        </p>
      </div>
      {months.length > 0 ? (
        <PriceIncreaseForm season={season} months={months} defaultMonth={`${season.slice(5)}-01`} />
      ) : null}
    </div>
  );
}
