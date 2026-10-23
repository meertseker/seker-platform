"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CircleCheck, ExternalLink, Eye, Pencil, Upload } from "lucide-react";
import {
  AD_HEADLINE_MAX,
  AD_PRIMARY_TEXT_MAX,
  ARCHIVE_REDIRECT_PATH,
  LP_MEDIA_OPTIONS,
  slugError,
  type LandingFields,
  type LpMediaKey,
} from "@seker/shared/landing";
import {
  archiveLandingPage,
  loadPagePanel,
  publishLandingPage,
  updateLandingPageFields,
  type PagePanelData,
} from "@/actions/pages";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { formatDayTime } from "@/lib/lead-flow/business-hours";
import type { LandingPageStatus } from "@/lib/pages/store";
import { hostOf, publishStateLine, titleMaxFromChecks } from "@/lib/pages/view";

const btnPrimary =
  "inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
const fieldClass =
  "block w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";
const labelClass = "text-xs font-bold uppercase tracking-wide text-muted-foreground";

const PLATFORM_LABEL = { google: "Google", instagram: "Instagram" } as const;
const OK_MESSAGE = "Kontrol geçti";
const PHONE = { width: 390, height: 780 };
const DESKTOP = { width: 1280, height: 900 };
const PHONE_MAX_SCALE = 0.8;
const BLOCK_SLOTS = 3;
const LOAD_FAILED = "Sayfa bilgisi yüklenemedi. Sayfayı yenileyip tekrar deneyin.";

type View = "telefon" | "masaustu";
type Mode = "onizleme" | "duzenle";
type ActionError = { error: string; blockers?: string[] };

