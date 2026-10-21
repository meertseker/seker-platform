/**
 * Taksit "Geri al" onayı — saf fonksiyonlar. preview_installment_revert RPC'sinin
 * cevabını okur ve kullanıcıya neyin geri alınacağını tek cümleyle söyler.
 */
import { formatTRY, tlToKurus } from "@/lib/money";

export interface RevertPreview {
  /** odeme: panelden alınmış ödeme (olayıyla); ice_aktarma: olaysız (Excel / seed) ödenmiş satır. */
  kind: "odeme" | "ice_aktarma";
  totalTl: number;
  installmentCount: number;
  /** Ödemenin açtığı satır sayısı (kalan + ikinci yöntem). */
  createdCount: number;
  /** Kullanıcı bu geri almayı yapabilir mi (yönetici ya da 15 dk içinde kendi ödemesi). */
  allowed: boolean;
  /** Doluysa geri alma şu an yapılamaz; nedeni. */
  blocker: string | null;
}

export function parseRevertPreview(data: unknown): RevertPreview | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.kind !== "odeme" && d.kind !== "ice_aktarma") return null;
  const total = Number(d.totalTl);
  if (!Number.isFinite(total)) return null;
  return {
    kind: d.kind,
    totalTl: total,
    installmentCount: Number(d.installmentCount) || 1,
    createdCount: Number(d.createdCount) || 0,
    allowed: d.allowed === true,
    blocker: typeof d.blocker === "string" && d.blocker ? d.blocker : null,
  };
}

/** "14.495 ₺" (küsurat varsa "14.495,50 ₺"). */
function amountText(tl: number) {
  return formatTRY(tlToKurus(tl)).replace(/,00 ₺$/, " ₺");
}

export function revertConfirmText(preview: RevertPreview): string {
  const amount = amountText(preview.totalTl);
  if (preview.blocker) {
    return `Bu ödeme geri alınamaz: bu ödemeden sonra başka işlem yapılmış (${preview.blocker}). Önce sonraki işlemi geri alın.`;
  }
  if (!preview.allowed) return "Bu ödemeyi yalnız yönetici geri alabilir.";
  if (preview.kind === "ice_aktarma") {
    return `Bu işlem ${amount}'lik ödemeyi geri alır (içe aktarılan kayıt, 1 taksit). Taksit yeniden "bekliyor" olur.`;
  }
  const extra = preview.createdCount > 0 ? " Ödemeyle açılan kalan taksitler silinir." : "";
  return `Bu işlem ${amount}'lik ödemenin tamamını geri alır (${preview.installmentCount} taksit).${extra}`;
}
