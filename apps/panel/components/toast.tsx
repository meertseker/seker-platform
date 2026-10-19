"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastInput {
  text: string;
  action?: ToastAction;
}

interface ToastState extends ToastInput {
  id: number;
}

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

/** Bildirim gösterir: "Ödeme kaydedildi · Geri al". Açan pencere kapansa da ekranda kalır. */
export function useToast() {
  return useContext(ToastContext);
}

const DURATION_MS = 15000;

/**
 * Bildirim katmanı (app) düzeninde bir kez kurulur. Canlı bölge hep sayfadadır, yalnız metni
 * değişir; ekran okuyucu böylece her bildirimi duyurur. Fare üstündeyken veya düğmede odak
 * varken süre durur (WCAG 2.2.1).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [paused, setPaused] = useState(false);
  const nextId = useRef(0);

  const show = useCallback((input: ToastInput) => {
    nextId.current += 1;
    setToast({ ...input, id: nextId.current });
  }, []);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(() => setToast(null), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast, paused]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-6"
      >
        {toast ? (
          <div
            key={toast.id}
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto flex w-full max-w-lg animate-pop-in flex-wrap items-center justify-between gap-3 rounded-3xl bg-foreground px-5 py-2.5 text-base text-background shadow-xl"
          >
            <span>{toast.text}</span>
            <div className="flex items-center gap-1">
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    const action = toast.action;
                    setToast(null);
                    setPaused(false);
                    action?.onClick();
                  }}
                  className="min-h-11 cursor-pointer rounded-xl px-3 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
                >
                  {toast.action.label}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setToast(null);
                  setPaused(false);
                }}
                aria-label="Bildirimi kapat"
                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-background/80 hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
