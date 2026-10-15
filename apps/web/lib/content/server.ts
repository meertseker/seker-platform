import 'server-only';
import { cache } from 'react';
import { currentYear } from '@/lib/time';
import { getContent, isEditing, read } from './getContent';
import { SLOTS } from './registry';
import { sanitizeRich } from './sanitize';
import type { ContentMap, ListItem, ReaderData, SlotDef, SlotMeta } from './types';

/** Değeri kayıt tipine göre temizler: rich alanlar ve liste öğelerinin rich alanları sanitizeRich'ten geçer. */
function sanitizeSlot(def: SlotDef, v: unknown): unknown {
  if (def.kind === 'rich') return sanitizeRich(String(v), { allowHeadings: def.allowHeadings });
  if (def.kind !== 'list' || !def.fields || !Array.isArray(v)) return v;
  return (v as ListItem[]).map((item) => {
    const out: ListItem = { ...item };
    for (const [field, f] of Object.entries(def.fields ?? {})) {
      if (f.kind === 'rich' && typeof out[field] === 'string') {
        out[field] = sanitizeRich(out[field], { allowHeadings: def.allowHeadings });
      }
    }
    return out;
  });
}

export function buildReaderData(map: ContentMap, editing: boolean, year: number): ReaderData {
  const values: Record<string, unknown> = {};
  const updatedAt: Record<string, string> = {};
  const meta: Record<string, SlotMeta> = {};
  for (const [key, def] of Object.entries(SLOTS)) {
    const v = read<unknown>(map, key);
    values[key] = sanitizeSlot(def, v);
    if (map[key]) updatedAt[key] = map[key].updatedAt;
    const { kind, max, fields, label, warn, pattern, maxItems, fixedItems, newItem, allowHeadings } = def;
    meta[key] = { kind, max, fields, label, warn, pattern, maxItems, fixedItems, newItem, allowHeadings };
  }
  const founding = Number(values['site.foundingYear']) || 2011;
  return {
    values,
    updatedAt,
    meta,
    editing,
    vars: { yilSayisi: String(year - founding), kurulusYili: String(founding) },
  };
}

export const getReaderData = cache(async (): Promise<ReaderData> => {
  const [map, editing, year] = await Promise.all([getContent(), isEditing(), currentYear()]);
  return buildReaderData(map, editing, year);
});
