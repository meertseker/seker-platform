"use client";

// Z5 "Büyütmeye taşı" onay penceresi (spec §4, B5, B7): Test'teki reklam Büyütme setine kopyalanır, Test'teki durur.
// Kapı kırmızıyken "Taşı" gerekçe ister (engellemez); "Sadece göster" her zaman açıktır. Son karar sunucuda (moveToScale).

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { moveToScale } from "@/actions/ad-setup";
import { useToast } from "@/components/toast";
import type { CampaignRow } from "@/lib/ads/campaigns";
import type { SetupResult } from "@/lib/ads/setup-gate";
import { SetupResultNote } from "./SetupResultNote";

const MIN_REASON = 10;
const MSG_FAILED = "İşlem yapılamadı, tekrar deneyin.";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const btnMain = `min-h-14 cursor-pointer rounded-xl bg-primary px-6 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const btnSecondary = `min-h-14 cursor-pointer rounded-xl border border-input bg-surface px-5 text-base font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const noopSubscribe = () => () => {};
/** Sunucuda ve hidrasyonda false, sonra true: portal yalnız tarayıcıda kurulur. */
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export type MoveToScaleTarget = { row: CampaignRow; contentId: string };

type Props = {
  target: MoveToScaleTarget | null;
  onClose: () => void;
  /** Sunucuda hesaplanan kapı durumu (uyarı içindir; asıl denetim moveToScale'de). */
  gate: { red: boolean; labels: string[] };
  writeEnabled: boolean;
};

export function MoveToScaleDialog({ target, onClose, gate, writeEnabled }: Props) {
  const code = target?.row.contentCode ?? "";
  return (
    <ScaleDialogShell
      open={target !== null}
      onClose={onClose}
      title={`${code} Büyütme'ye taşınsın mı?`}
      description={target?.row.name ?? ""}
    >
      {target ? <Body key={target.row.key} target={target} gate={gate} writeEnabled={writeEnabled} onClose={onClose} /> : null}
    </ScaleDialogShell>
  );
}

function Body({
  target,
  gate,
  writeEnabled,
  onClose,
}: {
  target: MoveToScaleTarget;
  gate: { red: boolean; labels: string[] };
  writeEnabled: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [serverNeedsReason, setServerNeedsReason] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [pending, startTransition] = useTransition();

  const needsReason = gate.red || serverNeedsReason;
  const reasonLen = reason.trim().length;
  const canMove = writeEnabled && !pending && (!needsReason || reasonLen >= MIN_REASON);

  function run(mode: "kur" | "goster") {
    if (pending) return;
    setResult(null);
    startTransition(async () => {
      try {
        const trimmed = reason.trim();
        const r = await moveToScale(target.contentId, { mode, source: "kampanyalar", ...(trimmed ? { reason: trimmed } : {}) });
        if ("error" in r && r.needsReason) setServerNeedsReason(true);
        if ("ok" in r && r.status === "uygulandi") {
          toast({ text: r.message });
          onClose();
          router.refresh();
          return;
        }
        setResult(r);
        // "Sadece göster" kaydı yazıldı: tablo altındaki son kayıt satırı tazelenir.
        if ("ok" in r) router.refresh();
      } catch {
        setResult({ error: MSG_FAILED });
      }
    });
  }

  return (
    <div className="space-y-4">
      <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
        <li>Büyütme · Instagram kampanyasına kopyalanır</li>
        <li>Test&apos;teki reklam durur</li>
      </ul>

      {needsReason ? (
        <div className="space-y-1 rounded-xl border border-destructive/40 bg-destructive-soft px-3 py-2.5 text-sm text-destructive-strong">
          <p className="font-semibold">
            {gate.red && gate.labels.length > 0 ? `Bir kapı kırmızı: ${gate.labels.join(", ")}.` : "Bu işlem için gerekçe gerekiyor."}
          </p>
          <p>Yine de taşıyacaksanız nedenini yazın (en az {MIN_REASON} karakter); kayıt defterine düşer.</p>
        </div>
      ) : null}

      {needsReason ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={reasonId} className="text-sm font-semibold text-foreground">
            Neden?
          </label>
          <textarea
            id={reasonId}
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby={`${reasonId}-count`}
            className={`w-full min-w-0 rounded-xl border border-input bg-surface px-3 py-2 text-base text-foreground ${focus}`}
          />
          <p id={`${reasonId}-count`} className={`text-xs ${reasonLen >= MIN_REASON ? "text-muted-foreground" : "text-warning"}`}>
            {reasonLen} / en az {MIN_REASON} karakter
          </p>
        </div>
      ) : null}

      {!writeEnabled ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          Canlı yazım kapalı: yalnız &quot;Sadece göster&quot; çalışır. Panel ne yapacağını yazar, hiçbir şey değişmez.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={() => run("kur")} disabled={!canMove} className={`${btnMain} w-full sm:flex-1`}>
          {pending ? "Bekleyin…" : "Taşı"}
        </button>
        <button type="button" onClick={() => run("goster")} disabled={pending} className={`${btnSecondary} w-full sm:w-auto`}>
          Sadece göster
        </button>
        <button type="button" onClick={onClose} className={`${btnSecondary} w-full sm:w-auto`}>
          Vazgeç
        </button>
      </div>

      <div aria-live="polite">
        {result && "error" in result ? (
          <div role="alert" className="text-sm font-semibold text-destructive-strong">
            <p>{result.error}</p>
            {result.ids &&
            Object.keys(result.ids).length > 0 &&
            !Object.values(result.ids).every((id) => result.error.includes(id)) ? (
              <p className="mt-1">Yarım kalan nesneler (hepsi DURAKLATILMIŞ): {Object.values(result.ids).join(", ")}</p>
            ) : null}
          </div>
        ) : null}
        {result && "ok" in result && result.status === "uygulanmadi_kapali" ? (
          <SetupResultNote summary={result.summary} message={result.message} title="Panel şunu yapacaktı:" />
        ) : null}
      </div>
    </div>
  );
}

/** Pencere kabuğu (AdTestPanel'deki gibi): portal, odak tuzağı, Esc, aria-modal. Telefonda alttan tam genişlik. */
function ScaleDialogShell({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" className="scrim absolute inset-0 animate-scrim-in" onClick={() => onCloseRef.current()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative max-h-dvh w-full overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-surface px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] outline-none sm:max-h-[92dvh] sm:max-w-lg sm:rounded-[1.75rem] sm:p-7"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <span className="inline-flex items-center rounded-full bg-instagram-soft px-2.5 py-0.5 text-xs font-semibold text-instagram">
              Instagram · Büyütmeye taşı
            </span>
            <h2 id={titleId} className="text-2xl font-bold text-foreground [overflow-wrap:anywhere]">
              {title}
            </h2>
            <p id={descId} className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {description}
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
