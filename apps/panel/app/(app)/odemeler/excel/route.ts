import { NextResponse, type NextRequest } from "next/server";
import { buildPaymentMatrix } from "@/lib/payment-matrix";
import { buildPaymentsWorkbook, workbookToBuffer } from "@/lib/payments-excel";
import {
  filterRows,
  PAYMENT_FILTERS,
  PAYMENT_STUDENTS_SELECT,
  resolveScope,
  seasonsOf,
  studentsInScope,
  todayInIstanbul,
  type PaymentStudent,
} from "@/lib/payments-scope";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Ödemeler ekranında görünen tabloyu (aynı sezon, arama ve filtreyle) .xlsx olarak indirir. RLS: oturumlu personel. */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getSessionProfile();
  if (profile.role === "ogretmen") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data, error } = await supabase.from("students").select(PAYMENT_STUDENTS_SELECT);
  if (error) {
    console.error("[odemeler/excel] okunamadı:", error.code);
    return NextResponse.json({ error: "Ödeme bilgileri okunamadı" }, { status: 500 });
  }

  const students = (data ?? []) as unknown as PaymentStudent[];
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const scope = resolveScope(params, seasonsOf(students));
  const today = todayInIstanbul();
  const matrix = buildPaymentMatrix(studentsInScope(students, scope), today, scope.season);
  const rows = filterRows(matrix.rows, scope.filter, today.slice(0, 7));

  const book = buildPaymentsWorkbook({
    season: scope.season,
    months: matrix.months,
    rows,
    phoneById: new Map(students.map((s) => [s.id, s.phone])),
    generatedOn: today,
    filterLabel: PAYMENT_FILTERS[scope.filter],
  });
  const fileName = `odemeler-${scope.season || "sezon"}-${today}.xlsx`.replace(/[^A-Za-z0-9._-]/g, "-");

  return new NextResponse(new Uint8Array(workbookToBuffer(book)), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
