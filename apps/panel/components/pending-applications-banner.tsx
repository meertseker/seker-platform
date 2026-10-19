"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { QueueBannerSummary } from "@/lib/queries/call-queue";

/**
 * Ortak arama listesinde bekleyen veliler — Bugün dışındaki her sayfanın üstünde yön işareti.
 * Doğrudan aramaz: arama yalnız Bugün ekranındaki "Ara" (üstlenme) ile başlar.
 */
export function PendingApplicationsBanner({ summary }: { summary: QueueBannerSummary | null }) {
  const pathname = usePathname();
  if (!summary || pathname === "/bugun") return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive-soft p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-base font-semibold text-destructive-strong">
        {summary.count} yeni veli aranmayı bekliyor · {summary.oldestName} · {summary.oldestMinutes} dk
      </p>
      <Link
        href="/bugun"
        className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Bugün&apos;e git
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}
