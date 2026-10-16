"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** Telefonda alttan açılan panel, geniş ekranda ortada pencere. Escape veya dış tık kapatır. */
export function Sheet({ open, onClose, title, description, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/40"
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 shadow-xl outline-none sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
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
            onClick={() => onCloseRef.current()}
            aria-label="Kapat"
            className="inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
