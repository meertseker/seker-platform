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
import { paymentContextForCells } from "@/lib/payment-context";
import { PAYMENT_STUDENTS_SELECT, type PaymentStudent } from "@/lib/payments-scope";
import { FORMER_OVERDUE_VIEW, OVERDUE_VIEW } from "@/lib/queries/money";
import { fetchGorusmeler, type GorusmeWithAuthor } from "@/lib/queries/veli-gorusmeleri";
import { duePromisesFirst, latestByStudent, openPromises } from "@/lib/veli-gorusmesi";
import { STUDENT_STATUSES, label } from "@/lib/constants";
import { fetchPaymentTraces } from "@/lib/queries/payment-traces";
import { studentPanelColumns } from "@/lib/student-payment-panel";
import { requestClock } from "@/lib/time";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gecikenler" };

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SORT_LABELS: Record<OverdueSort, string> = { gun: "En çok geciken", tutar: "En yüksek tutar", isim: "İsim" };

export default async function GecikenlerPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getSessionProfile();
  const params = await searchParams;
  const { today } = await requestClock();
  const sortParam = Array.isArray(params.sirala) ? params.sirala[0] : params.sirala;
  const sort = normalizeOverdueSort(sortParam);

  const supabase = await createServerSupabase();
  const overdueColumns = "installment_id, student_id, student_name, family_phone, due_date, amount, days_overdue, item_type, season";
  const [{ data, error }, formerResult] = await Promise.all([
    supabase
      // Geciken tek tanımı: bekliyor, vadesi geçmiş, yalnız aktif öğrenci (görünüm süzer).
      .from(OVERDUE_VIEW)
      .select(overdueColumns)
      .order("due_date", { ascending: true }),
    // Eski öğrenci alacakları: ayrılan / mezun öğrencinin vadesi geçmiş bekleyen taksitleri (ayrı görünüm, 0023).
    supabase
      .from(FORMER_OVERDUE_VIEW)
      .select(`${overdueColumns}, student_status`)
      .order("due_date", { ascending: true }),
  ]);

  const sorted = sortOverdue(groupOverdueByStudent((data ?? []) as OverdueRow[]), sort);
  const formerRows = (formerResult.data ?? []) as (OverdueRow & { student_status: string })[];
  const formerStatus = new Map(formerRows.map((row) => [row.student_id, row.student_status]));
  const formerSorted = sortOverdue(groupOverdueByStudent(formerRows), sort);
  const studentIds = [...sorted, ...formerSorted].map((student) => student.studentId);
  const [traces, panelStudentsResult, gorusmeler] = await Promise.all([
    fetchPaymentTraces(supabase, studentIds),
    studentIds.length
      ? supabase.from("students").select(PAYMENT_STUDENTS_SELECT).in("id", studentIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    fetchGorusmeler(supabase, studentIds),
  ]);
  // Kartta son görüşme ve açık söz (öğrencinin son görüşmesi "söz verdi" ise).
  const lastGorusmeOf = latestByStudent(gorusmeler);
  const promiseOf = new Map<string, GorusmeWithAuthor>(openPromises(gorusmeler).map((row) => [row.student_id, row]));
  const promiseDateOf = (studentId: string) => promiseOf.get(studentId)?.promise_date ?? null;
  // Kart "Ödeme al"ı Ödemeler ekranındaki ay panelini açar: öğrencinin sütunları ve ödeme bağlamı.
  const panelOf = new Map(
    ((panelStudentsResult.data ?? []) as unknown as PaymentStudent[]).map((student) => {
      const columns = studentPanelColumns(student, today);
      return [
        student.id,
        {
          columns,
          payment: paymentContextForCells(
            columns.map((column) => column.cell),
            { id: student.id, phone: student.phone, fullName: student.full_name },
            traces,
          ),
          role: profile.role,
        },
      ] as const;
    }),
  );
  const lastReminderOf = (studentId: string, ids: string[]) =>
    ids
      .flatMap((id) => traces.reminders.get(id) ?? [])
      .sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
  const withReminder = sorted.map((student) => ({
    student,
    lastReminder: lastReminderOf(student.studentId, student.items.map((item) => item.installmentId)),
  }));
  // Söz günü gelmiş / geçmiş olanlar en üstte, sonra hatırlatılmamış veliler; kendi içinde seçilen sıralama korunur.
  const ordered = duePromisesFirst(
    [...withReminder.filter((entry) => !entry.lastReminder), ...withReminder.filter((entry) => entry.lastReminder)],
    (entry) => promiseDateOf(entry.student.studentId),
    today,
  );
  const formerOrdered = duePromisesFirst(
    formerSorted.map((student) => ({
      student,
      lastReminder: lastReminderOf(student.studentId, student.items.map((item) => item.installmentId)),
    })),
    (entry) => promiseDateOf(entry.student.studentId),
    today,
  );
  const formerTotals = overdueTotals(formerSorted);
  const panelFor = (studentId: string, phone: string | null, fullName: string) =>
    // Öğrenci satırı okunamazsa kart yine görünür (yalnız "Ödeme al" düğmesi çıkmaz).
    panelOf.get(studentId) ?? {
      columns: [],
      payment: paymentContextForCells([], { id: studentId, phone, fullName }, traces),
      role: profile.role,
    };
  const students = ordered.map((entry) => entry.student);
  const notReminded = withReminder.filter((entry) => !entry.lastReminder).length;
  const totals = overdueTotals(students);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/odemeler" className="text-sm font-medium text-muted-foreground hover:underline">← Ödemeler</Link>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">Gecikenler</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vadesi geçmiş, hâlâ bekleyen ödemeler. Söz günü gelmiş veliler ve hatırlatılmamış veliler en üstte. “WhatsApp ile hatırlat” hazır mesajı telefonunuzda açar ve kimin ne zaman hatırlattığını kaydeder.
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
                <OverdueStudentCard
                  key={student.studentId}
                  student={student}
                  lastReminder={lastReminder}
                  panel={panelFor(student.studentId, student.phone, student.studentName)}
                  lastGorusme={lastGorusmeOf.get(student.studentId) ?? null}
                  openPromise={promiseOf.get(student.studentId) ?? null}
                  today={today}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <section id="eski" className="scroll-mt-20 space-y-3 border-t border-border pt-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Eski öğrenci alacakları</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ayrılan ya da mezun olan öğrencilerin vadesi geçmiş, hâlâ bekleyen ödemeleri. Yukarıdaki geciken toplamına girmez.
          </p>
        </div>
        {formerResult.error ? (
          <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
            Eski öğrenci alacakları yüklenemedi. Sayfayı yenileyin.
          </p>
        ) : formerOrdered.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
            Eski öğrencilerden bekleyen alacak yok.
          </p>
        ) : (
          <>
            <p className="text-base text-foreground">
              {formerTotals.students} öğrenci · toplam{" "}
              <span className="font-semibold tabular-nums">{formatTRY(formerTotals.totalKurus)}</span>
            </p>
            <ul className="space-y-3">
              {formerOrdered.map(({ student, lastReminder }) => {
                const status = formerStatus.get(student.studentId);
                return (
                  <OverdueStudentCard
                    key={student.studentId}
                    student={student}
                    lastReminder={lastReminder}
                    panel={panelFor(student.studentId, student.phone, student.studentName)}
                    lastGorusme={lastGorusmeOf.get(student.studentId) ?? null}
                    openPromise={promiseOf.get(student.studentId) ?? null}
                    today={today}
                    statusLabel={status ? label(STUDENT_STATUSES, status) : undefined}
                  />
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
