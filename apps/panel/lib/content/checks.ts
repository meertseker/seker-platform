// Canlı metin kontrolleri (saf modül). Panel metin yazmaz, değiştirmez; yalnız kontrol eder.
import type { ContentKind } from "./codes";

export type CheckResult = { ok: boolean; message: string };

export type CheckOptions = { max: number; min: number; banned: string[] };

/** Varsayılan yasaklı ifadeler (ayar anahtarı `yasakli_ifadeler`). */
export const DEFAULT_BANNED_PHRASES = ["en iyi", "bir numara", "en güvenli", "garanti"];

export function checkText(text: string, opts: CheckOptions): CheckResult {
  const lower = text.toLocaleLowerCase("tr");
  for (const phrase of opts.banned) {
    const p = phrase.toLocaleLowerCase("tr");
    if (p && lower.includes(p)) {
      return { ok: false, message: `"${p}" kanıt ister, kullanılamaz` };
    }
  }
  if (text.length > opts.max) return { ok: false, message: `${opts.max} karakteri aştı` };
  if (text.trim().length < opts.min) return { ok: false, message: "Biraz daha yaz" };
  return { ok: true, message: "Kontrol geçti" };
}

/** Teslimi engelleyen nedenler; boşsa teslim edilebilir. Soru videoyu ve yazıyı kapsar (MEB Ek Madde 4). */
export function submissionBlockers(
  input: { kind: ContentKind; text: string; hasVideo: boolean; faceAnswer: boolean | null },
  opts: CheckOptions,
): string[] {
  const out: string[] = [];
  if (input.kind === "reels") {
    if (!input.hasVideo) out.push("Video yükle");
    if (input.faceAnswer === null) out.push("Yüz sorusunu cevapla");
    else if (input.faceAnswer) out.push("Öğrenci yüzü ya da adı olan içerik kullanılamaz");
  }
  const check = checkText(input.text, opts);
  if (!check.ok) out.push(check.message);
  return out;
}
