"use client";

// Z4 "Reklam testine al" penceresi (spec §4, B1, B5, B7): önizleme, şablondan gelenler, 9 kontrol ve kurulum.
// Panel kampanya kurmaz; Test setine yalnız kreatif + reklam ekler. "Sadece göster" her zaman çalışır.

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { launchAdTest, previewAdTest } from "@/actions/ad-setup";
import type { AdTestView } from "@/lib/ads/ad-test-context";
import {
  canLaunch,
  checklistCount,
  existingLabel,
  fixHref,
  launchOptions,
  MIN_REASON,
  reasonNeeded,
  SETTINGS_HREF,
  showAdTestButton,
  type AdTestItem,
  type AdTestOverride,
} from "@/lib/ads/ad-test-panel";
import type { SetupResult } from "@/lib/ads/setup-gate";
import { SetupResultNote } from "./SetupResultNote";

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const btnMain = `min-h-14 cursor-pointer rounded-xl bg-primary px-6 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const btnSecondary = `min-h-14 cursor-pointer rounded-xl border border-input bg-surface px-5 text-base font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const label = "text-xs font-bold uppercase tracking-wide text-muted-foreground";
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const BOTTOM_NOTE =
  "İlk hafta \"sadece göster\" modunda açılır: panel ne kuracağını yazar, Mert Reklam Yöneticisi'nden doğrular, sonra canlı. Kurulduktan sonra kart \"Testte · reklam 1208…\" olur; harcama ve veli sayıları ertesi sabahtan itibaren karta ve Kampanyalar'a düşer.";
const MSG_FAILED = "İşlem yapılamadı, tekrar deneyin.";

const noopSubscribe = () => () => {};
/** Sunucuda ve hidrasyonda false, sonra true: portal yalnız tarayıcıda kurulur. */
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

type Props = {
  item: AdTestItem;
  /** Bu hafta öneri kartından açılınca öneri kimliği (kayıt `source='oneri'`). */
  recommendationId?: string;
  /** "inline": öneri kartında küçük (44 px) ikincil düğme; varsayılan 56 px ana düğme. */
  trigger?: "button" | "inline";
};

export function AdTestPanel({ item, recommendationId, trigger = "button" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AdTestView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardLabel, setCardLabel] = useState<string | null>(null);
  const [override, setOverride] = useState<AdTestOverride>({ skip72h: false, reason: "" });
  const [serverNeedsReason, setServerNeedsReason] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [loading, startLoading] = useTransition();
  const [pending, startTransition] = useTransition();

  if (!showAdTestButton(item)) return null;

  function openPanel() {
    setOpen(true);
    setView(null);
    setLoadError(null);
    setResult(null);
    setServerNeedsReason(false);
    setOverride({ skip72h: false, reason: "" });
    startLoading(async () => {
      try {
        const v = await previewAdTest(item.id);
        if ("error" in v) {
          setLoadError(v.error);
          return;
        }
        setView(v);
        if (v.existing) setCardLabel(existingLabel(v.existing));
      } catch {
        setLoadError("Bilgiler okunamadı, tekrar deneyin.");
      }
    });
  }

  function run(mode: "kur" | "goster") {
    if (!view || pending) return;
    setResult(null);
    startTransition(async () => {
      try {
        const r = await launchAdTest(item.id, launchOptions(mode, view, override, recommendationId));
        if (r.checklist) setView({ ...view, checklist: r.checklist });
        if ("error" in r && r.needsReason) setServerNeedsReason(true);
        if ("ok" in r && r.status === "uygulandi") {
          setCardLabel(r.message);
          setOpen(false);
          router.refresh();
          return;
        }
        setResult(r);
      } catch {
        setResult({ error: MSG_FAILED });
      }
    });
  }

  const launch = view ? canLaunch(view, override, serverNeedsReason) : { enabled: false, blockText: null };
  const triggerClass =
    trigger === "inline"
      ? `min-h-11 cursor-pointer rounded-xl border border-input bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted ${focus}`
      : `${btnMain} w-full sm:w-auto`;

  return (
    <div className="min-w-0 space-y-2">
      {cardLabel ? (
        <p role="status" className="inline-flex min-h-11 max-w-full items-center rounded-xl bg-accent-soft px-4 text-sm font-semibold text-accent [overflow-wrap:anywhere]">
          {cardLabel}
        </p>
      ) : (
        <button type="button" onClick={openPanel} className={triggerClass}>
          Reklam testine al
        </button>
      )}
      <AdTestDialog open={open} onClose={() => setOpen(false)} code={item.code} kind={item.kind}>
        {loading || (!view && !loadError) ? (
          <p aria-busy="true" className="text-sm text-muted-foreground">
            Kontroller yapılıyor…
          </p>
        ) : loadError || !view ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {loadError}
          </p>
        ) : (
          <TestBody
            view={view}
            override={override}
            setOverride={setOverride}
            serverNeedsReason={serverNeedsReason}
            launch={launch}
            pending={pending}
            result={result}
            onRun={run}
            onClose={() => setOpen(false)}
          />
        )}
      </AdTestDialog>
    </div>
  );
}

