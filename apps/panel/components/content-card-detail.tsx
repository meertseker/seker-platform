"use client";

import { useState, useTransition, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import {
  approveContent,
  linkInstagramPost,
  moveContentStage,
  requestRevision,
  saveLearnedNote,
} from "@/actions/content";
import { PagePublishPanel } from "@/components/page-publish-panel";
import { AdTestPanel } from "@/components/ads/AdTestPanel";
import { useToast } from "@/components/toast";
import { ReelPublishPanel } from "@/components/reel-publish-panel";
import { InstagramPreview, ReelAutoChecks } from "@/components/reel-review-extras";
import type { ReelPanelContext } from "@/lib/content/reel-review";
import {
  adviceFor,
  canConfirmFace,
  formatTl,
  platformLabel,
  ruleBars,
  stageSince,
  type ActionKind,
  type BoardItem,
  type ContentPerf,
  type ReviewVideo,
  type Tone,
} from "@/lib/content/board";
import type { AdRules } from "@/lib/content/settings";
import { STAGES, type StageKey } from "@/lib/content/stages";
import { PAGE_FIELDS } from "@/lib/content/store";
import type { OrganicInfo } from "@/lib/content/organic";
import { dueLabel } from "@/lib/queries/content";
import { waMeUrl } from "@/lib/whatsapp";

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-accent",
  warn: "text-warning",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
};

export const TONE_BAR: Record<Tone, string> = {
  ok: "bg-accent",
  warn: "bg-warning",
  bad: "bg-destructive",
  neutral: "bg-primary",
};

interface Props {
  item: BoardItem;
  perf: ContentPerf;
  rules: AdRules;
  now: Date;
  videoUrl: string | null;
  /** Telefonda seçimden sonra odaklanılan başlık. */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** Organik Instagram sayıları (Task 7); verilmezse bölüm gösterilmez. */
  organic?: ReactNode;
  /** Instagram'a yayın bağlamı (Reklam Konsolu Paket B); null ise yayın paneli yok. */
  reel?: ReelPanelContext | null;
}

const nf = new Intl.NumberFormat("tr-TR");
const OFF_COPY: Record<Exclude<OrganicInfo["state"], "hazir">, string> = {
  baglanmadi: "Instagram bağlı değil",
  "baglanti-yok": "Gönderi bağlantısını ekleyin",
  bekliyor: "Sayılar yarın sabah gelir",
};

/** Organik Instagram sayıları ya da neden olmadığı. */
export function OrganicNumbers({ info }: { info: OrganicInfo }) {
  if (info.state !== "hazir" || !info.numbers) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-sm font-bold text-foreground">Organik sayılar</div>
        <p className="text-sm text-muted-foreground">{OFF_COPY[info.state === "hazir" ? "bekliyor" : info.state]}</p>
      </div>
    );
  }
  const n = info.numbers;
  const val = (v: number | null) => (v === null ? "—" : nf.format(v));
  const rows: [string, string][] = [
    ["İzlenme", val(n.views)],
    ["Erişim", val(n.reach)],
    ["Kaydetme", val(n.saved)],
    ["Paylaşım", val(n.shares)],
    ["Ortalama izlenme", n.avgWatchMs === null ? "—" : `${(n.avgWatchMs / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn`],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm font-bold text-foreground">Organik sayılar</div>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2 text-[13.5px] text-foreground">
          <span>{label}</span>
          <b className="shrink-0 tabular-nums">{value}</b>
        </div>
      ))}
      {info.lead ? <p className="text-sm text-muted-foreground">Aynı haftanın Reels&apos;leri arasında: {info.lead}</p> : null}
    </div>
  );
}

const FACE_CHECK = "Videoyu izledim; öğrenci yüzü ya da adı yok";
const AD_NOTE = "Reklamı Claude kurar ya da durdurur; Kampanyalar ekranından da yapılabilir.";

