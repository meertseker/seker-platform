"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveContentDraft, submitContent } from "@/actions/content";
import { saveReelVideoMeta } from "@/actions/instagram";
import { CoverFramePicker } from "@/components/cover-frame-picker";
import { VideoUpload, type VideoMeta } from "@/components/video-upload";
import type { ReelMediaMeta } from "@/lib/content/media-meta";
import { checkText } from "@/lib/content/checks";
import { createDraftSaver, type DraftSaver, type SaveState } from "@/lib/content/draft-saver";
import { mergeDraft, tabLabel, visibleTasks } from "@/lib/content/task-flow";
import { PAGE_AD_FIELDS, PAGE_FIELDS, contentBlockers } from "@/lib/content/store";
import { PageMediaSelect } from "@/components/page-media-select";
import { PagePreviewButton } from "@/components/page-preview-button";
import type { ContentLimits } from "@/lib/content/settings";

export type FormTask = {
  id: string;
  kind: "reels" | "sayfa";
  platform: "google" | "instagram";
  header: string;
  due: string;
  overdue: boolean;
  topic: string;
  audience: string | null;
  brief: string | null;
  status: string;
  reviewNote: string | null;
  caption: string;
  pageFields: Record<string, string>;
  mediaPath: string | null;
  mediaMeta: VideoMeta | null;
  faceAnswer: boolean | null;
};

interface Props {
  firstName: string;
  tasks: FormTask[];
  banned: string[];
  limits: ContentLimits;
  videoMaxMb: number;
}

const SAVE_DELAY_MS = 1000;
const FACE_WARNING = "Bu video reklamda ve paylaşımda kullanılamaz. Yüzün görünmediği yeni bir çekim yükle.";
const SHOOTING_RULES = [
  "Dikey, 20–45 saniye",
  "İlk 2 saniyede konu söylenir",
  "Altyazı var (çoğu kişi sessiz izler)",
  "Son karede okulun karekodu",
];
// Sunucudaki contentBlockers ile aynı işlevi çağırır; reklam kuralları teslim kontrolünde kullanılmaz.
const NO_AD_RULES = { targetTl: 0, stopMultiple: 0, winMin: 0, noResultWeeks: 0 };

