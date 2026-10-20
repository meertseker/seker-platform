import { fillVars } from './chars';
import type { ImageValue, ListItem, Reader, ReaderData } from './types';

export function makeReader(data: ReaderData): Reader {
  const get = (key: string): unknown => {
    if (!(key in data.values)) throw new Error(`İçerik anahtarı tanımsız: ${key}`);
    return data.values[key];
  };
  const fieldMeta = (key: string, path?: string) => {
    const meta = data.meta[key];
    if (!path) return { kind: meta.kind as string, max: meta.max, optional: meta.optional };
    const field = path.split('.').slice(1).join('.');
    const f = meta.fields?.[field];
    return { kind: f?.kind ?? 'text', max: f?.max, optional: f?.optional };
  };

  return {
    editing: data.editing,
    text: (key) => fillVars(String(get(key)), data.vars),
    rich: (key) => fillVars(String(get(key)), data.vars),
    fill: (s) => fillVars(s, data.vars),
    image: (key) => get(key) as ImageValue,
    list: <T extends ListItem>(key: string) => get(key) as T[],
    attrs(key, path): Record<string, string> {
      if (!data.editing) return {};
      const { kind, max, optional } = fieldMeta(key, path);
      const out: Record<string, string> = { 'data-edit-key': key, 'data-edit-kind': kind };
      if (max) out['data-edit-max'] = String(max);
      if (optional) out['data-edit-optional'] = '1';
      if (path) out['data-edit-path'] = path;
      return out;
    },
    listAttrs(key): Record<string, string> {
      if (!data.editing) return {};
      return { 'data-edit-list': key, 'data-edit-label': data.meta[key].label };
    },
  };
}

export function pickData(data: ReaderData, prefixes: string[]): ReaderData {
  const keep = (k: string) => prefixes.some((p) => k.startsWith(p));
  const filter = <V,>(rec: Record<string, V>) =>
    Object.fromEntries(Object.entries(rec).filter(([k]) => keep(k))) as Record<string, V>;
  return { ...data, values: filter(data.values), updatedAt: filter(data.updatedAt), meta: filter(data.meta) };
}
