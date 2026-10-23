"use client";

import { useId } from "react";
import { Check, ImageIcon } from "lucide-react";
import { LP_MEDIA_OPTIONS, type LpMediaKey } from "@seker/shared/landing";

/** Sayfa görevinde fotoğraf seçimi: yalnız okulun hazır (çocuk yüzü olmayan) kareleri; yükleme yok. */
export function PageMediaSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (key: LpMediaKey) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const helpId = `${id}-yardim`;
  const selected = LP_MEDIA_OPTIONS.some((o) => o.key === value);
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={selected ? undefined : helpId}>
      <legend className="mb-1.5 text-[15px] font-bold text-foreground">Sayfanın fotoğrafı</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {LP_MEDIA_OPTIONS.map((o) => {
          const on = o.key === value;
          return (
            <label
              key={o.key}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-[15px] font-semibold text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                on ? "border-accent bg-accent-soft" : "border-input bg-surface"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name={`${id}-gorsel`}
                value={o.key}
                checked={on}
                disabled={disabled}
                onChange={() => onChange(o.key)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  on ? "bg-accent text-on-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {on ? <Check className="size-4" /> : <ImageIcon className="size-4" />}
              </span>
              {o.label}
            </label>
          );
        })}
      </div>
      {selected ? null : (
        <p id={helpId} className="text-[13px] text-muted-foreground">
          Okulun hazır fotoğraflarından birini seç. Yeni fotoğraf yüklenmez.
        </p>
      )}
    </fieldset>
  );
}