export function ContentTaskForm({ firstName, tasks: incoming, banned, limits, videoMaxMb }: Props) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(incoming[0]?.id ?? "");
  // Teslim edilen görev sunucu listesinden düşse de "Tamam"a basılana kadar teşekkür ekranı açık kalır.
  const [doneLines, setDoneLines] = useState<Record<string, string[]>>({});
  const [held, setHeld] = useState<Record<string, FormTask>>({});
  const [busy, setBusy] = useState(false);
  // Görev başına yerelde değiştirilen alanlar ve kaydedici: sekme değişince editör yeniden kurulsa da
  // yazılan metin, cevap ve video kaybolmaz; sayfa açılışındaki eski sunucu değeri üstüne yazmaz.
  const [local, setLocal] = useState<Record<string, Partial<Draft>>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const savers = useRef(new Map<string, DraftSaver>());
  const tasks = visibleTasks(incoming, held, doneLines);
  const active = tasks.find((t) => t.id === activeId) ?? tasks[0];
  const kindCount = (k: string) => tasks.filter((t) => t.kind === k).length;

  /** Görevin kaydedicisi; yalnız olay işleyicilerinde çağrılır. */
  const saverFor = useCallback((id: string): DraftSaver => {
    let saver = savers.current.get(id);
    if (!saver) {
      saver = createDraftSaver({
        save: (patch) => saveContentDraft(id, patch),
        delayMs: SAVE_DELAY_MS,
        onState: (st) => setSaveStates((m) => ({ ...m, [id]: st })),
      });
      savers.current.set(id, saver);
    }
    return saver;
  }, []);

  useEffect(() => {
    const map = savers.current;
    // Bağlantı gelince kaydedilemeyen yazı yeniden denenir.
    const online = () => map.forEach((s) => s.retry());
    // Kaydedilmemiş yazı varken sayfadan çıkılırken tarayıcı uyarır.
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if ([...map.values()].some((s) => s.hasUnsaved())) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
      // Panelde başka sayfaya geçilirken bekleyen yazı gönderilir.
      map.forEach((s) => void s.flush());
    };
  }, []);

  function switchTo(id: string) {
    // Bekleyen yazı hemen gönderilir; taslak yerelde durduğu için dönünce ekranda aynı görünür.
    if (active) void saverFor(active.id).flush();
    setActiveId(id);
  }

  function changeDraft(task: FormTask, fn: (d: Draft) => Partial<Draft>) {
    setLocal((l) => ({ ...l, [task.id]: { ...l[task.id], ...fn(mergeDraft(serverDraft(task), l[task.id])) } }));
  }

  function acknowledge(id: string) {
    const without = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id));
    setDoneLines(without);
    setHeld(without);
    // Görev düzeltmeyle geri dönerse sunucudaki (sıfırlanmış) değerler gösterilir.
    setLocal(without);
    setSaveStates(without);
    savers.current.delete(id);
    setActiveId("");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-4 pb-32">
      <header className="flex flex-col gap-1">
        <p className="text-[13px] text-muted-foreground">Merhaba {firstName}</p>
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Görevim</h1>
      </header>

      {!active ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-[15px] text-foreground">
          Bu hafta görevin yok. Yeni görev gelince burada görünür.
        </p>
      ) : null}

      {tasks.length > 1 ? (
        <div role="tablist" aria-label="Görevlerim" className="flex flex-wrap gap-1.5 rounded-xl bg-muted p-1">
          {tasks.map((t) => {
            const on = t.id === active?.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                disabled={busy}
                onClick={() => switchTo(t.id)}
                className={`min-h-11 flex-1 rounded-[9px] px-3 text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
                  on ? "bg-surface shadow-sm" : "bg-transparent"
                }`}
              >
                {tabLabel(t, kindCount(t.kind))}
              </button>
            );
          })}
        </div>
      ) : null}

      {active && doneLines[active.id] ? (
        <DoneScreen lines={doneLines[active.id]} onAcknowledge={() => acknowledge(active.id)} />
      ) : active ? (
        <TaskEditor
          key={active.id}
          task={active}
          draft={mergeDraft(serverDraft(active), local[active.id])}
          saveState={saveStates[active.id] ?? IDLE}
          saver={saverFor}
          onChange={(fn) => changeDraft(active, fn)}
          banned={banned}
          limits={limits}
          videoMaxMb={videoMaxMb}
          onBusyChange={setBusy}
          onDone={(lines) => {
            setHeld((h) => ({ ...h, [active.id]: active }));
            setDoneLines((d) => ({ ...d, [active.id]: lines }));
          }}
        />
      ) : null}
    </div>
  );
}

