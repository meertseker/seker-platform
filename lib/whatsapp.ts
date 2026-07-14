import { normalizeTurkishPhone } from "@/lib/phone";

/**
 * Verilen telefon için wa.me click-to-chat linki üretir.
 * Telefon `normalizeTurkishPhone` ile doğrulanır; geçersizse null döner.
 */
export function waMeUrl(phone: string, message?: string): string | null {
  const normalized = normalizeTurkishPhone(phone);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
