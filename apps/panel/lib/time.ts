import { connection } from "next/server";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";

/**
 * İsteğin anı. Sunucu bileşenleri ve rapor modülleri saati kendileri okumaz; tek giriş noktası burası.
 * `connection()` prerender'ı burada durdurur (Next 16: argümansız `new Date()` prerender'da hata verir).
 */
export async function requestNow(): Promise<Date> {
  await connection();
  return new Date();
}

/** İsteğin anı ve İstanbul takvimindeki bugünü (YYYY-MM-DD) birlikte. */
export async function requestClock(): Promise<{ now: Date; today: string }> {
  const now = await requestNow();
  return { now, today: istanbulDateString(now) };
}
