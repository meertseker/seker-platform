"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPaymentDay } from "@/actions/payments";
import { Sheet } from "@/components/sheet";
import { paymentDayLabel, type PaymentDay } from "@/lib/payment-day";

const QUICK_DAYS: PaymentDay[] = [1, 5, 10, 15, 16, 20, 25, "son"];

const chip = (active: boolean) =>
  `flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    active ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-foreground hover:bg-muted"
  }`;

/** Öğrenci sayfasında "Ödeme günü: Ay sonu · Değiştir". */
export function PaymentDayControl({
  studentId,
  studentName,
  current,
  hasKitap,
}: {
  studentId: string;
  studentName: string;
  current: PaymentDay | null;
  hasKitap: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<PaymentDay>(current ?? "son");
  const [custom, setCustom] = useState("");
  const [includeKitap, setIncludeKitap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    const chosen: PaymentDay = custom.trim() ? Number(custom) : day;
    if (chosen !== "son" && (!Number.isInteger(chosen) || chosen < 1 || chosen > 31)) {
      return setError("Gün 1-31 arasında olmalı");
    }
    startTransition(async () => {
      const result = await setPaymentDay(studentId, chosen, includeKitap);
      if (result.error) return setError(result.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">Ödeme günü</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-foreground">{paymentDayLabel(current)}</span>
        <button
          type="button"
          onClick={() => {
            setDay(current ?? "son");
            setCustom("");
            setOpen(true);
          }}
          className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Değiştir
        </button>
      </dd>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Ödeme günü · ${studentName}`}
        description="Veliyle konuştuğunuz gün. Bekleyen aidat taksitleri bu güne taşınır; gecikme uyarısı bu günden sonra çıkar."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {QUICK_DAYS.map((option) => (
              <button
                key={String(option)}
                type="button"
                onClick={() => {
                  setDay(option);
                  setCustom("");
                }}
                className={chip(!custom && day === option)}
              >
                {option === "son" ? "Ay sonu" : option}
              </button>
            ))}
          </div>
          <label className="block text-sm font-semibold text-foreground">
            Başka bir gün
            <input
              inputMode="numeric"
              value={custom}
              onChange={(event) => setCustom(event.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="Örn. 12"
              className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          {hasKitap ? (
            <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base text-foreground">
              <input
                type="checkbox"
                checked={includeKitap}
                onChange={(event) => setIncludeKitap(event.target.checked)}
                className="size-5"
              />
              Kırtasiye taksitlerini de bu güne taşı
            </label>
          ) : null}
          {error ? <p className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="flex min-h-14 w-full cursor-pointer items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {isPending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
