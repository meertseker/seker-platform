import { cacheLife } from 'next/cache';

/** Prerender'da argümansız new Date() yasak; yıl günde bir kez hesaplanıp önbelleğe alınır. */
export async function currentYear(): Promise<number> {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

export async function todayIso(): Promise<string> {
  'use cache';
  cacheLife('days');
  return new Date().toISOString();
}

export function fillYears(text: string, yearsActive: number): string {
  return text.replaceAll('{yilSayisi}', String(yearsActive));
}