function DoneScreen({ lines, onAcknowledge }: { lines: string[]; onAcknowledge: () => void }) {
  return (
    <section className="flex flex-col gap-4 pt-4" aria-live="polite">
      <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h2 className="text-[26px] font-bold text-foreground">Teslim edildi, teşekkürler</h2>
      <ul className="overflow-hidden rounded-2xl border border-border bg-surface text-[15px]">
        {lines.map((line, i) => (
          <li key={line} className="flex gap-2.5 border-b border-border px-3.5 py-3 last:border-b-0">
            <span className={`font-bold ${i === 0 ? "text-accent" : "text-warning"}`} aria-hidden="true">
              {i === 0 ? "✓" : "…"}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Düzeltme istenirse görev sana geri döner ve bildirim gelir.
      </p>
      <button
        type="button"
        onClick={onAcknowledge}
        className="min-h-14 w-full rounded-[14px] bg-primary text-[17px] font-bold text-on-primary transition-colors hover:bg-primary-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Tamam
      </button>
    </section>
  );
}

type Draft = {
  caption: string;
  pageFields: Record<string, string>;
  mediaPath: string | null;
  mediaMeta: VideoMeta | null;
  faceAnswer: boolean | null;
};

const IDLE: SaveState = { state: "idle", error: null };

function serverDraft(task: FormTask): Draft {
  return {
    caption: task.caption,
    pageFields: task.pageFields,
    mediaPath: task.mediaPath,
    mediaMeta: task.mediaMeta,
    faceAnswer: task.faceAnswer,
  };
}

function TaskEditor({
  task,
  draft,
  saveState: { state: saveState, error: saveError },
  saver,
  onChange,
  banned,
  limits,
  videoMaxMb,
  onBusyChange,
  onDone,
}: {
  task: FormTask;
  draft: Draft;
  saveState: SaveState;
  /** Görevin kaydedicisi; yalnız olay işleyicilerinde çağrılır. */
  saver: (id: string) => DraftSaver;
  onChange: (fn: (d: Draft) => Partial<Draft>) => void;
  banned: string[];
  limits: ContentLimits;
  videoMaxMb: number;
  onBusyChange: (busy: boolean) => void;
  onDone: (lines: string[]) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  // Bu oturumda seçilen video (kapak karesi önizlemesi için); sayfa yenilenince yok.
  const [file, setFile] = useState<File | null>(null);
  // Video yokken "Altyazı ekledim" yalnız yerelde tutulur, yüklemede gönderilir.
  const [pendingSubtitled, setPendingSubtitled] = useState(false);
  const [reelError, setReelError] = useState<string | null>(null);
  const reel = draft.mediaMeta?.reel ?? null;
  const subtitled = reel ? reel.subtitled : pendingSubtitled;

  const isReels = task.kind === "reels";

  const busy = uploading || submitting;
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  function setCaption(value: string) {
    onChange(() => ({ caption: value }));
    saver(task.id).queue({ caption: value });
  }

  function setField(key: string, value: string) {
    const next = { ...draft.pageFields, [key]: value };
    onChange(() => ({ pageFields: next }));
    saver(task.id).queue({ pageFields: next });
  }

  /** K17 biçim bilgisini (kapak, altyazı) günceller; video yoksa yalnız yerel durum. */
  function updateReel(patch: Partial<Pick<ReelMediaMeta, "coverOffsetMs" | "subtitled">>) {
    if (!reel) {
      if (patch.subtitled !== undefined) setPendingSubtitled(patch.subtitled);
      return;
    }
    const next: ReelMediaMeta = { ...reel, ...patch };
    onChange((d) => (d.mediaMeta ? { mediaMeta: { ...d.mediaMeta, reel: next } } : {}));
    setReelError(null);
    void saveReelVideoMeta(task.id, next)
      .then((res) => {
        if ("error" in res) setReelError(res.error);
      })
      .catch(() => setReelError("Kaydedilemedi, bağlantını kontrol et"));
  }

  function setFace(answer: boolean) {
    onChange(() => ({ faceAnswer: answer }));
    // Yazıyla aynı sıradan, beklemeden gider; hata kayıt satırında görünür.
    const s = saver(task.id);
    s.queue({ faceAnswer: answer });
    void s.flush();
  }

  const blockers = useMemo(
    () =>
      contentBlockers(
        {
          kind: task.kind,
          caption: draft.caption,
          page_fields: draft.pageFields,
          media_path: draft.mediaPath,
          face_answer: draft.faceAnswer,
        },
        { banned, limits, rules: NO_AD_RULES },
      ),
    [task.kind, draft, banned, limits],
  );
  const ready = blockers.length === 0 && !uploading;

  async function submit() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setSubmitErrors([]);
    try {
      // Süren ve bekleyen kayıt sunucuya ulaşmadan teslim edilmez (sunucu eski metni kontrol ederdi).
      const saved = await saver(task.id).flush();
      if (!saved.ok) {
        setSubmitErrors([saved.error]);
        return;
      }
      const res = await submitContent(task.id);
      if ("ok" in res) {
        onDone(res.done);
      } else {
        setSubmitErrors(res.blockers?.length ? res.blockers : [res.error]);
      }
    } catch {
      setSubmitErrors(["Bağlantı yok, teslim edilemedi. Bağlantı gelince tekrar dene."]);
    } finally {
      setSubmitting(false);
    }
  }

  const reelsCheck = checkText(draft.caption, { max: limits.reelsCaption, min: limits.min, banned });

  return (
    <>
      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[12.5px] font-bold text-primary-strong">
            {task.header}
          </span>
          {task.due ? (
            <span className={`text-[13px] font-semibold ${task.overdue ? "text-destructive-strong" : "text-warning"}`}>
              {task.due}
            </span>
          ) : null}
        </div>
        <p className="text-[13px] text-muted-foreground">Bu haftanın konusu</p>
        <p className="text-[19px] font-bold text-foreground">{task.topic}</p>
        {task.audience || task.brief ? (
          <div className="text-sm leading-normal text-foreground">
            {task.audience ? (
              <p>
                <b>Kime:</b> {task.audience}
              </p>
            ) : null}
            {task.brief ? (
              <p>
                <b>Tek cümle:</b> {task.brief}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {task.status === "duzeltme" && task.reviewNote ? (
        <p role="status" className="rounded-xl bg-warning-soft px-3.5 py-3 text-sm font-semibold text-warning">
          Düzeltme istendi: {task.reviewNote}
        </p>
      ) : null}

      {isReels ? (
        <div className="flex flex-col gap-3">
          <section className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-3.5 text-sm">
            <h2 className="font-bold">Çekim kuralları</h2>
            {SHOOTING_RULES.map((r) => (
              <p key={r}>
                <span aria-hidden="true">✓ </span>
                {r}
              </p>
            ))}
            <p className="font-semibold text-destructive-strong">
              <span aria-hidden="true">✗ </span>Öğrenci yüzü ve adı yok (MEB kuralı). El, arkadan çekim, boş sınıf,
              öğretmen olur.
            </p>
          </section>

          <VideoUpload
            contentId={task.id}
            meta={draft.mediaMeta}
            hasVideo={!!draft.mediaPath}
            maxMb={videoMaxMb}
            subtitled={subtitled}
            disabled={submitting}
            onBusyChange={setUploading}
            onUploaded={(path, meta, chosen) => {
              setFile(chosen);
              // Yeni video eski cevabı kapsamaz; sunucu da aynı şekilde sıfırlar, kaydedilemeyen eski cevap gönderilmez.
              if (path !== draft.mediaPath) saver(task.id).drop("faceAnswer");
              onChange((d) => ({
                mediaPath: path,
                mediaMeta: meta,
                faceAnswer: path === d.mediaPath ? d.faceAnswer : null,
              }));
            }}
          />

          {draft.mediaPath && reel ? (
            <section className="rounded-2xl border border-border bg-surface p-3.5">
              <CoverFramePicker
                file={file}
                durationS={reel.durationS}
                valueMs={reel.coverOffsetMs}
                disabled={submitting || uploading}
                onChange={(ms) => updateReel({ coverOffsetMs: ms })}
              />
            </section>
          ) : null}

          <fieldset className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-3.5">
            <legend className="sr-only">Öğrenci yüzü ya da adı</legend>
            <p className="text-[15px] font-bold">Videoda ya da yazıda bir öğrencinin yüzü ya da adı var mı?</p>
            <div className="grid grid-cols-2 gap-2">
              {([true, false] as const).map((answer) => {
                const on = draft.faceAnswer === answer;
                return (
                  <button
                    key={String(answer)}
                    type="button"
                    aria-pressed={on}
                    disabled={submitting || uploading}
                    onClick={() => setFace(answer)}
                    className={`min-h-12 rounded-xl border-[1.5px] text-[15px] font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      on
                        ? answer
                          ? "border-destructive bg-destructive-soft"
                          : "border-accent bg-accent-soft"
                        : "border-input bg-surface"
                    }`}
                  >
                    {answer ? "Evet" : "Hayır"}
                  </button>
                );
              })}
            </div>
            {draft.faceAnswer === true ? (
              <p role="alert" className="rounded-[10px] bg-destructive-soft px-3 py-2.5 text-sm text-destructive-strong">
                {FACE_WARNING}
              </p>
            ) : null}
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold">
              <input
                type="checkbox"
                checked={subtitled}
                disabled={submitting || uploading}
                onChange={(e) => updateReel({ subtitled: e.target.checked })}
                className="h-5 w-5 flex-none accent-[var(--color-accent)]"
              />
              Altyazı ekledim
            </label>
            <p className="text-[12.5px] text-muted-foreground">Reklama girmesi için altyazı gerekir.</p>
            {reelError ? (
              <p role="alert" className="text-sm text-destructive-strong">
                {reelError}
              </p>
            ) : null}
          </fieldset>

          <TextBlock
            id={`aciklama-${task.id}`}
            label="Gönderinin açıklama yazısı"
            value={draft.caption}
            onChange={setCaption}
            rows={4}
            max={limits.reelsCaption}
            check={reelsCheck}
            note
            disabled={submitting}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {PAGE_FIELDS.map(({ key, label }) => {
            const value = draft.pageFields[key] ?? "";
            const isTitle = key === "baslik";
            const check = isTitle
              ? checkText(value, { max: limits.pageTitle, min: limits.min, banned })
              : value.trim() === ""
                ? null
                : checkText(value, { max: Number.POSITIVE_INFINITY, min: 0, banned });
            return (
              <TextBlock
                key={key}
                id={`${key}-${task.id}`}
                label={isTitle ? "Sayfa başlığı (Google reklamında da 1. başlık)" : label}
                value={value}
                onChange={(v) => setField(key, v)}
                rows={key.endsWith("_metin") ? 3 : 2}
                max={isTitle ? limits.pageTitle : undefined}
                check={check}
                note={isTitle}
                disabled={submitting}
              />
            );
          })}
          {task.platform === "instagram"
            ? PAGE_AD_FIELDS.map(({ key, label, max }) => {
                const value = draft.pageFields[key] ?? "";
                return (
                  <TextBlock
                    key={key}
                    id={`${key}-${task.id}`}
                    label={label}
                    value={value}
                    onChange={(v) => setField(key, v)}
                    rows={key === "adPrimaryText" ? 3 : 2}
                    max={max}
                    check={value.trim() === "" ? null : checkText(value, { max, min: 0, banned })}
                    disabled={submitting}
                  />
                );
              })
            : null}
          <PageMediaSelect
            value={draft.pageFields.mediaKey ?? null}
            onChange={(k) => setField("mediaKey", k)}
            disabled={submitting}
          />
          <PagePreviewButton contentId={task.id} flush={() => saver(task.id).flush()} />
          <p className="text-[12.5px] text-muted-foreground">
            Önizleme sitedeki gerçek görünümdür; adres ve yayın yöneticide.
          </p>
        </div>
      )}

      <div className="min-h-5 text-[13px] text-muted-foreground" aria-live="polite">
        {saveState === "saving" ? "Kaydediliyor…" : null}
        {saveState === "saved" ? "Kaydedildi" : null}
        {saveState === "error" ? <span className="text-destructive-strong">Kaydedilemedi: {saveError}</span> : null}
        {saveState === "idle" ? "Yazdıkların kendiliğinden kaydedilir; sonra devam edebilirsin." : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-5 pt-3 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-[34rem] flex-col gap-1.5">
          {submitErrors.length > 0 ? (
            <ul role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive-strong">
              {submitErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            disabled={!ready || submitting}
            onClick={() => void submit()}
            className="min-h-14 w-full rounded-[14px] bg-primary text-[17px] font-bold text-on-primary transition-colors hover:bg-primary-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-input disabled:hover:bg-input"
          >
            {submitting ? "Teslim ediliyor…" : uploading ? "Video yükleniyor…" : ready ? "Teslim et" : "Teslim için eksikleri tamamla"}
          </button>
          {isReels ? (
            <p className="text-center text-[12.5px] text-muted-foreground">
              Teslimden sonra yönetici onaylar ve Instagram&apos;da yayınlar; sen bir şey yapmazsın.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

function TextBlock({
  id,
  label,
  value,
  onChange,
  rows,
  max,
  check,
  note,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  max?: number;
  check: { ok: boolean; message: string } | null;
  note?: boolean;
  disabled?: boolean;
}) {
  const bad = check !== null && !check.ok;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-bold text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={bad}
        aria-describedby={`${id}-kontrol`}
        className={`rounded-xl border-[1.5px] bg-surface px-3 py-2.5 text-[15px] leading-snug text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          bad ? "border-destructive" : "border-input"
        }`}
      />
      <div id={`${id}-kontrol`} className="flex justify-between text-[13px]">
        <span className={`font-semibold ${bad ? "text-destructive-strong" : "text-accent"}`}>{check?.message ?? ""}</span>
        <span className="tabular-nums text-muted-foreground">{max ? `${value.length} / ${max}` : value.length}</span>
      </div>
      {note ? (
        <p className="text-[12.5px] text-muted-foreground">Metni sen yazarsın. Panel değiştirmez, sadece kontrol eder.</p>
      ) : null}
    </div>
  );
}