/** Eylem → aşama. Kampanya kurulmaz; yalnız kartın aşaması değişir. */
const MOVE_TO: Partial<Record<ActionKind, StageKey>> = { test: "test", stop: "arsiv", scale: "kazanan", archive: "arsiv" };
/** Önerinin dışında elle yapılabilecek geçişler (sunucudaki izinli geçişlerle aynı). */
const MANUAL_MOVES: Partial<Record<StageKey, { to: StageKey; label: string }[]>> = {
  organik: [{ to: "test", label: "Teste al" }, { to: "arsiv", label: "Arşive al" }],
  test: [{ to: "kazanan", label: "Büyütmeye taşı" }, { to: "arsiv", label: "Durdur ve arşive al" }],
  kazanan: [{ to: "arsiv", label: "Arşive al" }],
};
const AD_STAGES = new Set<StageKey>(["test", "kazanan"]);

const btnPrimary =
  "inline-flex min-h-14 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
const fieldClass =
  "block w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function remindLink(item: BoardItem, now: Date): string | null {
  if (!item.ownerPhone) return null;
  const due = dueLabel(item.dueAt, now);
  const message =
    `${firstName(item.ownerName)} Hocam, ${item.kind === "reels" ? "Reels" : "sayfa"} görevi panelde seni bekliyor: ${item.topic}.` +
    `${due ? ` ${due}.` : ""} Görevim ekranından açabilirsin.`;
  return waMeUrl(item.ownerPhone, message);
}

