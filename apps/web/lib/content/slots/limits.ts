import { countChars } from '../chars';

/** Sınır kuralı: varsayılan metnin grafem uzunluğunun 1,5 katı, yukarı 10'a yuvarlanmış; başlıklarda en çok 120. */
export function limitFor(text: string, heading = false): number {
  const n = Math.ceil((countChars(text) * 1.5) / 10) * 10;
  return heading ? Math.min(Math.max(n, 10), 120) : Math.max(n, 10);
}

/** Bir listedeki en uzun varsayılan alan değerine göre sınır. */
export function limitForField(items: Record<string, unknown>[], field: string): number {
  return limitFor(items.reduce((longest, i) => (countChars(String(i[field])) > countChars(longest) ? String(i[field]) : longest), ''));
}

/** Meta açıklaması sınırı: 160; özgün metin daha uzunsa doldurulmuş uzunluğu 10'a yukarı yuvarlar (F2-T14a: metin aynen korunur). */
export function metaDescriptionMax(text: string): number {
  return Math.max(160, Math.ceil(countChars(text) / 10) * 10);
}
