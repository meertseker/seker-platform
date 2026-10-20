import { z } from 'zod';
import { SLOTS } from './registry';
import { countChars, fillVars } from './chars';
import { SITE } from '@/lib/site';
import { richToText, sanitizeRich } from './sanitize';
import type { ContentKind, FieldDef, ReaderData } from './types';

type Vars = ReaderData['vars'];

/** Sınırlar {yilSayisi}/{kurulusYili} belirteçleri doldurulmuş değere göre ölçülür; kayıtta belirteç korunur. */
function currentVars(): Vars {
  return { yilSayisi: String(new Date().getFullYear() - SITE.foundingYear), kurulusYili: String(SITE.foundingYear) };
}

export type NormalizedEdit = { key: string; kind: ContentKind; value: unknown; baseUpdatedAt: string | null };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const editSchema = z.array(
  z.object({ key: z.string().max(130), value: z.unknown(), baseUpdatedAt: z.string().max(64).nullable() }),
).max(100);

function checkText(raw: unknown, max: number, label: string, vars: Vars, pattern?: string, optional?: boolean): Result<string> {
  if (typeof raw !== 'string') return { ok: false, error: `${label}: metin olmalı.` };
  let v = raw.replace(CONTROL, '');
  v = max > 300 ? v.replace(/\r\n?/g, '\n') : v.replace(/\s*[\r\n]+\s*/g, ' ');
  v = v.trim();
  // İsteğe bağlı alan boş kaydedilir (varsayılana dönmez); zorunlu alan boş kalamaz.
  if (!v) return optional ? { ok: true, value: '' } : { ok: false, error: `${label} boş bırakılamaz.` };
  const n = countChars(fillVars(v, vars));
  if (n > max) return { ok: false, error: `${label} en fazla ${max} karakter olabilir (şu an ${n}).` };
  if (pattern && !new RegExp(pattern).test(v)) return { ok: false, error: `${label} biçimi uygun değil.` };
  return { ok: true, value: v };
}

function checkRich(
  raw: unknown, max: number, label: string, vars: Vars, allowHeadings?: boolean, optional?: boolean,
): Result<string> {
  if (typeof raw !== 'string') return { ok: false, error: `${label}: metin olmalı.` };
  const html = sanitizeRich(raw, { allowHeadings });
  const n = countChars(fillVars(richToText(html), vars));
  if (!n) return optional ? { ok: true, value: '' } : { ok: false, error: `${label} boş bırakılamaz.` };
  if (n > max) return { ok: false, error: `${label} en fazla ${max} karakter olabilir (şu an ${n}).` };
  return { ok: true, value: html };
}

function checkImage(raw: unknown, label: string): Result<unknown> {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  const parsed = z
    .object({
      src: z
        .string()
        .refine((s) => (s.startsWith('/') && !s.startsWith('//')) || (!!base && s.startsWith(`${base}/site-images/`))),
      alt: z.string().trim().min(1).max(200),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      assetId: z.string().uuid().nullable(),
    })
    .safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: `${label}: fotoğraf bilgisi geçersiz.` };
}

function checkField(raw: unknown, f: FieldDef, vars: Vars, allowHeadings?: boolean): Result<unknown> {
  if (f.kind === 'text') return checkText(raw, f.max ?? 200, f.label, vars, undefined, f.optional);
  if (f.kind === 'rich') return checkRich(raw, f.max ?? 5000, f.label, vars, allowHeadings, f.optional);
  if (f.kind === 'image') return checkImage(raw, f.label);
  return typeof raw === 'boolean' ? { ok: true, value: raw } : { ok: false, error: `${f.label}: evet/hayır olmalı.` };
}

export function validateEdits(
  edits: unknown,
  vars: Vars = currentVars(),
): { ok: true; edits: NormalizedEdit[] } | { ok: false; error: string; key?: string } {
  const parsed = editSchema.safeParse(edits);
  if (!parsed.success) return { ok: false, error: 'Geçersiz istek.' };
  const out: NormalizedEdit[] = [];
  for (const edit of parsed.data) {
    const def = SLOTS[edit.key];
    if (!def) return { ok: false, error: 'Bilinmeyen alan.', key: edit.key };
    if (edit.value === null) {
      out.push({ key: edit.key, kind: def.kind, value: null, baseUpdatedAt: edit.baseUpdatedAt });
      continue;
    }
    let r: Result<unknown>;
    if (def.kind === 'text') r = checkText(edit.value, def.max ?? 200, def.label, vars, def.pattern, def.optional);
    else if (def.kind === 'rich') r = checkRich(edit.value, def.max ?? 20000, def.label, vars, def.allowHeadings, def.optional);
    else if (def.kind === 'image') r = checkImage(edit.value, def.label);
    else
      r = checkList(
        edit.value,
        def.fields ?? {},
        def.maxItems ?? 50,
        def.label,
        vars,
        def.allowHeadings,
        def.fixedItems ? listIds(def.default) : undefined,
      );
    if (!r.ok) return { ok: false, error: r.error, key: edit.key };
    out.push({ key: edit.key, kind: def.kind, value: r.value, baseUpdatedAt: edit.baseUpdatedAt });
  }
  return { ok: true, edits: out };
}

/** Varsayılan listenin kimlikleri, sırasıyla (sabit listelerde sunucu bu sırayı korur). */
function listIds(v: unknown): string[] {
  return Array.isArray(v) ? v.map((i) => String((i as { id?: unknown } | null)?.id)) : [];
}

function checkList(
  raw: unknown,
  fields: Record<string, FieldDef>,
  maxItems: number,
  label: string,
  vars: Vars,
  allowHeadings?: boolean,
  fixedIds?: string[],
): Result<unknown> {
  if (!Array.isArray(raw)) return { ok: false, error: `${label}: liste olmalı.` };
  if (raw.length > maxItems) return { ok: false, error: `${label} en fazla ${maxItems} madde olabilir.` };
  const ids = new Set<string>();
  const order: string[] = [];
  const items: Record<string, unknown>[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { ok: false, error: `${label}: madde geçersiz.` };
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !/^[a-zA-Z0-9-]{1,40}$/.test(rec.id) || ids.has(rec.id))
      return { ok: false, error: `${label}: madde kimliği geçersiz.` };
    ids.add(rec.id);
    order.push(rec.id);
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      const f = fields[k];
      if (f) {
        const r = checkField(v, f, vars, allowHeadings);
        if (!r.ok) return r;
        next[k] = r.value;
      } else if (['string', 'boolean', 'number'].includes(typeof v)) next[k] = v;
      else return { ok: false, error: `${label}: madde geçersiz.` };
    }
    items.push(next);
  }
  if (fixedIds && (order.length !== fixedIds.length || fixedIds.some((id, i) => order[i] !== id)))
    return { ok: false, error: `${label} sabit bir listedir; madde eklenemez, silinemez veya taşınamaz.` };
  return { ok: true, value: items };
}
