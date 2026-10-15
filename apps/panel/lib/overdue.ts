import { ITEM_TYPES, label, type ItemType } from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";

export interface OverdueRow {
  installment_id: string;
  student_id: string;
  student_name: string;
  family_phone: string | null;
  due_date: string;
  amount: number | string;
  days_overdue: number;
  item_type: ItemType;
  season: string;
}

export interface OverdueItem {
  installmentId: string;
  dueDate: string;
  amountKurus: number;
  itemType: ItemType;
  daysOverdue: number;
}

export interface OverdueStudent {
  studentId: string;
  studentName: string;
  phone: string | null;
  totalKurus: number;
  maxDaysOverdue: number;
  items: OverdueItem[];
}

export type OverdueSort = "gun" | "tutar" | "isim";
const SORTS: OverdueSort[] = ["gun", "tutar", "isim"];
const MAX_ITEMS_IN_MESSAGE = 3;

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

/** Geciken taksit satırlarını öğrenci kartlarına dönüştürür; kalemler en eski vadeden başlar. */
export function groupOverdueByStudent(rows: OverdueRow[]): OverdueStudent[] {
  const byStudent = new Map<string, OverdueStudent>();
  for (const r of rows) {
    const student =
      byStudent.get(r.student_id) ??
      { studentId: r.student_id, studentName: r.student_name, phone: r.family_phone, totalKurus: 0, maxDaysOverdue: 0, items: [] };
    const amountKurus = tlToKurus(Number(r.amount));
    student.items.push({ installmentId: r.installment_id, dueDate: r.due_date, amountKurus, itemType: r.item_type, daysOverdue: r.days_overdue });
    student.totalKurus += amountKurus;
    student.maxDaysOverdue = Math.max(student.maxDaysOverdue, r.days_overdue);
    if (!student.phone && r.family_phone) student.phone = r.family_phone;
    byStudent.set(r.student_id, student);
  }
  for (const student of byStudent.values()) {
    student.items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }
  return [...byStudent.values()];
}

export function normalizeOverdueSort(value: string | undefined): OverdueSort {
  return SORTS.includes(value as OverdueSort) ? (value as OverdueSort) : "gun";
}

export function sortOverdue(list: OverdueStudent[], sort: OverdueSort): OverdueStudent[] {
  const byName = (a: OverdueStudent, b: OverdueStudent) => a.studentName.localeCompare(b.studentName, "tr");
  const copy = [...list];
  if (sort === "tutar") return copy.sort((a, b) => b.totalKurus - a.totalKurus || byName(a, b));
  if (sort === "isim") return copy.sort(byName);
  return copy.sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue || byName(a, b));
}

export function overdueTotals(list: OverdueStudent[]): { students: number; installments: number; totalKurus: number } {
  return list.reduce(
    (acc, s) => ({ students: acc.students + 1, installments: acc.installments + s.items.length, totalKurus: acc.totalKurus + s.totalKurus }),
    { students: 0, installments: 0, totalKurus: 0 },
  );
}

function itemLabel(item: Pick<OverdueItem, "dueDate" | "itemType">): string {
  const month = monthFormatter.format(new Date(`${item.dueDate}T12:00:00+03:00`));
  return `${month} ${label(ITEM_TYPES, item.itemType)}`;
}

/** Veliye gönderilecek hazır WhatsApp metni. Öğretmen göndermeden önce düzenleyebilir. */
export function reminderMessage(input: {
  studentName: string;
  totalKurus: number;
  items: Pick<OverdueItem, "dueDate" | "itemType">[];
}): string {
  const shown = input.items.slice(0, MAX_ITEMS_IN_MESSAGE).map(itemLabel);
  const rest = input.items.length - shown.length;
  let list: string;
  if (rest > 0) list = `${shown.join(", ")} ve ${rest} ödeme daha`;
  else if (shown.length > 1) list = `${shown.slice(0, -1).join(", ")} ve ${shown[shown.length - 1]}`;
  else list = shown[0] ?? "";
  const noun = input.items.length > 1 ? "ödemelerinin" : "ödemesinin";
  return (
    `Merhaba, ${input.studentName} için ${list} ${noun} vadesi geçmiş görünüyor. ` +
    `Toplam: ${formatTRY(input.totalKurus)}. Ödemeyi yaptıysanız bu mesajı dikkate almayın. Teşekkür ederiz, Şeker Anaokulu`
  );
}

/** Tahsil edilenin vadesi gelene oranı (%). Vadesi gelen 0 ise null ("—" gösterilir). */
export function collectionRatePercent(paidKurus: number, dueKurus: number): number | null {
  if (dueKurus <= 0) return null;
  return Math.round((paidKurus / dueKurus) * 100);
}
