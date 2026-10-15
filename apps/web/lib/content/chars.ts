import type { ReaderData } from './types';

const segmenter = new Intl.Segmenter('tr', { granularity: 'grapheme' });

export function countChars(s: string): number {
  let n = 0;
  for (const _ of segmenter.segment(s)) n++;
  return n;
}

export function fillVars(s: string, vars: ReaderData['vars']): string {
  return s.replaceAll('{yilSayisi}', vars.yilSayisi).replaceAll('{kurulusYili}', vars.kurulusYili);
}
