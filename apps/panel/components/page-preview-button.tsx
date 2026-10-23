"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { openPagePreview } from "@/actions/pages";
import { Sheet } from "@/components/sheet";

type PreviewResult = { url: string } | { error: string };

const SAVE_FAILED = "Kaydedilemedi, tekrar dene";

/**
 * Önce bekleyen taslak kaydı gönderilir (önizleme sunucudaki metni gösterir), sonra önizleme adresi alınır.
 * Kayıt reddedilir ya da hata döndürürse önizleme açılmaz.
 */
export async function runPreview(
  flush: () => Promise<unknown>,
  open: () => Promise<PreviewResult>,
): Promise<PreviewResult> {
  try {
    const saved = await flush();
    if (saved && typeof saved === "object" && "ok" in saved && (saved as { ok: unknown }).ok === false) {
      return { error: SAVE_FAILED };
    }
  } catch {
    return { error: SAVE_FAILED };
  }
  return open();
}

/** "Sayfayı önizle": sitedeki gerçek görünümü telefon genişliğinde (390 px) açar. */
export function PagePreviewButton({ contentId, flush }: { contentId: string; flush: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function preview() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await runPreview(flush, () => openPagePreview(contentId));
      if ("url" in res) setUrl(res.url);
      else setError(res.error);
    } catch {
      setError("Bağlantı yok, önizleme açılamadı. Bağlantı gelince tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => void preview()}
        disabled={busy}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-input bg-surface text-[16px] font-bold text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <Eye aria-hidden="true" className="size-5" />
        {busy ? "Önizleme hazırlanıyor…" : "Sayfayı önizle"}
      </button>
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive-strong">
          {error}
        </p>
      ) : null}
      <Sheet open={url !== null} onClose={() => setUrl(null)} title="Sayfa önizlemesi">
        {url ? (
          <iframe
            src={url}
            title="Sayfa önizlemesi"
            className="mx-auto block h-[70dvh] w-full max-w-[390px] rounded-xl border border-border bg-surface"
          />
        ) : null}
      </Sheet>
    </div>
  );
}
