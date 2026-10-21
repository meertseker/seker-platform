"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewInstallmentRevert, revertInstallment } from "@/actions/payments";
import { Sheet } from "@/components/sheet";

const secondaryButton =
  "min-h-12 flex-1 cursor-pointer rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Ödenmiş taksitin "Geri al" onayı. Önce neyin geri alınacağı sunucudan okunur
 * ("Bu işlem 14.495 ₺'lik ödemenin tamamını geri alır (2 taksit)"), kullanıcı onaylarsa
 * ödemenin tamamı tek işlemde geri alınır.
 */
export function PaymentRevertDialog({
  installmentId,
  onClose,
  onDone,
}: {
  installmentId: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [canRevert, setCanRevert] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void previewInstallmentRevert(installmentId).then((result) => {
      if (cancelled) return;
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("preview" in result && result.preview) {
        setText(result.text);
        setCanRevert(result.preview.allowed && !result.preview.blocker);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [installmentId]);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await revertInstallment(installmentId);
      if (result.error) {
        setError(result.error);
        setCanRevert(false);
        return;
      }
      onDone?.();
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet open onClose={onClose} title="Ödemeyi geri al">
      {text === null && !error ? (
        <p className="text-sm text-muted-foreground">Ödeme bilgisi okunuyor…</p>
      ) : null}
      {text ? <p className="text-base text-foreground">{text}</p> : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} disabled={isPending} className={secondaryButton}>
          Vazgeç
        </button>
        {canRevert ? (
          <button
            type="button"
            onClick={confirm}
            disabled={isPending}
            className="min-h-12 flex-1 cursor-pointer rounded-xl bg-red-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Geri alınıyor…" : "Ödemeyi geri al"}
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}
