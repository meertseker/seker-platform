import Link from "next/link";
import { OverdueStudentCard } from "@/components/overdue-student-card";
import { getSessionProfile } from "@/lib/auth";
import { formatTRY } from "@/lib/money";
import {
  groupOverdueByStudent,
  normalizeOverdueSort,
  overdueTotals,
  sortOverdue,
  type OverdueRow,
  type OverdueSort,
} from "@/lib/overdue";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SORT_LABELS: Record<OverdueSort, string> = { gun: "En çok geciken", tutar: "En yüksek tutar", isim: "İsim" };

export default async function GecikenlerPage({ searchParams }: { searchParams: SearchParams }) {
  await getSessionProfile();
  const params = await searchParams;
  const sortParam = Array.isArray(params.sirala) ? params.sirala[0] : params.sirala;
  const sort = normalizeOverdueSort(sortParam);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("v_overdue_installments")
    .select("installment_id, student_id, student_name, family_phone, due_date, amount, days_overdue, item_type, season")
    .order("due_date", { ascending: true });

  const students = sortOverdue(groupOverdueByStudent((data ?? []) as OverdueRow[]), sort);
  const totals = overdueTotals(students);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/odemeler" className="text-sm font-medium text-muted-foreground hover:underline">← Ödemeler</Link>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Gecikenler</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vadesi geçmiş, hâlâ bekleyen taksitler. WhatsApp düğmesi hazır bir hatırlatma metniyle kendi telefonunuzda açılır; göndermeden önce düzenleyebilirsiniz.
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          Geciken taksitler yüklenemedi. Sayfayı yenileyin; sorun sürerse yöneticiye haber verin.
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Toplam geciken</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatTRY(totals.totalKurus)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Öğrenci</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{totals.students}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Taksit</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{totals.installments}</p>
            </div>
          </section>

          <nav aria-label="Sıralama" className="flex flex-wrap gap-2">
            {(Object.keys(SORT_LABELS) as OverdueSort[]).map((key) => (
              <Link
                key={key}
                href={`/odemeler/gecikenler?sirala=${key}`}
                aria-current={key === sort ? "page" : undefined}
                className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  key === sort ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground hover:bg-muted"
                }`}
              >
                {SORT_LABELS[key]}
              </Link>
            ))}
          </nav>

          {students.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
              Geciken taksit yok.
            </p>
          ) : (
            <ul className="space-y-3">
              {students.map((student) => (
                <OverdueStudentCard key={student.studentId} student={student} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
