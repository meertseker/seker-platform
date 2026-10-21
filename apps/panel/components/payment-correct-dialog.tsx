"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctPayment, previewPaymentCorrection } from "@/actions/payments";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { PAYMENT_METHODS, label, type PaymentMethod } from "@/lib/constants";
import { formatTRY, kurusToTl, tlToKurus } from "@/lib/money";
import { formatTlInput, parseTlInput } from "@/lib/tl-input";

type Preview = {
  kind: "odeme" | "ice_aktarma";
  blocker: string | null;
  capacityKurus: number;
  totalKurus: number;
  parts: { method: PaymentMethod | null; kurus: number; paidOn: string }[];
  note: string | null;
};

const METHOD_OPTIONS: PaymentMethod[] = ["nakit", "pos", "havale", "diger"];

const inputClass =
  "min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";
const secondaryButton =
  "min-h-12 flex-1 cursor-pointer rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const dayFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });
const dayText = (day: string) => dayFormatter.format(new Date(`${day}T12:00:00+03:00`));

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

interface PartState {
  method: PaymentMethod;
  amount: string;
  paidOn: string;
}

/**
 * "Ödemeyi düzelt" (yönetici): yanlış girilen tutar, yöntem ya da tarih tek pencerede düzelir.
 * Arka planda ödeme geri alınır ve doğru değerlerle yeniden kaydedilir (tek işlem).
 */
export function PaymentCorrectDialog({
  installmentId,
  title,
  onClose,
  onDone,
}: {
  installmentId: string;
  /** "Ekim aidat · Elif Demir" */
  title?: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parts, setParts] = useState<PartState[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void previewPaymentCorrection(installmentId).then((result) => {
      if (cancelled) return;
      if ("error" in result && result.error) return setLoadError(result.error);
      const data = result as Preview;
      setPreview(data);
      const initial = data.parts.length
        ? data.parts.slice(0, 2).map((part) => ({
            method: part.method ?? "nakit",
            amount: formatTlInput(kurusToTl(part.kurus)),
            paidOn: part.paidOn,
          }))
        : [{ method: "nakit" as PaymentMethod, amount: "", paidOn: todayInIstanbul() }];
      setParts(initial);
      setNote(data.note ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [installmentId]);

  const parsed = parts.map((part) => parseTlInput(part.amount));
  const totalKurus = parsed.reduce<number>((sum, value) => sum + (value === null ? 0 : tlToKurus(value)), 0);
  const capacity = preview?.capacityKurus ?? 0;
  const remainder = capacity - totalKurus;

  function update(index: number, patch: Partial<PartState>) {
    setParts((current) => current.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  }

  function save() {
    setError(null);
    if (parsed.some((value) => value === null || value < 0)) return setError("Geçerli bir tutar girin");
    if (parts.length === 2 && parts[0].method === parts[1].method && parts[0].paidOn === parts[1].paidOn) {
      return setError("İki parça aynı yöntem ve aynı günse tek parça olarak girin");
    }
    if (totalKurus > capacity) {
      return setError(
        `Doğru tutar bu ödemenin taksit toplamını (${formatTRY(capacity)}) aşamaz. Fazlası başka bir ayın ödemesiyse o ay için ayrıca "Ödeme al" kullanın.`,
      );
    }
    startTransition(async () => {
      const result = await correctPayment({
        installmentId,
        payments: parts.map((part, i) => ({ method: part.method, amountTl: parsed[i] ?? 0, paidOn: part.paidOn })),
        note,
      });
      if ("error" in result && result.error) return setError(result.error);
      showToast({ text: "Ödeme düzeltildi" });
      onDone?.();
      onClose();
      router.refresh();
    });
  }

  const today = todayInIstanbul();

  return (
    <Sheet open onClose={onClose} title="Ödemeyi düzelt" description={title}>
      {!preview && !loadError ? <p className="text-sm text-muted-foreground">Ödeme bilgisi okunuyor…</p> : null}
      {loadError ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">{loadError}</p>
      ) : null}

      {preview ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-muted/60 p-3 text-sm">
            <p className="font-semibold text-foreground">Şu an kayıtlı</p>
            <ul className="mt-1 space-y-0.5 text-foreground">
              {preview.parts.map((part, i) => (
                <li key={i} className="tabular-nums">
                  {formatTRY(part.kurus)} · {part.method ? label(PAYMENT_METHODS, part.method) : "Yöntem yok"} · {dayText(part.paidOn)}
                </li>
              ))}
            </ul>
            {preview.kind === "ice_aktarma" ? (
              <p className="mt-1 text-muted-foreground">İçe aktarılan kayıt: yalnız bu satır düzeltilir.</p>
            ) : null}
          </div>

          {preview.blocker ? (
            <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
              Bu ödeme düzeltilemez: ödemeden sonra başka işlem yapılmış ({preview.blocker}). Önce sonraki işlemi geri alın.
            </p>
          ) : (
            <>
              {parts.map((part, index) => (
                <fieldset key={index} className="space-y-2 rounded-xl border border-border p-3">
                  <legend className="px-1 text-sm font-semibold text-foreground">
                    {parts.length > 1 ? `${index + 1}. parça` : "Doğru ödeme"}
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-sm font-semibold text-foreground">
                      Tutar
                      <input
                        inputMode="decimal"
                        value={part.amount}
                        onChange={(event) => update(index, { amount: event.target.value })}
                        className={`mt-1 ${inputClass}`}
                      />
                    </label>
                    <label className="block text-sm font-semibold text-foreground">
                      Yöntem
                      <select
                        value={part.method}
                        onChange={(event) => update(index, { method: event.target.value as PaymentMethod })}
                        className={`mt-1 ${inputClass}`}
                      >
                        {METHOD_OPTIONS.map((method) => (
                          <option key={method} value={method}>
                            {label(PAYMENT_METHODS, method)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block text-sm font-semibold text-foreground">
                    Ödeme tarihi
                    <input
                      type="date"
                      value={part.paidOn}
                      max={today}
                      onChange={(event) => update(index, { paidOn: event.target.value })}
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  {parts.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setParts((current) => current.filter((_, i) => i !== index))}
                      className="min-h-11 cursor-pointer text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Bu parçayı kaldır
                    </button>
                  ) : null}
                </fieldset>
              ))}
              {parts.length < 2 ? (
                <button
                  type="button"
                  onClick={() => setParts((current) => [...current, { method: "pos", amount: "", paidOn: current[0]?.paidOn ?? today }])}
                  className="min-h-11 cursor-pointer text-sm font-semibold text-primary-strong underline-offset-2 hover:underline"
                >
                  + İkinci yöntem ekle
                </button>
              ) : null}

              <label className="block text-sm font-semibold text-foreground">
                Not (isteğe bağlı)
                <input value={note} onChange={(event) => setNote(event.target.value)} className={`mt-1 ${inputClass}`} />
              </label>

              <p className="text-sm text-muted-foreground">
                Bu ödeme en fazla {formatTRY(capacity)} olabilir.
                {remainder > 0 && totalKurus > 0
                  ? ` Eksik kalan ${formatTRY(remainder)} aynı vadeyle bekleyen taksit olarak açılır.`
                  : ""}
              </p>
            </>
          )}

          {error ? (
            <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">{error}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} disabled={isPending} className={secondaryButton}>
          Vazgeç
        </button>
        {preview && !preview.blocker ? (
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="min-h-12 flex-1 cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Kaydediliyor…" : "Düzeltmeyi kaydet"}
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}
