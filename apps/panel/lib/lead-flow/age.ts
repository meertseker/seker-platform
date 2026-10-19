// Çocuk yaşı: yalnız doğum ayı ve yılı bilinir; ay geldiyse yaş dolmuş sayılır (İstanbul takvimi).
import { istanbulDateString } from "./business-hours";

export function ageFromBirth(month: number | null, year: number | null, now: Date): number | null {
  if (!month || !year || month < 1 || month > 12) return null;
  const [y, m] = istanbulDateString(now).split("-").map(Number);
  const age = y - year - (m < month ? 1 : 0);
  return age < 0 ? null : age;
}
