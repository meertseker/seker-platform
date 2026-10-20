"use client";

import { useRef, useState } from "react";
import { requestVideoUpload, saveContentDraft } from "@/actions/content";
import { videoSizeError } from "@/lib/content/store";

export type VideoMeta = { name: string; size: number; durationSec?: number };

interface VideoUploadProps {
  contentId: string;
  meta: VideoMeta | null;
  hasVideo: boolean;
  maxMb: number;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  /** Yükleme ve kayıt bitince çağrılır; üst bileşen yüz sorusunu sıfırlar (sunucu da sıfırlar). */
  onUploaded: (path: string, meta: VideoMeta) => void;
}

/** Süreyi gizli <video> öğesinin üst verisinden okur; okunamazsa undefined (yüklemeyi asla engellemez). */
function readDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (value?: number) => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(value);
    };
    const timer = window.setTimeout(() => done(undefined), 4000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(Number.isFinite(video.duration) ? Math.round(video.duration) : undefined);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done(undefined);
    };
    video.src = url;
  });
}

export function VideoUpload({ contentId, meta, hasVideo, maxMb, disabled, onBusyChange, onUploaded }: VideoUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    const tooLarge = videoSizeError(file.size, maxMb);
    if (tooLarge) {
      setError(tooLarge);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      const [durationSec, ticket] = await Promise.all([
        readDuration(file),
        requestVideoUpload(contentId, file.name, file.size, file.type),
      ]);
      if ("error" in ticket) {
        setError(ticket.error);
        return;
      }
      const put = await fetch(ticket.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!put.ok) {
        setError("Video yüklenemedi, bağlantını kontrol edip tekrar dene");
        return;
      }
      const next: VideoMeta = { name: file.name, size: file.size, ...(durationSec !== undefined ? { durationSec } : {}) };
      const saved = await saveContentDraft(contentId, { mediaPath: ticket.path, mediaMeta: next });
      if ("error" in saved) {
        setError(saved.error);
        return;
      }
      onUploaded(ticket.path, next);
    } catch {
      setError("Video yüklenemedi, bağlantını kontrol edip tekrar dene");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      if (input.current) input.current.value = "";
    }
  }

  const label = busy
    ? "Yükleniyor…"
    : hasVideo
      ? `✓ ${meta?.name ?? "Video yüklendi"}${meta?.durationSec !== undefined ? ` · ${meta.durationSec} sn` : ""}`
      : "+ Video yükle";

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
        {label}
      </button>
      {hasVideo && !busy ? (
        <p className="text-[13px] text-muted-foreground">Başka bir video seçersen yüz sorusunu yeniden cevaplarsın.</p>
      ) : null}
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2.5 text-sm text-destructive-strong">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
