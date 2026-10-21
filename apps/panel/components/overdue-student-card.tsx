import Link from "next/link";
import { PaymentPanelButton, PaymentPanelHost, type CellPaymentContext, type TraceDTO } from "@/components/payment-matrix-cell";
import { ReminderButton } from "@/components/reminder-button";
import { formatTRY } from "@/lib/money";
import { reminderMessage, type OverdueStudent } from "@/lib/overdue";
import { installmentLabel, shortDate } from "@/lib/payment-labels";
import type { Role } from "@/lib/role-access";
import { defaultPanelKey, type PanelColumn } from "@/lib/student-payment-panel";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

/**
 * Gecikenler kartı. "Ödeme al" Ödemeler ekranı ve öğrenci sayfasıyla aynı ay panelini açar
 * (en eski geciken ay; panelde diğer bekleyen aylara geçilir, kalanı kapat / düzelt oradan).
 */
export function OverdueStudentCard({
  student,
  lastReminder,
  panel,
}: {
  student: OverdueStudent;
  lastReminder: TraceDTO | null;
  panel: { columns: PanelColumn[]; payment: CellPaymentContext; role: Role };
}) {
  const message = reminderMessage(student);
  const ids = student.items.map((item) => item.installmentId);
  const firstOverdue = [...student.items].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const panelKey =
    (firstOverdue
      ? panel.columns.find((column) => column.cell.items.some((item) => item.installmentId === firstOverdue.installmentId))?.key
      : null) ?? defaultPanelKey(panel.columns);

  return (
    <PaymentPanelHost columns={panel.columns} payment={panel.payment} studentName={student.studentName} role={panel.role}>
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
            {panelKey ? <PaymentPanelButton columnKey={panelKey} /> : null}
            <ReminderButton studentId={student.studentId} installmentIds={ids} phone={student.phone} message={message} />
          </div>
        </div>
      </li>
    </PaymentPanelHost>
  );
}
