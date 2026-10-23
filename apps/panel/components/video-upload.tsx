"use client";

import { useRef, useState } from "react";
import { requestVideoUpload, saveContentDraft } from "@/actions/content";
import { saveReelVideoMeta } from "@/actions/instagram";
import { videoSizeError } from "@/lib/content/store";
import {
  buildReelMediaMeta,
  DEFAULT_COVER_OFFSET_MS,
  reelFormatLines,
  reelUploadBlockers,
  type ReelMediaMeta,
} from "@/lib/content/media-meta";
import { probeVideo } from "@/lib/content/video-probe";

/** `reel`: K17 biçim bilgisi (spec); eski yüklemede null. */
export type VideoMeta = { name: string; size: number; durationSec?: number; reel: ReelMediaMeta | null };

interface VideoUploadProps {
  contentId: string;
  meta: VideoMeta | null;
  hasVideo: boolean;
  maxMb: number;
  /** "Altyazı ekledim" kutusunun o anki değeri; yüklemede biçim bilgisine yazılır. */
  subtitled: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  /** Yükleme ve kayıt bitince çağrılır; üst bileşen yüz sorusunu sıfırlar (sunucu da sıfırlar). */
  onUploaded: (path: string, meta: VideoMeta, file: File) => void;
}

const MB = 1024 * 1024;

function formatMb(size: number): string {
  return `${Math.max(1, Math.round(size / MB))} MB`;
}

export function VideoUpload({ contentId, meta, hasVideo, maxMb, subtitled, disabled, onBusyChange, onUploaded }: VideoUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function onFile(file: File) {
    setErrors([]);
    const tooLarge = videoSizeError(file.size, maxMb);
    if (tooLarge) {
      setErrors([tooLarge]);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      // Uygun olmayan video yüklenmez, sebep yazar (O1, K17).
      const probe = await probeVideo(file);
      const blockers = probe ? reelUploadBlockers(probe) : reelUploadBlockers({ durationS: NaN, width: 0, height: 0 });
      if (blockers.length > 0) {
        setErrors(blockers);
        return;
      }
      const ticket = await requestVideoUpload(contentId, file.name, file.size, file.type);
      if ("error" in ticket) {
        setErrors([ticket.error]);
        return;
      }
      const put = await fetch(ticket.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!put.ok) {
        setErrors(["Video yüklenemedi, bağlantını kontrol edip tekrar dene"]);
        return;
      }
      const durationSec = Math.round(probe!.durationS);
      const saved = await saveContentDraft(contentId, {
        mediaPath: ticket.path,
        mediaMeta: { name: file.name, size: file.size, durationSec },
      });
      if ("error" in saved) {
        setErrors([saved.error]);
        return;
      }
      const reelInput = { ...probe!, coverOffsetMs: DEFAULT_COVER_OFFSET_MS, subtitled };
      const reelSaved = await saveReelVideoMeta(contentId, reelInput);
      const reel = "ok" in reelSaved ? buildReelMediaMeta(reelInput) : null;
      if ("error" in reelSaved) setErrors([`Video yüklendi ama biçim bilgisi kaydedilemedi: ${reelSaved.error}. Videoyu yeniden seç.`]);
      onUploaded(ticket.path, { name: file.name, size: file.size, durationSec, reel }, file);
    } catch {
      setErrors(["Video yüklenemedi, bağlantını kontrol edip tekrar dene"]);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      if (input.current) input.current.value = "";
    }
  }

  const reel = meta?.reel ?? null;
  const lines = hasVideo ? reelFormatLines(reel) : [];
  const label = busy ? "Yükleniyor…" : hasVideo ? meta?.name ?? "Video yüklendi" : "+ Video yükle";

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        aria-busy={busy}
        className={`min-h-[88px] rounded-2xl border-[1.5px] border-dashed bg-surface px-4 text-[15px] font-semibold text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
          hasVideo && !busy ? "border-accent" : "border-input"
        }`}
      >
        {hasVideo && !busy ? <span aria-hidden="true">✓ </span> : null}
        {label}
      </button>
      {hasVideo && !busy ? (
        <div className="flex flex-col gap-0.5 text-[13px]">
          {reel ? (
            <p className={reel.vertical ? "font-semibold text-accent-strong" : "font-semibold text-destructive-strong"}>
              {reel.vertical ? "✓ Dikey 9:16" : "✗ Dikey değil"} · {Math.round(reel.durationS)} sn
              {meta ? ` · ${formatMb(meta.size)}` : ""}
            </p>
          ) : null}
          {(reel ? lines.slice(1, 2) : lines).map((l) => (
            <p key={l.text} className={l.ok ? "font-semibold text-accent-strong" : "text-warning"}>
              {l.ok ? "✓ " : "! "}
              {l.text}
            </p>
          ))}
          <p className="text-muted-foreground">Başka bir video seçersen yüz sorusunu yeniden cevaplarsın.</p>
        </div>
      ) : null}
      <div aria-live="polite">
        {errors.length > 0 ? (
          <ul role="alert" className="flex flex-col gap-1 rounded-xl bg-destructive-soft px-3 py-2.5 text-sm text-destructive-strong">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