function TestBody({
  view,
  override,
  setOverride,
  serverNeedsReason,
  launch,
  pending,
  result,
  onRun,
  onClose,
}: {
  view: AdTestView;
  override: AdTestOverride;
  setOverride: (o: AdTestOverride) => void;
  serverNeedsReason: boolean;
  launch: { enabled: boolean; blockText: string | null };
  pending: boolean;
  result: SetupResult | null;
  onRun: (mode: "kur" | "goster") => void;
  onClose: () => void;
}) {
  const reasonId = useId();
  const blockId = useId();
  const showReason = reasonNeeded(view, override, serverNeedsReason);
  const reasonLen = override.reason.trim().length;

  return (
    <div className="space-y-5">
      {view.existing ? (
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent [overflow-wrap:anywhere]">
          {existingLabel(view.existing)}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_270px]">
        <Preview view={view} />

        <div className="flex min-w-0 flex-col gap-3">
          <p className={label}>
            Şablondan gelenler{" "}
            <Link
              href={SETTINGS_HREF}
              className={`ml-1 rounded font-semibold normal-case tracking-normal text-primary-strong underline-offset-2 hover:underline ${focus}`}
            >
              Ayarlar&apos;da değiştir
            </Link>
          </p>
          <dl className="rounded-2xl border border-border bg-surface px-4 py-1">
            {view.rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
                <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 text-right font-semibold text-foreground [overflow-wrap:anywhere]">
                  {row.value}
                  {row.sub ? <span className="block text-xs font-normal text-muted-foreground">{row.sub}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <p className={label}>Kontrol listesi · {checklistCount(view.checklist)}</p>
          <ul
            className={`rounded-2xl border px-3.5 py-2 ${
              view.checklist.ok ? "border-accent/40 bg-accent-soft" : "border-destructive/40 bg-destructive-soft"
            }`}
          >
            {view.checklist.items.map((it) => {
              const href = fixHref(it.fix);
              return (
                <li key={it.key} className="flex items-start gap-2 py-1.5 text-sm text-foreground">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-surface text-xs ${
                      it.ok ? "text-accent" : "text-destructive"
                    }`}
                  >
                    {it.ok ? "✓" : "✕"}
                  </span>
                  <span className="min-w-0 break-words">
                    <span className="sr-only">{it.ok ? "Tamam: " : "Eksik: "}</span>
                    {it.label}
                    {!it.ok && it.fix ? (
                      href ? (
                        <Link
                          href={href}
                          className={`mt-1 flex min-h-11 w-fit items-center rounded-lg border border-input bg-surface px-3 text-sm font-semibold text-foreground hover:bg-muted ${focus}`}
                        >
                          {it.fix}
                        </Link>
                      ) : (
                        <span className="mt-0.5 block text-xs font-semibold text-destructive">{it.fix}</span>
                      )
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>

          {view.needs72hOverride ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={override.skip72h}
                onChange={(e) => setOverride({ ...override, skip72h: e.target.checked })}
                className={`size-5 shrink-0 accent-primary ${focus}`}
              />
              72 saati bekleme{view.hoursLeft !== null ? ` (kalan ${view.hoursLeft} saat)` : ""}
            </label>
          ) : null}

          {view.checklist.ok ? (
            <p className="rounded-xl border border-warning/40 bg-warning-soft px-3 py-2.5 text-xs text-warning">
              Biri kırmızı olsa düğme kapanır ve ne eksik olduğunu yazar. Örnek: &quot;Sayfa henüz yayında değil: önce Sayfayı
              yayınla.&quot;
            </p>
          ) : null}
        </div>
      </div>

      {view.gateRed.length > 0 || serverNeedsReason ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
          <p className="font-semibold">
            {view.gateRed.length > 0 ? `Bir kapı kırmızı: ${view.gateRed.join(", ")}.` : "Bu işlem için gerekçe gerekiyor."}
          </p>
          <p className="mt-1">Yine de teste alacaksanız nedenini yazın (en az {MIN_REASON} karakter); kayıt defterine düşer.</p>
        </div>
      ) : null}

      {showReason ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={reasonId} className="text-sm font-semibold text-foreground">
            Neden?
          </label>
          <textarea
            id={reasonId}
            rows={2}
            maxLength={500}
            value={override.reason}
            onChange={(e) => setOverride({ ...override, reason: e.target.value })}
            aria-describedby={`${reasonId}-count`}
            className={`w-full min-w-0 rounded-xl border border-input bg-surface px-3 py-2 text-base text-foreground ${focus}`}
          />
          <p id={`${reasonId}-count`} className={`text-xs ${reasonLen >= MIN_REASON ? "text-muted-foreground" : "text-warning"}`}>
            {reasonLen} / en az {MIN_REASON} karakter
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => onRun("kur")}
          disabled={!launch.enabled || pending}
          aria-describedby={launch.blockText ? blockId : undefined}
          className={`${btnMain} w-full sm:flex-1`}
        >
          {pending ? "Bekleyin…" : "Reklamı kur ve başlat"}
        </button>
        <button type="button" onClick={() => onRun("goster")} disabled={pending} className={`${btnSecondary} w-full sm:w-auto`}>
          Sadece göster, kurma
        </button>
        <button type="button" onClick={onClose} className={`${btnSecondary} w-full sm:w-auto`}>
          Vazgeç
        </button>
      </div>
      {launch.blockText ? (
        <p id={blockId} className="text-sm font-semibold text-destructive">
          {launch.blockText}
        </p>
      ) : null}

      <div aria-live="polite">
        {result && "error" in result ? (
          <div role="alert" className="text-sm font-semibold text-destructive">
            <p>{result.error}</p>
            {result.ids &&
            Object.keys(result.ids).length > 0 &&
            !Object.values(result.ids).every((id) => result.error.includes(id)) ? (
              <p className="mt-1">Yarım kalan nesneler (hepsi DURAKLATILMIŞ): {Object.values(result.ids).join(", ")}</p>
            ) : null}
          </div>
        ) : null}
        {result && "ok" in result && result.status === "uygulanmadi_kapali" ? (
          <SetupResultNote summary={result.summary} message={result.message} />
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{BOTTOM_NOTE}</p>
    </div>
  );
}

function Preview({ view }: { view: AdTestView }) {
  const p = view.preview;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className={label}>Reklam Instagram&apos;da böyle görünür</p>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-sm">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span aria-hidden="true" className="size-7 shrink-0 rounded-full border border-instagram/40 bg-instagram-soft" />
          <p className="leading-tight">
            <b>sekeranaokulu</b>
            <span className="block text-xs text-muted-foreground">Sponsorlu</span>
          </p>
        </div>
        {p.kind === "reels" ? (
          <div className="flex h-72 items-end bg-foreground p-3 text-surface">
            <p className="line-clamp-4 text-xs font-semibold break-words">{p.caption ?? "Açıklama yok"}</p>
          </div>
        ) : p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- site medyası; boyutu bilinmiyor
          <img src={p.imageUrl} alt="" className="aspect-square w-full bg-muted object-cover" />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-muted p-3 text-xs text-muted-foreground">Görsel seçilmemiş</div>
        )}
        <div className="flex items-center justify-between bg-muted px-3 py-2.5 font-bold">
          <span>Daha fazla bilgi</span>
          <span aria-hidden="true">›</span>
        </div>
        {p.kind === "reels" ? (
          <p className="px-3 py-2.5 break-words">
            <b>sekeranaokulu</b> {p.caption ?? ""}
          </p>
        ) : (
          <div className="px-3 py-2.5 break-words">
            <p className="font-semibold">{p.headline ?? "Başlık yok"}</p>
            <p className="mt-1 text-muted-foreground">{p.primaryText ?? ""}</p>
          </div>
        )}
      </div>
      {p.kind === "reels" ? (
        <p className="text-xs text-muted-foreground">
          Yayınlanmış gönderinin kendisi kullanılır: beğeni ve yorumlar tek yerde birikir.
          {p.permalink ? (
            <>
              {" "}
              <a
                href={p.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-11 items-center rounded font-semibold text-primary-strong underline ${focus}`}
              >
                Gönderiyi aç
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Geniş pencere (üç sütun); Sheet'in odak tuzağı, Esc ve aria-modal davranışı. Telefonda tam ekran. */
function AdTestDialog({
  open,
  onClose,
  code,
  kind,
  children,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  kind: "reels" | "sayfa";
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();
  const isClient = useIsClient();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !isClient) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      // Odak tuzağı: Tab arkadaki sayfaya kaçmasın, pencerenin içinde dönsün.
      if (event.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) {
          event.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        const inside = panelRef.current.contains(active);
        if (event.shiftKey && (active === first || active === panelRef.current || !inside)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !inside)) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previous && previous.isConnected) previous.focus?.();
      else document.getElementById("main")?.focus();
    };
  }, [open, isClient]);

  if (!open || !isClient) return null;

  // Portal: üst öğedeki backdrop-filter/transform, fixed katmanı içine hapsetmesin.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" className="scrim absolute inset-0 animate-scrim-in" onClick={() => onCloseRef.current()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative max-h-dvh w-full overflow-x-hidden overflow-y-auto overscroll-contain bg-surface px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] outline-none sm:max-h-[92dvh] sm:max-w-6xl sm:rounded-[1.75rem] sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <span className="inline-flex items-center rounded-full bg-instagram-soft px-2.5 py-0.5 text-xs font-semibold text-instagram">
              {code} · {kind === "reels" ? "Reels" : "Sayfa"}
            </span>
            <h2 id={titleId} className="text-2xl font-bold text-foreground">
              Reklam testine al
            </h2>
            <p id={descId} className="text-sm text-muted-foreground">
              Panel reklamı Meta&apos;da şablondan kurar ve açar. Aşağıdaki hiçbir şeyi siz yazmazsınız; yalnız kontrol edip onaylarsınız.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Pencereyi kapat"
            className={`inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground ${focus}`}
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
