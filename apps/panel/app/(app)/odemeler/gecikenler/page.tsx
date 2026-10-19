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
import { fetchPaymentTraces } from "@/lib/queries/payment-traces";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gecikenler" };

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

  const sorted = sortOverdue(groupOverdueByStudent((data ?? []) as OverdueRow[]), sort);
  const traces = await fetchPaymentTraces(supabase, sorted.map((student) => student.studentId));
  const lastReminderOf = (studentId: string, ids: string[]) =>
    ids
      .flatMap((id) => traces.reminders.get(id) ?? [])
      .sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
  const withReminder = sorted.map((student) => ({
    student,
    lastReminder: lastReminderOf(student.studentId, student.items.map((item) => item.installmentId)),
  }));
  // Hatırlatılmamış veliler üstte; kendi içinde seçilen sıralama korunur.
  const ordered = [...withReminder.filter((entry) => !entry.lastReminder), ...withReminder.filter((entry) => entry.lastReminder)];
  const students = ordered.map((entry) => entry.student);
  const notReminded = withReminder.filter((entry) => !entry.lastReminder).length;
  const totals = overdueTotals(students);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/odemeler" className="text-sm font-medium text-muted-foreground hover:underline">← Ödemeler</Link>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Gecikenler</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vadesi geçmiş, hâlâ bekleyen ödemeler. Hatırlatılmamış veliler en üstte. “WhatsApp ile hatırlat” hazır mesajı telefonunuzda açar ve kimin ne zaman hatırlattığını kaydeder.
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
              <p className="mt-1 text-sm text-muted-foreground">{notReminded} veli henüz hatırlatılmadı</p>
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
              {ordered.map(({ student, lastReminder }) => (
                <OverdueStudentCard key={student.studentId} student={student} lastReminder={lastReminder} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
