/**
 * Velinin ödeme günü: "her ayın 16'sı" ya da "ay sonu". Ayrı bir alanda tutulmaz;
 * bekleyen aidat taksitlerinin vade gününden okunur, değiştirilince vadeler kaydırılır.
 */
export type PaymentDay = number | "son";

function lastDayOf(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Vadeyi aynı ay içinde verilen güne taşır ("son" = ayın son günü; 31 → Şubat'ta 28/29). */
export function applyPaymentDay(dueDate: string, day: PaymentDay) {
  const [year, month] = dueDate.split("-").map(Number);
  const last = lastDayOf(year, month);
  const target = day === "son" ? last : Math.min(day, last);
  return `${dueDate.slice(0, 7)}-${String(target).padStart(2, "0")}`;
}

/** Vadelerden ödeme günü: hepsi ayın son günüyse "son", yoksa en sık görülen gün. */
export function inferPaymentDay(dueDates: string[]): PaymentDay | null {
  if (dueDates.length === 0) return null;
  const allLast = dueDates.every((due) => {
    const [year, month, day] = due.split("-").map(Number);
    return day === lastDayOf(year, month);
  });
  if (allLast) return "son";
  const counts = new Map<number, number>();
  for (const due of dueDates) {
    const day = Number(due.slice(8, 10));
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

export function paymentDayLabel(day: PaymentDay | null) {
  if (day === null) return "Belirtilmedi";
  return day === "son" ? "Ay sonu" : `Her ayın ${day}. günü`;
}
