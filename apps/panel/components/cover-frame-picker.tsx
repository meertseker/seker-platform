"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { coverLabel } from "@/lib/content/media-meta";

interface Props {
  /** Bu oturumda seçilen dosya; yoksa (sayfa yeniden açıldı) yalnız seçili saniye yazılır. */
  file: File | null;
  durationS: number;
  valueMs: number;
  disabled?: boolean;
  /** Seçim bırakılınca (600 ms sonra) çağrılır; çağıran kaydeder. */
  onChange: (ms: number) => void;
}

const COMMIT_DELAY_MS = 600;

/** O1 "Kapak karesi": kaydırıcı + önizleme karesi (spec K17 coverOffsetMs). */
export function CoverFramePicker({ file, durationS, valueMs, disabled, onChange }: Props) {
  const [ms, setMs] = useState(valueMs);
  // Sunucudan yeni değer gelirse (başka sekme, yeniden yükleme) yerel değer ona döner.
  const [seen, setSeen] = useState(valueMs);
  if (seen !== valueMs) {
    setSeen(valueMs);
    setMs(valueMs);
  }
  const video = useRef<HTMLVideoElement>(null);
  const timer = useRef<number | null>(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const maxMs = Math.max(0, Math.floor(durationS * 1000) - 1);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  useEffect(() => {
    if (video.current) video.current.currentTime = ms / 1000;
  }, [ms, url]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function commit() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (ms !== valueMs) onChange(ms);
    }, COMMIT_DELAY_MS);
  }

  if (!url) {
    return (
      <p className="text-[13px] text-muted-foreground">
        {coverLabel(valueMs)} · değiştirmek için videoyu yeniden seç
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="kapak-karesi" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Kapak karesi
      </label>
      <div className="flex items-center gap-3">
        <video
          ref={video}
          src={url}
          muted
          playsInline
          preload="auto"
          aria-label="Seçili kapak karesi"
          className="h-24 w-[54px] flex-none rounded-lg border-[3px] border-primary bg-foreground object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            id="kapak-karesi"
            type="range"
            min={0}
            max={maxMs}
            step={100}
            value={Math.min(ms, maxMs)}
            disabled={disabled}
            onChange={(e) => setMs(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            className="h-11 w-full accent-[var(--color-primary)]"
          />
          <p className="text-[13px] text-muted-foreground">{coverLabel(ms)}</p>
        </div>
      </div>
    </div>
  );
}
