"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { filterHref } from "@/lib/filter-href";

/** Yazmayı bitirmeyi bu kadar bekler; her harfte sunucuya gidilmesin. */
export const TYPE_DELAY_MS = 350;

/**
 * Filtreyi "Filtrele"ye basmadan uygular: arama kutusuna yazınca kısa bir beklemeden sonra,
 * açılır menü değişince hemen. Adres GET formununkiyle aynıdır; Enter ve düğme de çalışmaya devam eder.
 */
export function AutoFilterForm({ action, className, children }: { action: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function apply() {
    clearTimer();
    const form = formRef.current;
    if (!form) return;
    const href = filterHref(action, new FormData(form).entries());
    startTransition(() => router.replace(href, { scroll: false }));
  }

  useEffect(() => clearTimer, []);

  return (
    <form
      ref={formRef}
      action={action}
      aria-busy={pending}
      className={`${className ?? ""} transition-opacity ${pending ? "opacity-70" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "search")) {
          clearTimer();
          timerRef.current = setTimeout(apply, TYPE_DELAY_MS);
        } else {
          apply();
        }
      }}
    >
      {children}
    </form>
  );
}
