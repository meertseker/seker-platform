import Link from "next/link";
import { PaymentButton } from "@/components/payment-dialog";
import type { TraceDTO } from "@/components/payment-matrix-cell";
import { ReminderButton } from "@/components/reminder-button";
import { formatTRY } from "@/lib/money";
import { reminderMessage, type OverdueStudent } from "@/lib/overdue";
import { installmentLabel, shortDate } from "@/lib/payment-labels";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

export function OverdueStudentCard({ student, lastReminder }: { student: OverdueStudent; lastReminder: TraceDTO | null }) {
  const message = reminderMessage(student);
  const ids = student.items.map((item) => item.installmentId);

  return (
    <li className="rounded-2xl border border-red-200 bg-destructive-soft p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/ogrenciler/${student.studentId}`} className="text-lg font-semibold text-foreground hover:underline">
              {student.studentName}
            </Link>
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                lastReminder ? "bg-surface text-muted-foreground ring-1 ring-inset ring-border" : "bg-red-700 text-white"
              }`}
            >
              {lastReminder
                ? `${shortDate(lastReminder.at)} hatırlatıldı · ${lastReminder.actorName ?? "Panel"}`
                : "Henüz hatırlatılmadı"}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-base text-foreground">
            {student.items.map((item) => (
              <li key={item.installmentId} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{installmentLabel(item.itemType, item.dueDate)}</span>
                <span className="text-muted-foreground">· vade {dateFormatter.format(new Date(`${item.dueDate}T12:00:00+03:00`))}</span>
                <span className="font-semibold text-red-700">· {item.daysOverdue} gün</span>
                <span className="tabular-nums">· {formatTRY(item.amountKurus)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <span className="text-xl font-semibold tabular-nums text-foreground sm:text-right">{formatTRY(student.totalKurus)}</span>
          <PaymentButton
            studentId={student.studentId}
            studentName={student.studentName}
            items={student.items.map((item) => ({
              id: item.installmentId,
              label: installmentLabel(item.itemType, item.dueDate),
              dueDate: item.dueDate,
              amountKurus: item.amountKurus,
              overdue: true,
            }))}
            preselect={ids}
          />
          <ReminderButton studentId={student.studentId} installmentIds={ids} phone={student.phone} message={message} />
        </div>
      </div>
    </li>
  );
}
