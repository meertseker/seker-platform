/**
 * Ödeme hatalarında ne yapılacağını söyleyen metinler — tek yer. Sunucu eylemleri ve
 * pencereler aynı cümleleri kullanır.
 */
import { formatTRY } from "@/lib/money";

/** Ödenmiş taksitin tutarı "Düzenle" ile değişmez. */
export const PAID_AMOUNT_LOCKED =
  "Ödenmiş taksitin tutarı buradan değiştirilemez. Tutar, yöntem ya da tarih yanlış girildiyse öğrenci sayfasında Ödeme geçmişi → Ödemeyi düzelt.";

/** Önceki ödeme yanlışsa nereden düzeltileceği. */
export const ALREADY_PAID =
  "Seçilen taksitlerden biri zaten ödenmiş; sayfayı yenileyin. Önceki ödeme yanlış girildiyse Ödeme geçmişi → Ödemeyi düzelt.";

/** Bekleyen tek taksitin tutarı değişince kalem toplamı tutmaz. */
export function planTotalMismatchMessage(differenceKurus: number): string {
  const diff = formatTRY(Math.abs(differenceKurus));
  return differenceKurus < 0
    ? `Bu değişiklik kalemin toplamını ${diff} düşürür. Küsurat ya da indirimse taksitte "Kalanı kapat" kullanın; tutarı aylara yaymak için "Taksitlendir".`
    : `Bu değişiklik kalemin toplamını ${diff} artırır. Zam için Ödemeler → Toplu zam; ayrı bir ücretse Diğer işlemler → başka kalem ekle.`;
}

/** "Ödeme al"da girilen tutar seçilen taksitlerden fazla. */
export function overpaymentMessage(dueKurus: number): string {
  return `Ödenen tutar seçilen taksitlerin toplamını (${formatTRY(dueKurus)}) aşamaz. Fazlası sonraki ayların ödemesiyse o ayları da seçin; önceki bir ödeme yanlış girildiyse Ödeme geçmişi → Ödemeyi düzelt.`;
}