export function ContentCardDetail({ item, perf, rules, now, videoUrl, headingRef, organic, reel = null }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [faceChecked, setFaceChecked] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(item.learnedNote ?? "");
  const [permalink, setPermalink] = useState(item.igPermalink ?? "");
  const [reelJustApproved, setReelJustApproved] = useState(false);

  const advice = adviceFor(item, perf, rules, now);
  const stage = STAGES.find((s) => s.key === item.stage);
  const isGoogle = item.platform === "google";
  const showBars = AD_STAGES.has(item.stage) || (item.stage === "arsiv" && perf.spendKurus > 0);
  const bars = showBars ? ruleBars(perf, rules) : [];
  const hasNumbers = perf.spendKurus > 0 || perf.clicks > 0 || perf.leads > 0;

  function run(action: () => Promise<{ ok: true } | { error: string }>, done: string, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      after?.();
      toast({ text: done });
      router.refresh();
    });
  }

  function move(to: StageKey, label: string) {
    run(() => moveContentStage(item.id, to), `${item.code}: ${label}`);
  }

  const kind = advice.action.kind;
  const moveTarget = MOVE_TO[kind];
  const manual = (MANUAL_MOVES[item.stage] ?? []).filter((m) => m.to !== moveTarget);
  const remind = kind === "remind" ? remindLink(item, now) : null;
  const canApprove = item.kind === "sayfa" || faceChecked;

  return (
    <section
      aria-label={`${item.code} ayrıntısı`}
      className="flex flex-wrap gap-6 rounded-2xl border border-border bg-surface p-5"
    >
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5">
        <div className={`text-xs font-bold ${isGoogle ? "text-google" : "text-instagram"}`}>
          {item.code} · {platformLabel(item)}
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-2xl font-bold text-foreground break-words outline-none">{item.topic}</h2>
        <div className="text-sm text-muted-foreground">
          Aşama: <b className="text-foreground">{stage?.title}</b>
          {stageSince(item, now) ? ` · ${stageSince(item, now)}` : ""}
        </div>
        <div className="text-sm text-muted-foreground">
          Öğretmen: {item.ownerName}
          {item.audience ? ` · Kime: ${item.audience}` : ""}
        </div>
        {item.brief ? <div className="text-sm text-muted-foreground">Tek cümle: {item.brief}</div> : null}
        {item.status === "duzeltme" && item.reviewNote ? (
          <div className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">Düzeltme notu: {item.reviewNote}</div>
        ) : null}

        <div className="rounded-xl bg-background p-3 text-sm leading-relaxed text-foreground">
          <b>Panelin önerisi:</b> {advice.text}
        </div>

        {item.stage === "kontrol" ? (
          <ReviewBlock item={item} videoUrl={videoUrl} faceChecked={faceChecked} onFaceChecked={setFaceChecked} reel={reel} />
        ) : null}
        {item.kind === "sayfa" && (item.status === "teslim" || item.status === "onaylandi") ? <PagePublishPanel contentId={item.id} /> : null}

        <div className="flex flex-wrap gap-2">
          {kind === "approve" ? (
            <>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || !canApprove}
                onClick={() =>
                  run(
                    () => approveContent(item.id, { noStudentFaceOrName: faceChecked, submittedAt: item.submittedAt }),
                    `${item.code} onaylandı`,
                    () => item.kind === "reels" && setReelJustApproved(true),
                  )
                }
              >
                {item.kind === "reels" ? "Onayla ve yayına hazırla" : "Onayla"}
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={pending}
                aria-expanded={revisionOpen}
                onClick={() => setRevisionOpen((v) => !v)}
              >
                Düzeltme iste
              </button>
            </>
          ) : kind === "remind" ? (
            remind ? (
              <a href={remind} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                Hatırlat
              </a>
            ) : (
              <button type="button" className={btnPrimary} disabled>
                Hatırlat
              </button>
            )
          ) : moveTarget ? (
            <button
              type="button"
              className={btnPrimary}
              disabled={pending}
              onClick={() => move(moveTarget, advice.action.label)}
            >
              {advice.action.label}
            </button>
          ) : advice.action.label ? (
            <span className="inline-flex min-h-14 items-center rounded-xl bg-muted px-5 text-base font-semibold text-muted-foreground">
              {advice.action.label}
            </span>
          ) : null}
          <button
            type="button"
            className={btnSecondary}
            aria-expanded={noteOpen}
            onClick={() => setNoteOpen((v) => !v)}
          >
            Öğrenilen notu ekle
          </button>
        </div>

        <AdTestPanel item={item} />
        {kind === "remind" && !remind ? (
          <p className="text-sm text-muted-foreground">
            Öğretmenin telefonu kayıtlı değil; görev açılınca panel bildirimi gitti.
          </p>
        ) : null}

        {manual.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {manual.map((m) => (
              <button key={m.to} type="button" className={btnSecondary} disabled={pending} onClick={() => move(m.to, m.label)}>
                {m.label}
              </button>
            ))}
          </div>
        ) : null}

        {moveTarget || manual.length > 0 ? <p className="text-sm text-muted-foreground">{AD_NOTE}</p> : null}

        {revisionOpen ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="revision-note" className="text-sm font-medium text-foreground">
              Öğretmene ne düzeltilsin?
            </label>
            <textarea
              id="revision-note"
              rows={3}
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              maxLength={1000}
              className={fieldClass}
            />
            <p className="text-xs text-muted-foreground">Panel metni değiştirmez; düzeltmeyi öğretmen yapar.</p>
            <div>
              <button
                type="button"
                className={btnSecondary}
                disabled={pending || revisionNote.trim().length < 3}
                onClick={() =>
                  run(() => requestRevision(item.id, revisionNote), `${item.code} öğretmene geri gönderildi`, () =>
                    setRevisionOpen(false),
                  )
                }
              >
                Düzeltme iste
              </button>
            </div>
          </div>
        ) : null}

        {noteOpen ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="learned-note" className="text-sm font-medium text-foreground">
              Öğrenilen not
            </label>
            <textarea
              id="learned-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              placeholder="Örn. ilk gün kaygısını anlatan çekim en ucuz veliyi getirdi"
              className={`${fieldClass} placeholder:text-placeholder`}
            />
            <div>
              <button
                type="button"
                className={btnSecondary}
                disabled={pending}
                onClick={() => run(() => saveLearnedNote(item.id, note), "Not kaydedildi", () => setNoteOpen(false))}
              >
                Notu kaydet
              </button>
            </div>
          </div>
        ) : null}

        {reel ? <ReelPublishPanel item={item} videoUrl={videoUrl} ctx={reel} now={now} autoOpen={reelJustApproved} /> : null}

        {item.stage === "organik" ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="ig-permalink" className="text-sm font-medium text-foreground">
              Instagram gönderi bağlantısı
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="ig-permalink"
                type="url"
                inputMode="url"
                value={permalink}
                onChange={(e) => setPermalink(e.target.value)}
                placeholder="https://www.instagram.com/reel/..."
                className={`${fieldClass} min-h-11 min-w-0 flex-[1_1_220px] placeholder:text-placeholder`}
              />
              <button
                type="button"
                className={btnSecondary}
                disabled={pending || permalink.trim() === ""}
                onClick={() => run(() => linkInstagramPost(item.id, permalink), "Bağlantı kaydedildi")}
              >
                Kaydet
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5">
        <div className="text-sm font-bold text-foreground">Karar için ne kadar veri var?</div>
        {bars.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu aşamada karar ölçüsü yok.</p>
        ) : (
          bars.map((b) => (
            <div key={b.label} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2 text-[13.5px] text-foreground">
                <span>{b.label}</span>
                <b className="shrink-0 tabular-nums">{b.value}</b>
              </div>
              <span className="relative h-2 overflow-hidden rounded-full bg-muted">
                <span className={`absolute inset-y-0 left-0 ${TONE_BAR[b.tone]}`} style={{ width: `${b.pct}%` }} />
              </span>
            </div>
          ))
        )}
        {organic}
      </div>

      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2 text-sm">
        <div className="font-bold text-foreground">Sayılar</div>
        {hasNumbers ? (
          <dl className="flex flex-col gap-2">
            {[
              ["Harcama", formatTl(perf.spendKurus / 100)],
              ["Tıklama", String(perf.clicks)],
              ["Platformun saydığı başvuru", String(perf.platformResults)],
              ["Panelde gelen veli", String(perf.leads)],
              ["Nitelikli", String(perf.qualified)],
              ["Randevuya dönen", String(perf.appointments)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2 border-b border-border pb-1.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-bold tabular-nums text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground">Henüz sayı yok.</p>
        )}
      </div>
    </section>
  );
}

function ReviewBlock({
  item,
  videoUrl,
  faceChecked,
  onFaceChecked,
  reel,
}: {
  item: BoardItem;
  videoUrl: string | null;
  faceChecked: boolean;
  onFaceChecked: (v: boolean) => void;
  reel: ReelPanelContext | null;
}) {
  if (item.kind === "sayfa") {
    return (
      <dl className="flex flex-col gap-2 rounded-xl border border-border p-3 text-sm">
        {PAGE_FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-muted-foreground">{f.label}</dt>
            <dd className="whitespace-pre-wrap break-words text-foreground">{item.pageFields[f.key] || "—"}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <ReelsReview item={item} videoUrl={videoUrl} faceChecked={faceChecked} onFaceChecked={onFaceChecked} reel={reel} />;
}

function ReelsReview({
  item,
  videoUrl,
  faceChecked,
  onFaceChecked,
  reel,
}: {
  item: BoardItem;
  videoUrl: string | null;
  faceChecked: boolean;
  onFaceChecked: (v: boolean) => void;
  reel: ReelPanelContext | null;
}) {
  const [video, setVideo] = useState<ReviewVideo>("yukleniyor");
  const canCheck = canConfirmFace(videoUrl, video);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          onLoadedData={() => setVideo("hazir")}
          onError={() => {
            setVideo("oynatilamadi");
            onFaceChecked(false);
          }}
          className="aspect-[9/16] max-h-[28rem] w-full max-w-[16rem] rounded-xl bg-foreground"
        />
      ) : (
        <p className="text-sm text-destructive">Video açılamadı. Sayfayı yenileyin.</p>
      )}
      {videoUrl && video === "oynatilamadi" ? (
        <p role="alert" className="text-sm text-destructive">
          Video bu tarayıcıda oynatılamadı.{" "}
          <a href={videoUrl} download className="font-semibold underline">
            Videoyu indir
          </a>
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">Video bağlantısı 10 dakika geçerli; süre dolarsa sayfayı yenileyin.</p>
      <InstagramPreview username={reel?.igUsername ?? null} caption={item.caption ?? ""} videoUrl={videoUrl} coverOffsetMs={item.reelMeta?.coverOffsetMs ?? null} max={reel?.limits.reelsCaption} />
      <ReelAutoChecks lines={item.reelChecks ?? []} />
      <p className="text-sm text-muted-foreground">
        Öğretmenin cevabı: {item.faceAnswer === false ? "Videoda ya da yazıda öğrenci yüzü ya da adı yok." : "cevap yok"}
      </p>
      <label
        className={`flex min-h-11 items-center gap-3 text-[15px] font-semibold text-foreground ${canCheck ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
      >
        <input
          type="checkbox"
          checked={faceChecked && canCheck}
          disabled={!canCheck}
          onChange={(e) => onFaceChecked(e.target.checked)}
          className="size-5 shrink-0 accent-primary"
        />
        {FACE_CHECK}
      </label>
    </div>
  );
}
