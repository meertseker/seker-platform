"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishReel } from "@/actions/instagram";
import { InstagramPreview } from "@/components/reel-review-extras";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import type { BoardItem } from "@/lib/content/board";
import { checkText } from "@/lib/content/checks";
import { scheduleWarning } from "@/lib/content/publish-queue";
import { permalinkLabel, reelPanelState, type ReelPanelContext } from "@/lib/content/reel-review";
import { formatDayTime, istanbulLocalInput, parseIstanbulDateTime } from "@/lib/lead-flow/business-hours";

/** "1. saniyeyi" / "ilk kareyi". */
function coverPick(ms: number): string {
  const s = Math.round(ms / 1000);
  return s <= 0 ? "ilk kareyi" : `${s}. saniyeyi`;
}

const btnPrimary =
  "inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold";

/** Z2 durum paneli: organik aşamadaki onaylı Reels'in Instagram yayını. */
export function ReelPublishPanel({
  item,
  videoUrl,
  ctx,
  now,
  autoOpen = false,
}: {
  item: BoardItem;
  videoUrl: string | null;
  ctx: ReelPanelContext;
  now: Date;
  /** "Onayla ve yayına hazırla"dan hemen sonra true. */
  autoOpen?: boolean;
}) {
  const state = reelPanelState(item);
  const [open, setOpen] = useState(false);
  // Onaydan sonra (Z1 → Z2) pencere bir kez kendiliğinden açılır; kart yenilenip "hazir" olunca.
  const [autoDone, setAutoDone] = useState(false);
  if (autoOpen && !autoDone && state.kind === "hazir") {
    setAutoDone(true);
    setOpen(true);
  }

  if (state.kind === "gizli") return null;

  const body = (() => {
    switch (state.kind) {
      case "hazir":
        return (
          <>
            <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
              Instagram&apos;da yayınla
            </button>
            {!ctx.publishEnabled ? (
              <p className="text-sm text-muted-foreground">İçerik yayını kapalı. Yayınla kayda geçer, Instagram&apos;a gitmez.</p>
            ) : null}
            <a href="#ig-permalink" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-strong underline">
              Ya da Instagram&apos;da elle paylaşıp bağlantıyı yapıştırın
            </a>
          </>
        );
      case "planli": {
        const at = new Date(state.at);
        const warn = scheduleWarning(at);
        return (
          <>
            <span className={`${pill} w-fit bg-primary-soft text-primary-strong`}>Planlandı · {formatDayTime(at)}</span>
            {warn ? <p className="text-sm text-warning">{warn}</p> : null}
          </>
        );
      }
      case "isleniyor":
        return <span className={`${pill} w-fit bg-warning-soft text-warning`}>Instagram videoyu işliyor · birkaç dakika</span>;
      case "yayinda":
        return (
          <>
            <span className={`${pill} w-fit bg-accent-soft text-accent-strong`}>Yayında · 72 saat başladı</span>
            <p className="text-sm text-muted-foreground">
              {formatDayTime(new Date(state.publishedAt))}
              {state.permalink ? (
                <>
                  {" · "}
                  <a href={state.permalink} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline">
                    {permalinkLabel(state.permalink)}
                  </a>
                </>
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground">Organik sayılar her sabah güncellenir.</p>
          </>
        );
      case "hata":
        return (
          <>
            <p role="status" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive-strong">
              Yayınlanamadı: {state.error}
            </p>
            {state.retry ? (
              <div>
                <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
                  Tekrar dene
                </button>
              </div>
            ) : null}
          </>
        );
      case "elle":
        return (
          <span className={`${pill} w-fit bg-muted text-foreground`}>
            Elle bağlandı ·{" "}
            <a href={state.permalink} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
              {permalinkLabel(state.permalink)}
            </a>
          </span>
        );
    }
  })();

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <div className="text-sm font-bold text-foreground">Instagram yayını</div>
      {body}
      {open ? (
        <PublishSheet item={item} videoUrl={videoUrl} ctx={ctx} now={now} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

function PublishSheet({
  item,
  videoUrl,
  ctx,
  now,
  onClose,
}: {
  item: BoardItem;
  videoUrl: string | null;
  ctx: ReelPanelContext;
  now: Date;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [caption, setCaption] = useState(item.caption ?? "");
  const [mode, setMode] = useState<"now" | "later">("now");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);

  const check = checkText(caption, { max: ctx.limits.reelsCaption, min: ctx.limits.min, banned: ctx.banned });
  const scheduled = mode === "later" ? parseIstanbulDateTime(when) : null;
  const warn = scheduled ? scheduleWarning(scheduled) : null;
  const meta = item.reelMeta;
  const minInput = istanbulLocalInput(new Date(now.getTime() + 11 * 60_000));
  const maxInput = istanbulLocalInput(new Date(now.getTime() + 14 * 86_400_000));
  const blockedByAccount = ctx.publishEnabled && !ctx.igReady;
  const canSubmit = check.ok && !pending && !blockedByAccount && (mode === "now" || scheduled !== null);
  const name = ctx.igUsername ? `@${ctx.igUsername}` : "Instagram";

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await publishReel(item.id, { caption, scheduledAt: mode === "later" ? when : null });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      toast({ text: res.warning ? `${res.message}. ${res.warning}` : res.message });
      onClose();
      router.refresh();
    });
  }

  const accountLines: { ok: boolean; warn?: boolean; text: string }[] = [
    {
      ok: ctx.igReady || !!ctx.igUsername,
      text: ctx.igUsername ? `Instagram hesabı bağlı: @${ctx.igUsername} (işletme hesabı)` : "Instagram hesabı bağlı değil (Ayarlar → Bağlantılar)",
    },
    { ok: ctx.igReady, text: ctx.igReady ? "Facebook sayfası bağlı" : "Facebook sayfası bağlı değil ya da izin yok" },
    ctx.remaining === null || ctx.total === null
      ? { ok: false, warn: true, text: "Kalan hak okunamadı" }
      : { ok: ctx.remaining > 0, text: `Bugün kalan yayın hakkı: ${ctx.remaining}/${ctx.total}` },
    meta
      ? { ok: meta.vertical, text: `Biçim: ${meta.vertical ? "dikey 9:16" : "dikey değil"}, ${Math.round(meta.durationS)} sn` }
      : { ok: false, warn: true, text: "Biçim bilgisi yok (eski yükleme)" },
    { ok: item.approverFaceCheck === true && item.faceAnswer === false, text: "Öğrenci yüzü/adı yok: öğretmen + onaylayan" },
  ];

  return (
    <Sheet open onClose={onClose} title="Instagram'da yayınla" description={`Panel videoyu ${name} hesabına Reels olarak gönderir. Uygulamayı açmanız gerekmez.`}>
      <div className="flex flex-wrap gap-6">
        <InstagramPreview
          username={ctx.igUsername}
          caption={caption}
          videoUrl={videoUrl}
          coverOffsetMs={meta?.coverOffsetMs ?? null}
          max={ctx.limits.reelsCaption}
        />
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`z2-caption-${item.id}`} className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Açıklama (son düzeltme)
            </label>
            <textarea
              id={`z2-caption-${item.id}`}
              rows={4}
              value={caption}
              maxLength={2200}
              onChange={(e) => setCaption(e.target.value)}
              className="block w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <p className="flex justify-between gap-2 text-[12.5px]">
              <span className={check.ok ? "text-muted-foreground" : "text-destructive-strong"}>
                {check.ok ? "Öğretmenin yazdığı metin. Kontrol geçti." : check.message}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {caption.length} / {ctx.limits.reelsCaption}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kapak karesi</p>
            <p className="text-sm text-muted-foreground">
              {meta ? `Öğretmen ${coverPick(meta.coverOffsetMs)} seçti.` : "Kapak: 1. saniye."} Ayrı görsel yüklenmez.
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ne zaman</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["now", "Şimdi"],
                  ["later", "Saat seç"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${
                    mode === value ? "border-primary bg-primary-soft text-primary-strong" : "border-input text-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name={`z2-when-${item.id}`}
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="accent-[var(--color-primary)]"
                  />
                  {label}
                </label>
              ))}
            </div>
            {mode === "later" ? (
              <div className="flex flex-col gap-1">
                <label htmlFor={`z2-at-${item.id}`} className="sr-only">
                  Yayın saati
                </label>
                <input
                  id={`z2-at-${item.id}`}
                  type="datetime-local"
                  min={minInput}
                  max={maxInput}
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="min-h-11 w-full max-w-xs rounded-xl border border-input bg-surface px-3 text-base"
                />
                {warn ? <p className="text-sm text-warning">{warn}</p> : null}
              </div>
            ) : null}
          </fieldset>

          <ul className="rounded-2xl border border-border bg-surface px-4 py-1">
            {accountLines.map((l) => (
              <li key={l.text} className="flex items-center gap-2.5 border-b border-border py-2 text-sm last:border-b-0">
                <span
                  aria-hidden="true"
                  className={`inline-flex size-5 flex-none items-center justify-center rounded-full text-xs font-bold ${
                    l.ok ? "bg-accent-soft text-accent-strong" : l.warn ? "bg-warning-soft text-warning" : "bg-destructive-soft text-destructive-strong"
                  }`}
                >
                  {l.ok ? "✓" : l.warn ? "!" : "✗"}
                </span>
                <span>{l.text}</span>
              </li>
            ))}
          </ul>

          {!ctx.publishEnabled ? (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
              İçerik yayını kapalı: &quot;Instagram&apos;da yayınla&quot; kayda geçer, Instagram&apos;a gitmez.
            </p>
          ) : blockedByAccount ? (
            <p className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive-strong">
              Instagram ya da Facebook bağlantısı hazır değil. Ayarlar → Bağlantılar&apos;a bakın.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive-strong">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" className={`${btnPrimary} flex-[1_1_220px]`} disabled={!canSubmit} onClick={submit}>
              {pending ? "Gönderiliyor…" : "Instagram'da yayınla"}
            </button>
            <button type="button" className={btnSecondary} disabled={pending} onClick={onClose}>
              Sonra
            </button>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Yayından sonra: bağlantı ve saat karta yazılır, 72 saat organik sayacı başlar, öğretmene &quot;yayınlandı&quot; bildirimi
            gider. Hata olursa kart &quot;Yayınlanamadı: sebep&quot; der, tekrar denenir.
          </p>
        </div>
      </div>
    </Sheet>
  );
}
