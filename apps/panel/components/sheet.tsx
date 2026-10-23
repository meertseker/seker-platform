"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Geniş ekranda geniş pencere (ör. önizleme + form yan yana). */
  wide?: boolean;
  children: React.ReactNode;
}

const SPRING = "var(--ease-spring)";

// Açık paneller yığını: Escape ve Tab yalnız en üstteki panele gider (iç içe açılışta da).
const openStack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const noopSubscribe = () => () => {};

/** Sunucuda ve hidrasyonda false, sonra true: portal yalnız tarayıcıda kurulur. */
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

// Apple'ın momentum izdüşümü (Designing Fluid Interfaces): bırakılan hızla nereye varacağı.
function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Sınırın ötesinde ilerledikçe artan direnç: sert durma yerine esneme.
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function currentTranslateY(el: HTMLElement) {
  const transform = getComputedStyle(el).transform;
  return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
}

/**
 * Telefonda alttan açılan cam panel, geniş ekranda ortada pencere.
 * Telefonda tutamaçtan sürüklenerek kapanır; Escape veya dış tık da kapatır.
 */
export function Sheet({ open, onClose, title, description, wide = false, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);
  const requestCloseRef = useRef<() => void>(() => {});
  const titleId = useId();
  const descriptionId = useId();
  const isClient = useIsClient();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !isClient) return;
    closingRef.current = false;
    const token = Symbol("sheet");
    openStack.push(token);
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current();
        return;
      }
      // Odak tuzağı: Tab arkadaki sayfaya kaçmasın, panelin içinde dönsün.
      if (event.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        );
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
      const index = openStack.indexOf(token);
      if (index !== -1) openStack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      // Açan düğme yenilemede değiştiyse odak sayfanın ana bölümüne düşer, kaybolmaz.
      if (previous && previous.isConnected) previous.focus?.();
      else document.getElementById("main")?.focus();
    };
  }, [open, isClient]);

  /** Geldiği yoldan çıkar: telefonda aşağı kayar, geniş ekranda küçülerek söner. */
  function requestClose(velocity = 0) {
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!panel || closingRef.current) return;
    closingRef.current = true;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      onCloseRef.current();
      return;
    }
    const mobile = matchMedia("(max-width: 639px)").matches;
    const from = currentTranslateY(panel);
    const distance = panel.offsetHeight - from;
    // Hız devri: parmağın hızıyla devam et, dikiş görünmesin.
    const duration = mobile
      ? Math.min(380, Math.max(180, velocity > 0 ? (distance / velocity) * 1000 * 1.6 : 320))
      : 200;
    panel.style.animation = "none";
    panel.style.transition = `transform ${duration}ms cubic-bezier(0.32, 0.72, 0, 1), opacity ${duration}ms ease, filter ${duration}ms ease`;
    if (mobile) {
      panel.style.transform = `translateY(${panel.offsetHeight + 24}px)`;
    } else {
      panel.style.transform = "scale(0.96)";
      panel.style.opacity = "0";
      panel.style.filter = "blur(6px)";
    }
    if (scrim) {
      scrim.style.animation = "none";
      scrim.style.transition = `opacity ${duration}ms ease`;
      scrim.style.opacity = "0";
    }
    window.setTimeout(() => onCloseRef.current(), duration);
  }

  useEffect(() => {
    requestCloseRef.current = () => requestClose();
  });

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const panel = panelRef.current;
    if (!panel || event.button !== 0) return;
    if (!matchMedia("(max-width: 639px)").matches) return;
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;

    // Kesintiye uğrayabilirlik: o anki ekrandaki değerden başla, hedef değerden değil.
    const startOffset = currentTranslateY(panel);
    panel.style.animation = "none";
    panel.style.transition = "none";
    panel.style.transform = `translateY(${startOffset}px)`;
    const startY = event.clientY;
    const height = panel.offsetHeight;
    const history: { y: number; t: number }[] = [{ y: startOffset, t: event.timeStamp }];
    let offset = startOffset;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    function onMove(moveEvent: PointerEvent) {
      const raw = startOffset + (moveEvent.clientY - startY);
      offset = raw >= 0 ? raw : -rubberband(-raw, height);
      panel!.style.transform = `translateY(${offset}px)`;
      if (scrimRef.current) {
        scrimRef.current.style.animation = "none";
        scrimRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, offset) / height));
      }
      history.push({ y: offset, t: moveEvent.timeStamp });
      if (history.length > 6) history.shift();
    }

    function onUp(upEvent: PointerEvent) {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      const first = history[0];
      const last = history[history.length - 1];
      const dt = last.t - first.t;
      // Parmak bırakmadan önce durduysa hız sıfırdır.
      const stale = upEvent.timeStamp - last.t > 100;
      const velocity = dt > 0 && !stale ? ((last.y - first.y) / dt) * 1000 : 0; // px/s
      const projected = offset + project(velocity);
      // Konuma değil gidişe bak: hızlı bir aşağı fiske kısa sürüklemede de kapatır.
      if (projected > height * 0.5 && velocity >= 0) {
        requestClose(velocity);
        return;
      }
      panel!.style.transition = `transform 500ms ${SPRING}`;
      panel!.style.transform = "translateY(0px)";
      if (scrimRef.current) {
        scrimRef.current.style.transition = "opacity 300ms ease";
        scrimRef.current.style.opacity = "1";
      }
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  if (!open || !isClient) return null;

  // Portal: üst öğedeki backdrop-filter/transform, fixed katmanı içine hapsetmesin.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        ref={scrimRef}
        aria-hidden="true"
        className="scrim absolute inset-0 animate-scrim-in"
        onClick={() => requestClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`glass-thick relative max-h-[92dvh] w-full animate-sheet-up overflow-y-auto overscroll-contain rounded-t-[2rem] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] outline-none ${wide ? "sm:max-w-6xl" : "sm:max-w-lg"} sm:animate-materialize sm:rounded-[1.75rem] sm:p-6`}
      >
        <div
          onPointerDown={onPointerDown}
          className="-mx-5 touch-none px-5 pt-2 sm:m-0 sm:touch-auto sm:p-0"
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/15 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl font-semibold text-foreground">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => requestClose()}
              aria-label="Kapat"
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/[0.05] text-muted-foreground hover:bg-black/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
