import { NextResponse, type NextRequest } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { reportFile } from "@/lib/report/export";
import { loadReport } from "@/lib/report/load";
import { resolvePeriod } from "@/lib/report/period";
import { createServerSupabase } from "@/lib/supabase/server";
import { requestClock } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * Rapor indirme: `?bolum=<bölüm|tum>&bicim=xlsx|csv` + ekrandaki dönem parametreleri.
 * Ekranla aynı rol süzgeci: danışmanın isteğinde yönetici bölümleri dosyaya girmez (istenirse 404). Öğretmen 403.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getSessionProfile();
  if (profile.role === "ogretmen") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const bicim = params.bicim === "csv" ? "csv" : "xlsx";
  const bolum = params.bolum || "tum";
  const { now, today } = await requestClock();
  const period = resolvePeriod(params, today);

  let file;
  try {
    const report = await loadReport(supabase, { period, now, viewer: { id: profile.id, role: profile.role } });
    file = reportFile(report, bolum, bicim, today);
  } catch (error) {
    console.error("[rapor/indir] okunamadı:", error instanceof Error ? error.message : "bilinmeyen");
    return NextResponse.json({ error: "Rapor şu an hazırlanamadı" }, { status: 500 });
  }
  if (!file) return NextResponse.json({ error: "Bölüm bulunamadı" }, { status: 404 });

  return new NextResponse(file.body as BodyInit, {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${file.fileName}"`,
      "cache-control": "no-store",
    },
  });
}
