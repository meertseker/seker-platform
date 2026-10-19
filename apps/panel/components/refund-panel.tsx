"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordRefund } from "@/actions/students";
import { PAYMENT_METHODS, label, type PaymentMethod } from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";
import { parseTlInput } from "@/lib/tl-input";

export interface RefundItem {
  id: string;
  amount: number;
  method: PaymentMethod;
  refund_date: string;
  note: string | null;
  creatorName: string | null;
}

interface RefundPanelProps {
  studentId: string;
  canManage: boolean;
  refunds: RefundItem[];
}

const paymentMethods = Object.keys(PAYMENT_METHODS) as PaymentMethod[];

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00+03:00`));
}

export function RefundPanel({ studentId, canManage, refunds }: RefundPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("havale");
  const [refundDate, setRefundDate] = useState(() => todayInIstanbul());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const amountTl = parseTlInput(amount);
    if (amountTl === null || amountTl <= 0) {
      setError("Geçerli bir tutar girin");
      return;
    }
    // İade düzenlenemez ve silinemez: kaydetmeden önce tutarı açıkça onaylat.
    if (!window.confirm(`${formatTRY(tlToKurus(amountTl))} iade kaydedilsin mi? Kayıttan sonra değiştirilemez.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await recordRefund(studentId, amountTl, method, refundDate, note);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">İadeler</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ayrılan öğrenci için yapılan iade ödemeleri.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {open ? "Vazgeç" : "İade Kaydet"}
          </button>
        ) : null}
      </div>

      {open && canManage ? (
        <div className="mt-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-foreground">
              Tutar (TL)
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="5000"
                className="mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Yöntem
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                className="mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                {paymentMethods.map((value) => (
                  <option key={value} value={value}>
                    {label(PAYMENT_METHODS, value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-foreground">
              Tarih
              <input
                type="date"
                value={refundDate}
                onChange={(event) => setRefundDate(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-foreground">
            Not (opsiyonel)
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="İade ile ilgili not..."
              className="mt-2 block w-full resize-y rounded-2xl border border-input bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Kaydediliyor..." : "İadeyi Kaydet"}
          </button>
        </div>
      ) : null}

      <div className="mt-5">
        {refunds.length > 0 ? (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {refunds.map((refund) => (
              <li key={refund.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatTRY(tlToKurus(refund.amount))}
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      {label(PAYMENT_METHODS, refund.method)}
                    </span>
                  </p>
                  {refund.note ? (
                    <p className="mt-1 text-sm text-muted-foreground">{refund.note}</p>
                  ) : null}
                </div>
                <div className="text-left text-xs text-muted-foreground sm:text-right">
                  <p>{formatDate(refund.refund_date)}</p>
                  {refund.creatorName ? <p className="mt-0.5">{refund.creatorName}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Henüz iade kaydı yok.
          </p>
        )}
      </div>
    </section>
  );
}
