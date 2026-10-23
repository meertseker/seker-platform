// Reklam sayfası yayın ön kontrolü (Z3). Saf modül: panel metin yazmaz, yalnız kontrol eder.
import {
  AD_HEADLINE_MAX,
  AD_PRIMARY_TEXT_MAX,
  LP_MEDIA_OPTIONS,
  slugError,
  type LandingFields,
} from "@seker/shared/landing";
import { checkText } from "@/lib/content/checks";
import type { LandingPageRow } from "./store";

export type FieldCheck = { label: string; summary: string; count: string | null; ok: boolean; message: string };

const TITLE_MIN = 10;
const OK = "Kontrol geçti";
const AD_EMPTY = "Boş · Instagram reklamı için gerekir";
const MEDIA_DEFAULT = "Seçilmedi · varsayılan fotoğraf kullanılır";

/** Yalnız yasaklı ifade kontrolü (uzunluk sınırı yok). */
function bannedOnly(text: string, banned: string[]) {
  return checkText(text, { max: Number.POSITIVE_INFINITY, min: 0, banned });
}

function adCheck(label: string, text: string, max: number, banned: string[]): FieldCheck {
  const count = `${text.length} / ${max}`;
  if (!text.trim()) return { label, summary: "", count, ok: true, message: AD_EMPTY };
  const r = checkText(text, { max, min: 0, banned });
  return { label, summary: text, count, ok: r.ok, message: r.message };
}

export function pageFieldChecks(fields: LandingFields, opts: { banned: string[]; pageTitleMax: number }): FieldCheck[] {
  const { banned, pageTitleMax } = opts;
  const out: FieldCheck[] = [];

  const title = checkText(fields.h1, { max: pageTitleMax, min: TITLE_MIN, banned });
  out.push({ label: "Başlık", summary: fields.h1, count: `${fields.h1.length} / ${pageTitleMax}`, ok: title.ok, message: title.message });

  const sub = bannedOnly(fields.subhead, banned);
  out.push({ label: "Alt başlık", summary: fields.subhead, count: null, ok: sub.ok, message: sub.message });

  const badBlock = fields.bodyBlocks.map((b) => bannedOnly(`${b.heading}\n${b.text}`, banned)).find((r) => !r.ok);
  out.push({
    label: "Bloklar",
    summary: `${fields.bodyBlocks.length} blok`,
    count: null,
    ok: !badBlock,
    message: badBlock ? badBlock.message : OK,
  });

  out.push(adCheck("Reklam cümlesi", fields.adPrimaryText, AD_PRIMARY_TEXT_MAX, banned));
  out.push(adCheck("Reklam başlığı", fields.adHeadline, AD_HEADLINE_MAX, banned));

  const media = fields.mediaKey ? LP_MEDIA_OPTIONS.find((o) => o.key === fields.mediaKey) : undefined;
  out.push(
    media
      ? { label: "Görsel", summary: media.label, count: null, ok: true, message: OK }
      : // Engel değil: web sayfası varsayılan fotoğrafa (bahçe atölyeleri) düşer.
        { label: "Görsel", summary: "", count: null, ok: true, message: MEDIA_DEFAULT },
  );

  const allText = [
    fields.h1,
    fields.subhead,
    ...fields.bodyBlocks.flatMap((b) => [b.heading, b.text]),
    fields.adPrimaryText,
    fields.adHeadline,
    fields.metaTitle,
    fields.metaDescription,
  ];
  const badAny = allText.map((t) => bannedOnly(t, banned)).find((r) => !r.ok);
  out.push({
    label: "Yasaklı ifade",
    summary: badAny ? "var" : "yok",
    count: null,
    ok: !badAny,
    message: badAny ? badAny.message : OK,
  });

  out.push({ label: "Form, çerez bandı, ölçüm kodları", summary: "şablondan hazır", count: null, ok: true, message: OK });
  return out;
}

/** Yayını engelleyen nedenler; boşsa yayınlanabilir. */
export function pagePublishBlockers(input: {
  kind: string;
  status: string;
  slug: string;
  current: Pick<LandingPageRow, "slug" | "publishedAt"> | null;
  slugTaken: boolean;
  fieldChecks: FieldCheck[];
}): string[] {
  const out: string[] = [];
  if (input.kind !== "sayfa") out.push("Bu içerik sayfa değil");
  if (input.status !== "onaylandi") out.push("Önce içerik onaylanmalı");
  const se = slugError(input.slug);
  if (se) out.push(se);
  if (input.current?.publishedAt && input.current.slug !== input.slug) out.push("Yayından sonra adres değişmez");
  if (input.slugTaken) out.push("Bu adres başka bir sayfada kullanılıyor");
  for (const c of input.fieldChecks) if (!c.ok) out.push(`${c.label}: ${c.message}`);
  return out;
}
