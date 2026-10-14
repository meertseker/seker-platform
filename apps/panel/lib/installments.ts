export interface InstallmentDraft { dueDate: string; amountKurus: number }

/** ISO tarihe ay ekler; hedef ayda gün yoksa ayın son gününe kırpar (31 Oca + 1 ay -> 28 Şub). */
export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Toplamı eşit böler; kuruş farkı SON taksite eklenir (spec §12). */
export function generateInstallments(totalKurus: number, count: number, firstDueDate: string): InstallmentDraft[] {
  if (count < 1 || totalKurus <= 0) throw new Error("Geçersiz plan parametreleri");
  const base = Math.floor(totalKurus / count);
  const remainder = totalKurus - base * count;
  return Array.from({ length: count }, (_, i) => ({
    dueDate: addMonthsClamped(firstDueDate, i),
    amountKurus: i === count - 1 ? base + remainder : base,
  }));
}

/** Kısmi ödemede kalan için, orijinal vadeyi devralan taksit (spec §6.3). */
export function remainderInstallment(
  original: InstallmentDraft, paidKurus: number
): InstallmentDraft {
  const remaining = original.amountKurus - paidKurus;
  if (remaining <= 0) throw new Error("Kalan tutar yok");
  return { dueDate: original.dueDate, amountKurus: remaining };
}
