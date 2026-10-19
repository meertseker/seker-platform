"use client";

import { useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "seker_bugun_yardim";

function readClosed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "0";
  } catch {
    return false;
  }
}

function writeClosed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "0");
  } catch {
    // Depolama kapalıysa yardım bu oturumda kapalı kalır, yeniden açılışta yine görünür.
  }
}

const noopSubscribe = () => () => {};

/** Bugün başlığı + "?" yardımı. İlk açılışta açık; kapatılınca bir daha kendiliğinden açılmaz. */
export function TodayHeader({ dateLine }: { dateLine: string }) {
  // Sunucuda kapalı çizilir (hidrasyon uyumu); istemcide depolamaya göre açılır.
  const storedClosed = useSyncExternalStore(noopSubscribe, readClosed, () => true);
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? !storedClosed;

  function toggle() {
    if (open) writeClosed();
    setOverride(!open);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-[13px] text-muted-foreground">{dateLine}</p>
          <h1 className="text-[30px] font-bold leading-tight tracking-tight text-foreground">Bugün</h1>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label="Bu ekran nasıl kullanılır"
          aria-expanded={open}
          aria-controls="bugun-yardim"
          className="size-11 shrink-0 cursor-pointer rounded-full border border-border bg-surface text-lg font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ?
        </button>
      </div>

      {open ? (
        <div
          id="bugun-yardim"
          className="flex flex-col gap-1.5 rounded-[14px] border border-primary/25 bg-primary-soft p-3.5 text-sm leading-normal text-foreground"
        >
          <p className="font-bold">Bu ekran nasıl kullanılır?</p>
          <p>Listeyi yukarıdan aşağı bitir. En üstteki iş her zaman en acil olandır.</p>
          <p>
            <b>Şimdi ara:</b>{" "}Yeni gelen veliler. Sayaç 5 dakikaya kadar yeşil, 15&apos;ten sonra kırmızı.
          </p>
          <p>
            <b>Takip:</b>{" "}Daha önce ulaşamadığın veliler. Panel ne zaman arayacağını kendisi sıraya koyar.
          </p>
          <p>
            <b>Randevular:</b>{" "}Bugün okula gelecek veliler. Geldi ya da gelmedi işaretlenmeden gün kapanmaz.
          </p>
        </div>
      ) : null}
    </>
  );
}
