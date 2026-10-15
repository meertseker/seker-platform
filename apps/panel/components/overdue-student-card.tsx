import Link from "next/link";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ITEM_TYPES, label } from "@/lib/constants";
import { formatTRY } from "@/lib/money";
import { reminderMessage, type OverdueStudent } from "@/lib/overdue";
import { waMeUrl } from "@/lib/whatsapp";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

export function OverdueStudentCard({ student }: { student: OverdueStudent }) {
  const message = reminderMessage(student);
  const hasValidPhone = Boolean(student.phone && waMeUrl(student.phone));

  return (
    <li className="rounded-2xl border border-red-200 bg-destructive-soft p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={`/ogrenciler/${student.studentId}`} className="font-semibold text-foreground hover:underline">
            {student.studentName}
          </Link>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {student.items.map((item) => (
              <li key={item.installmentId} className="flex flex-wrap gap-x-2">
                <span>{label(ITEM_TYPES, item.itemType)}</span>
                <span>· vade {dateFormatter.format(new Date(`${item.dueDate}T12:00:00+03:00`))}</span>
                <span className="font-semibold text-red-700">· {item.daysOverdue} gün</span>
                <span className="tabular-nums">· {formatTRY(item.amountKurus)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-lg font-semibold tabular-nums text-foreground">{formatTRY(student.totalKurus)}</span>
          {hasValidPhone ? (
            <WhatsAppButton phone={student.phone!} message={message} />
          ) : (
            <Link href={`/ogrenciler/${student.studentId}`} className="text-sm font-medium text-muted-foreground underline">
              Telefon yok · öğrenci kartına ekle
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
