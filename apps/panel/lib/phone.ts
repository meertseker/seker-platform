import { normalizeTurkishPhone } from "@seker/shared/phone";

export { normalizeTurkishPhone };

/** Ekranda okunur Türk cep numarası: "0532 555 41 20". Geçersiz numara olduğu gibi döner. */
export function formatTurkishPhone(raw: string): string {
  const normalized = normalizeTurkishPhone(raw);
  if (!normalized) return raw;
  const d = normalized.slice(3); // +90'dan sonraki 10 hane
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

/** Telefonu açan bağlantı (E.164). Geçersiz numarada null: düğme gösterilmez. */
export function telHref(raw: string): string | null {
  const normalized = normalizeTurkishPhone(raw);
  return normalized ? `tel:${normalized}` : null;
}
