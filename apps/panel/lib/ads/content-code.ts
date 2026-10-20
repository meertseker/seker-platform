/** Tam içerik kodu (web/DB ile aynı desen): R = reels, S = sayfa gönderisi; 4 rakam; tek büyük harf. */
export const CONTENT_CODE_RE = /^[RS]-\d{4}-[A-Z]$/;

/** Reklam adının başındaki kod; ardından ad sonu ya da ayraç (boşluk, ·, -, :, |) gelmeli. */
const LEADING_CODE_RE = /^([RS]-\d{4}-[A-Z])(?=$|[\s·\-:|])/;

/**
 * Reklam adından içerik kodunu çıkarır ("R-2645-A · Bir günümüz" → "R-2645-A").
 * Kodsuz ya da küçük harfli ad null döner; senkronu bozmaz.
 */
export function parseContentCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return LEADING_CODE_RE.exec(name)?.[1] ?? null;
}
