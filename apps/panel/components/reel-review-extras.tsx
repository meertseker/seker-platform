"use client";

import { coverLabel } from "@/lib/content/media-meta";
import type { CheckLine } from "@/lib/content/reel-review";

/** Z1 "Instagram'da böyle görünecek" ve Z2 "Reels önizleme": 9:16 çerçevede kapak karesi, hesap adı, açıklama. */
export function InstagramPreview({
  username,
  caption,
  videoUrl,
  coverOffsetMs,
  max,
}: {
  username: string | null;
  caption: string;
  videoUrl: string | null;
  coverOffsetMs: number | null;
  /** Açıklama sınırı (sayaç için). */
  max?: number;
}) {
  const name = username ?? "instagram";
  const seconds = (coverOffsetMs ?? 1000) / 1000;
  return (
    <div className="flex w-full max-w-[15.5rem] flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Instagram&apos;da böyle görünecek</p>
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl bg-foreground text-background">
        {videoUrl ? (
          <video
            src={`${videoUrl}#t=${seconds}`}
            muted
            playsInline
            preload="metadata"
            aria-label="Kapak karesi"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-x-3 bottom-3.5 flex flex-col gap-1.5 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="size-6 rounded-full border border-instagram bg-instagram-soft" />
            <b className="text-[13px]">{name}</b>
          </div>
          <p className="line-clamp-2 whitespace-pre-wrap break-words text-[12.5px] leading-snug">{caption || "—"}</p>
          <p className="text-[11.5px] opacity-80">♫ Orijinal ses · {name}</p>
        </div>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        Açıklama {caption.length}
        {max ? ` / ${max}` : ""} · {coverLabel(coverOffsetMs ?? 1000).replace(/^Kapak: /, "kapak: ")}
      </p>
    </div>
  );
}

const MARK: Record<CheckLine["tone"], { sign: string; cls: string }> = {
  ok: { sign: "✓", cls: "bg-accent-soft text-accent-strong" },
  warn: { sign: "!", cls: "bg-warning-soft text-warning" },
  bad: { sign: "✗", cls: "bg-destructive-soft text-destructive-strong" },
};

/** Z1 "Otomatik kontroller". */
export function ReelAutoChecks({ lines }: { lines: CheckLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border px-4 py-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Otomatik kontroller</p>
      <ul className="divide-y divide-border">
        {lines.map((l) => (
          <li key={l.text} className="flex items-start gap-2.5 py-2 text-sm text-foreground">
            <span
              aria-hidden="true"
              className={`mt-0.5 inline-flex size-5 flex-none items-center justify-center rounded-full text-xs font-bold ${MARK[l.tone].cls}`}
            >
              {MARK[l.tone].sign}
            </span>
            <span className="break-words">{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