/** İçerik kartında reklam sayfasının önizleme, yayın, düzenleme ve arşiv paneli (Z3). */
export function PagePublishPanel({ contentId }: { contentId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<PagePanelData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("onizleme");
  const [pending, startTransition] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const reload = useCallback(async () => {
    let result: Awaited<ReturnType<typeof loadPagePanel>>;
    try {
      result = await loadPagePanel(contentId);
    } catch {
      setLoadError(LOAD_FAILED);
      return null;
    }
    if ("error" in result) {
      setLoadError(result.error);
      return null;
    }
    setLoadError(null);
    setData(result);
    return result;
  }, [contentId]);

  useEffect(() => {
    let alive = true;
    loadPagePanel(contentId)
      .then((result) => {
        if (!alive) return;
        if ("error" in result) setLoadError(result.error);
        else setData(result);
      })
      .catch(() => {
        if (alive) setLoadError(LOAD_FAILED);
      });
    return () => {
      alive = false;
    };
  }, [contentId]);

  function openSheet(next: Mode) {
    setMode(next);
    setWarning(null);
    setOpen(true);
    startTransition(async () => {
      await reload();
    });
  }

  function archive() {
    if (!data) return;
    if (!window.confirm(`${data.code} sayfası arşivlensin mi? Adres ${ARCHIVE_REDIRECT_PATH}'ya yönlenir.`)) return;
    setArchiveError(null);
    startTransition(async () => {
      const result = await archiveLandingPage(contentId);
      if ("error" in result) {
        setArchiveError(result.error);
        return;
      }
      toast({ text: result.warning ?? `${data.code} sayfası arşivlendi` });
      await reload();
      router.refresh();
    });
  }

  const status = data?.page?.status ?? null;
  const line = data ? publishStateLine(data.page, data.siteBase) : null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      {status === "yayinda" || status === "arsiv" ? (
        <p className="text-sm text-foreground">
          <b className={status === "yayinda" ? "text-accent" : "text-muted-foreground"}>{line?.split(" · ")[0]}</b>
          {" · "}
          {line?.split(" · ").slice(1).join(" · ")}
        </p>
      ) : null}
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}
      {archiveError ? (
        <p role="alert" className="text-sm text-destructive">
          {archiveError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {status === "yayinda" ? (
          <>
            <button type="button" className={btnSecondary} disabled={pending} onClick={() => openSheet("duzenle")}>
              <Pencil aria-hidden className="size-4" />
              Düzenle
            </button>
            <button type="button" className={btnSecondary} disabled={pending} onClick={archive}>
              <Archive aria-hidden className="size-4" />
              Sayfayı arşivle
            </button>
          </>
        ) : status === "arsiv" ? (
          <button type="button" className={btnSecondary} disabled={pending} onClick={() => openSheet("onizleme")}>
            <Upload aria-hidden className="size-4" />
            Yeniden yayınla
          </button>
        ) : (
          <button type="button" className={btnSecondary} disabled={pending && !data} onClick={() => openSheet("onizleme")}>
            <Eye aria-hidden className="size-4" />
            Sayfayı önizle ve yayınla
          </button>
        )}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        wide
        title="Sayfa önizleme ve yayın"
        description={data ? `${data.code} · Sayfa · ${PLATFORM_LABEL[data.platform]}` : undefined}
      >
        {data && loadError ? (
          <p role="alert" className="mb-4 rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive">
            {loadError}
          </p>
        ) : null}
        {data ? (
          <PanelBody
            key={`${data.page?.status ?? "yok"}-${data.page?.publishedAt ?? ""}`}
            contentId={contentId}
            data={data}
            mode={mode}
            onMode={setMode}
            warning={warning}
            onWarning={setWarning}
            reload={reload}
          />
        ) : (
          <p role={loadError ? "alert" : undefined} className={`text-sm ${loadError ? "text-destructive" : "text-muted-foreground"}`}>
            {loadError ?? "Yükleniyor…"}
          </p>
        )}
      </Sheet>
    </div>
  );
}

function PanelBody({
  contentId,
  data,
  mode,
  onMode,
  warning,
  onWarning,
  reload,
}: {
  contentId: string;
  data: PagePanelData;
  mode: Mode;
  onMode: (m: Mode) => void;
  warning: string | null;
  onWarning: (w: string | null) => void;
  reload: () => Promise<PagePanelData | null>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<View>("telefon");
  const [frameKey, setFrameKey] = useState(0);
  const status = data.page?.status ?? null;
  const published = !!data.page?.publishedAt;

  async function afterChange(nextWarning: string | null) {
    onWarning(nextWarning);
    await reload();
    setFrameKey((k) => k + 1);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-7">
      <div className={`flex min-w-0 flex-col gap-2 ${view === "telefon" ? "lg:w-[330px] lg:flex-none" : "lg:flex-[1_1_0]"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={labelClass}>Sitede böyle görünecek</p>
          <div role="group" aria-label="Önizleme görünümü" className="inline-flex rounded-xl bg-muted p-[3px]">
            {(
              [
                ["telefon", "Telefon"],
                ["masaustu", "Masaüstü"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={`min-h-11 cursor-pointer rounded-[10px] px-3.5 text-sm font-semibold ${
                  view === key ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <PreviewFrame key={frameKey} url={data.previewUrl} view={view} />
      </div>

      <div className="flex min-w-0 flex-[1_1_0] flex-col gap-4">
        {mode === "duzenle" && published ? (
          <EditForm
            contentId={contentId}
            data={data}
            onCancel={() => onMode("onizleme")}
            onSaved={async (w) => {
              toast({ text: w ?? `${data.code} sayfası kaydedildi` });
              onMode("onizleme");
              await afterChange(w);
            }}
          />
        ) : (
          <PublishForm
            contentId={contentId}
            data={data}
            status={status}
            warning={warning}
            onEdit={() => onMode("duzenle")}
            onPublished={async (w) => {
              toast({ text: `${data.code} sayfası yayında` });
              await afterChange(w);
            }}
          />
        )}
      </div>
    </div>
  );
}

function PreviewFrame({ url, view }: { url: string; view: View }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const size = view === "telefon" ? PHONE : DESKTOP;
  const scale =
    width > 0
      ? view === "telefon"
        ? Math.min(PHONE_MAX_SCALE, width / PHONE.width)
        : width / DESKTOP.width
      : 0;

  return (
    <div ref={boxRef} className="w-full">
      {scale > 0 ? (
        <div
          className={`relative mx-auto overflow-hidden bg-surface ${
            view === "telefon" ? "rounded-[1.75rem] border-[8px] border-foreground" : "rounded-xl border border-border"
          }`}
          style={{
            width: size.width * scale + (view === "telefon" ? 16 : 2),
            height: size.height * scale + (view === "telefon" ? 16 : 2),
          }}
        >
          <iframe
            src={url}
            title="Sayfa önizlemesi"
            className="absolute left-0 top-0 origin-top-left border-0"
            style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function CheckList({ checks }: { checks: PagePanelData["checks"] }) {
  return (
    <ul className="rounded-2xl border border-border px-4 py-1.5">
      {checks.map((c) => (
        <li
          key={c.label}
          className="flex items-start justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0"
        >
          <span className="min-w-0 break-words text-foreground">
            <b className="font-semibold">{c.label}</b>
            {c.summary ? ` · ${c.summary}` : ""}
          </span>
          {c.ok ? (
            <span
              className={`shrink-0 text-right text-[13px] font-semibold ${
                c.message === OK_MESSAGE ? "text-accent" : "text-warning"
              }`}
            >
              {c.message === OK_MESSAGE ? `${c.count ? `${c.count} ` : ""}✓` : `${c.count ? `${c.count} · ` : ""}${c.message}`}
            </span>
          ) : (
            <span className="shrink-0 text-right text-[13px] font-semibold text-destructive">
              {c.count ? `${c.count} · ` : ""}
              {c.message}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Blockers({ error }: { error: ActionError | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive">
      <p className="font-semibold">{error.error}</p>
      {error.blockers && error.blockers.length > 0 ? (
        <ul className="mt-1 list-disc pl-5">
          {error.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PublishForm({
  contentId,
  data,
  status,
  warning,
  onEdit,
  onPublished,
}: {
  contentId: string;
  data: PagePanelData;
  status: LandingPageStatus | null;
  warning: string | null;
  onEdit: () => void;
  onPublished: (warning: string | null) => Promise<void>;
}) {
  const [slug, setSlug] = useState(data.page?.slug ?? data.slugSuggestion);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = !!data.page?.publishedAt;
  const host = hostOf(data.siteBase);
  const slugMessage = slug ? slugError(slug) : slugError("");
  const slugId = "lp-adres";

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await publishLandingPage(contentId, slug);
      if ("error" in result) {
        setError(result);
        return;
      }
      await onPublished(result.warning);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={slugId} className={labelClass}>
          Sayfa adresi
        </label>
        <div className="flex min-w-0 items-stretch">
          <span className="flex shrink-0 items-center rounded-l-xl border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            <span className="max-w-[10rem] truncate sm:max-w-none">{host}/lp/</span>
          </span>
          <input
            id={slugId}
            type="text"
            value={slug}
            readOnly={locked}
            onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
            aria-invalid={!!slugMessage}
            aria-describedby={`${slugId}-hint${slugMessage ? ` ${slugId}-err` : ""}`}
            autoComplete="off"
            spellCheck={false}
            className={`min-h-11 min-w-0 flex-1 rounded-r-xl border border-input px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 ${
              locked ? "bg-muted text-muted-foreground" : "bg-surface text-foreground"
            }`}
          />
        </div>
        <p id={`${slugId}-hint`} className="text-[13px] text-muted-foreground">
          Başlıktan önerildi, değiştirilebilir. Yayından sonra adres değişmez (reklam bağlantısı buna bağlanır).
        </p>
        {slugMessage && !locked ? (
          <p id={`${slugId}-err`} className="text-[13px] font-semibold text-destructive">
            {slugMessage}
          </p>
        ) : null}
      </div>

      <CheckList checks={data.checks} />
      <Blockers error={error} />

      {status === "yayinda" && data.page?.slug ? (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
          <p className={`${labelClass} text-accent`}>Yayından sonra</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-[13px] font-semibold text-accent">
              <CircleCheck aria-hidden className="size-3.5" />
              Yayında
            </span>
            <a
              href={`${data.siteBase.replace(/\/+$/, "")}/lp/${data.page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 break-all font-semibold underline"
            >
              {host}/lp/{data.page.slug}
              <ExternalLink aria-hidden className="size-3.5 shrink-0" />
            </a>
            {data.page.publishedAt ? <span>· {formatDayTime(new Date(data.page.publishedAt))}</span> : null}
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 font-semibold text-accent underline"
            >
              <Pencil aria-hidden className="size-3.5" />
              Düzenle
            </button>
          </p>
          <p className={`text-[13px] ${warning ? "font-semibold text-warning" : "text-muted-foreground"}`}>
            {warning ?? "Sayfa 30 saniye içinde açılır."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 lg:mt-auto">
          <button
            type="button"
            className={`${btnPrimary} w-full`}
            disabled={pending || !data.canPublish || !!slugMessage}
            onClick={publish}
          >
            <Upload aria-hidden className="size-5" />
            {status === "arsiv" ? "Yeniden yayınla" : "Sayfayı yayınla"}
          </button>
          {!data.canPublish ? <p className="text-[13px] text-muted-foreground">Önce içeriği onaylayın</p> : null}
        </div>
      )}
    </>
  );
}

type Draft = Omit<LandingFields, "bodyBlocks"> & { bodyBlocks: { heading: string; text: string }[] };

function toDraft(fields: LandingFields): Draft {
  const blocks = fields.bodyBlocks.slice(0, BLOCK_SLOTS);
  while (blocks.length < BLOCK_SLOTS) blocks.push({ heading: "", text: "" });
  return { ...fields, bodyBlocks: blocks };
}

function Counter({ value, max }: { value: string; max: number | null }) {
  if (max == null) return null;
  return (
    <span className={`text-xs font-semibold ${value.length > max ? "text-destructive" : "text-muted-foreground"}`}>
      {value.length} / {max}
    </span>
  );
}

function EditForm({
  contentId,
  data,
  onCancel,
  onSaved,
}: {
  contentId: string;
  data: PagePanelData;
  onCancel: () => void;
  onSaved: (warning: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(data.fields));
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const titleMax = titleMaxFromChecks(data.checks);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setBlock(i: number, key: "heading" | "text", value: string) {
    setDraft((d) => ({ ...d, bodyBlocks: d.bodyBlocks.map((b, j) => (j === i ? { ...b, [key]: value } : b)) }));
  }

  function save() {
    setError(null);
    const fields: LandingFields = {
      ...draft,
      bodyBlocks: draft.bodyBlocks.filter((b) => b.heading.trim() || b.text.trim()),
      // Arama başlığı sayfa başlığını izliyorsa birlikte değişir.
      metaTitle: data.fields.metaTitle === data.fields.h1 ? draft.h1 : draft.metaTitle,
    };
    startTransition(async () => {
      const result = await updateLandingPageFields(contentId, fields);
      if ("error" in result) {
        setError(result);
        return;
      }
      await onSaved(result.warning);
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field id="lp-h1" label="Sayfa başlığı" counter={<Counter value={draft.h1} max={titleMax} />}>
        <input id="lp-h1" type="text" className={fieldClass} value={draft.h1} onChange={(e) => set("h1", e.target.value)} />
      </Field>
      <Field id="lp-sub" label="Alt başlık">
        <textarea id="lp-sub" rows={2} className={fieldClass} value={draft.subhead} onChange={(e) => set("subhead", e.target.value)} />
      </Field>
      {draft.bodyBlocks.map((b, i) => (
        <fieldset key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-semibold text-foreground">{i + 1}. blok</legend>
          <Field id={`lp-b${i}-h`} label="Başlık">
            <input
              id={`lp-b${i}-h`}
              type="text"
              className={fieldClass}
              value={b.heading}
              onChange={(e) => setBlock(i, "heading", e.target.value)}
            />
          </Field>
          <Field id={`lp-b${i}-t`} label="Metin">
            <textarea
              id={`lp-b${i}-t`}
              rows={3}
              className={fieldClass}
              value={b.text}
              onChange={(e) => setBlock(i, "text", e.target.value)}
            />
          </Field>
        </fieldset>
      ))}
      <Field
        id="lp-ad-text"
        label="Reklam cümlesi (Instagram'da görünür)"
        counter={<Counter value={draft.adPrimaryText} max={AD_PRIMARY_TEXT_MAX} />}
      >
        <textarea
          id="lp-ad-text"
          rows={3}
          className={fieldClass}
          value={draft.adPrimaryText}
          onChange={(e) => set("adPrimaryText", e.target.value)}
        />
      </Field>
      <Field id="lp-ad-head" label="Reklam başlığı" counter={<Counter value={draft.adHeadline} max={AD_HEADLINE_MAX} />}>
        <input
          id="lp-ad-head"
          type="text"
          className={fieldClass}
          value={draft.adHeadline}
          onChange={(e) => set("adHeadline", e.target.value)}
        />
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold text-foreground">Görsel</legend>
        {LP_MEDIA_OPTIONS.map((o) => (
          <label key={o.key} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-foreground">
            <input
              type="radio"
              name="lp-media"
              value={o.key}
              checked={draft.mediaKey === o.key}
              onChange={() => set("mediaKey", o.key as LpMediaKey)}
              className="size-5 shrink-0 accent-primary"
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <Blockers error={error} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className={`${btnPrimary} flex-1`} disabled={pending}>
          <Upload aria-hidden className="size-5" />
          Kaydet ve yeniden yayınla
        </button>
        <button type="button" className={btnSecondary} disabled={pending} onClick={onCancel}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  counter,
  children,
}: {
  id: string;
  label: string;
  counter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        {counter}
      </div>
      {children}
    </div>
  );
}
