import { buildReaderData } from './server';
import { SLOTS } from './registry';
import { pickData } from './reader';
import type { ReaderData } from './types';

export function defaultData(prefixes?: string[]): ReaderData {
  const data = buildReaderData({}, false, new Date().getFullYear());
  return prefixes ? pickData(data, [...prefixes, 'site.']) : data;
}

export function sentinelData(prefixes: string[]): ReaderData {
  const data = defaultData(prefixes);
  const values: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(data.values)) {
    const def = SLOTS[key];
    if (def.kind === 'text') values[key] = `⟦${key}⟧`;
    else if (def.kind === 'rich') values[key] = `<p>⟦${key}⟧</p>`;
    else if (def.kind === 'image') values[key] = { ...(v as object), alt: `⟦${key}⟧` };
    else
      values[key] = (v as Record<string, unknown>[]).map((item) => {
        const out: Record<string, unknown> = { ...item };
        for (const [field, f] of Object.entries(def.fields ?? {})) {
          if (f.kind === 'text') out[field] = `⟦${key}:${item.id}.${field}⟧`;
          if (f.kind === 'rich') out[field] = `<p>⟦${key}:${item.id}.${field}⟧</p>`;
        }
        return out;
      });
  }
  return { ...data, values };
}

const IGNORE = /^[\s\d.,:;·•–—\-+/()%&'"“”‘’!?…]*$/;

/** Görünür metin düğümlerinden slot'tan gelmeyenleri döndürür. */
export function uncoveredText(root: HTMLElement): string[] {
  const out: string[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || el.closest('script,style,svg,[aria-hidden="true"],[data-edit-ignore]')) continue;
    const rest = (node.textContent ?? '').replace(/⟦[^⟧]+⟧/g, '').trim();
    if (rest && !IGNORE.test(rest)) out.push(rest);
  }
  return out;
}
