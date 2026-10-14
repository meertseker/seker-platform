"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote } from "lucide-react";
import {
  markInstallmentPaid,
  revertInstallment,
  updateInstallment,
} from "@/actions/payments";
import { ITEM_TYPES, PAYMENT_METHODS, label, type PaymentMethod } from "@/lib/constants";
import { formatTRY, kurusToTl } from "@/lib/money";
import type { CellState, MatrixCell, MatrixCellItem } from "@/lib/payment-matrix";
import { formatTlInput, parseTlInput } from "@/lib/tl-input";

interface PaymentMatrixCellProps {
  cell: MatrixCell;
  studentName: string;
  /** "Ekim 2026" — ekran okuyucu ve panel başlığı için tam ay adı. */
  monthLabel: string;
  role: "yonetici" | "danisman";
}

const paymentMethods = Object.keys(PAYMENT_METHODS) as PaymentMethod[];

const STATE_LABELS: Record<CellState, string> = {
  bos: "Taksit yok",
  odendi: "Ödendi",
  kismi: "Kısmi ödendi",
  gecikti: "Gecikti",
  bekliyor: "Bekliyor",
};

const STATE_CLASSES: Record<CellState, string> = {
  bos: "",
  odendi: "bg-accent-soft text-accent-strong",
  kismi: "bg-warning-soft text-amber-800",
  gecikti: "bg-destructive-soft text-red-700",
  bekliyor: "text-muted-foreground hover:bg-muted",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Istanbul",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00+03:00`));
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type FormTarget = { mode: "pay" | "edit"; item: MatrixCellItem };

export function PaymentMatrixCell({ cell, studentName, monthLabel, role }: PaymentMatrixCellProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<FormTarget | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("havale");
  const [paidAt, setPaidAt] = useState(() => todayInIstanbul());
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setTarget(null);
    setError(null);
    triggerRef.current?.focus();
  }

  function openPay(item: MatrixCellItem) {
    setError(null);
    setTarget({ mode: "pay", item });
    setAmount(formatTlInput(kurusToTl(item.amountKurus)));
    setMethod("havale");
    setPaidAt(todayInIstanbul());
  }

  function openEdit(item: MatrixCellItem) {
    setError(null);
    setTarget({ mode: "edit", item });
    setAmount(formatTlInput(kurusToTl(item.amountKurus)));
    setDueDate(item.dueDate);
  }

  function submit() {
    if (!target) return;
    const parsed = parseTlInput(amount);
    if (parsed === null) {
      setError("Geçerli bir tutar girin");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result =
        target.mode === "pay"
          ? await markInstallmentPaid(target.item.installmentId, parsed, method, paidAt)
          : await updateInstallment(target.item.installmentId, {
              amountTl: parsed,
              dueDate,
            });
      if (result.error) {
        setError(result.error);
        return;
      }
      // Panel açık kalır: aynı ayın diğer kalemi de sırada olabilir.
      setTarget(null);
      router.refresh();
    });
  }

  function revert(item: MatrixCellItem) {
    if (!window.confirm("Bu ödemenin geri alınmasını onaylıyor musunuz?")) return;
    setError(null);
    startTransition(async () => {
      const result = await revertInstallment(item.installmentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (cell.state === "bos") {
    return (
      <td className="px-2 py-2 text-center text-sm text-muted-foreground/60" aria-label="Taksit yok">
        —
      </td>
    );
  }

  const stateLabel = STATE_LABELS[cell.state];
  const display =
    cell.state === "kismi"
      ? `${formatTRY(cell.paidKurus)} / ${formatTRY(cell.totalKurus)}`
      : formatTRY(cell.state === "odendi" ? cell.paidKurus : cell.totalKurus);

  return (
    <td
      className={`p-1 align-middle ${cell.overdue && cell.state === "kismi" ? "border-l-2 border-destructive" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${studentName}, ${monthLabel}, ${display}, ${stateLabel}`}
        className={`flex min-h-11 w-full cursor-pointer flex-col items-end justify-center gap-0.5 rounded-lg px-2 py-1.5 text-right text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${STATE_CLASSES[cell.state]}`}
      >
        <span className="whitespace-nowrap">{display}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium">
          {cell.overdue ? <AlertTriangle aria-hidden className="size-3" /> : null}
          {stateLabel}
          {cell.cancelledCount > 0 ? (
            <span className="text-muted-foreground">· {cell.cancelledCount} iptal</span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-zinc-950/40 p-4 sm:items-center sm:justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${studentName} · ${monthLabel} ödemeleri`}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
            }}
            className="w-full rounded-2xl border border-border bg-surface p-5 text-left shadow-xl focus:outline-none sm:max-w-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{monthLabel}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{studentName}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="min-h-11 cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Kapat
              </button>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <ul className="mt-4 divide-y divide-border">
              {cell.items.map((item) => {
                const editing = target?.item.installmentId === item.installmentId;

                return (
                  <li key={item.installmentId} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">
                          {label(ITEM_TYPES, item.itemType)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(item.dueDate)} vadeli
                          {item.status === "odendi" && item.paymentMethod
                            ? ` · ${label(PAYMENT_METHODS, item.paymentMethod)}`
                            : null}
                          {item.overdue ? " · gecikti" : null}
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums text-foreground">
                        {formatTRY(item.paidAmountKurus ?? item.amountKurus)}
                      </p>
                    </div>

                    {editing ? (
                      <div className="mt-3 space-y-3 rounded-xl bg-muted/60 p-3">
                        <label className="block text-sm font-medium text-foreground">
                          {target.mode === "pay" ? "Ödenen tutar" : "Tutar"}
                          <input
                            inputMode="decimal"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          />
                        </label>
                        {target.mode === "pay" ? (
                          <>
                            <label className="block text-sm font-medium text-foreground">
                              Yöntem
                              <select
                                value={method}
                                onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                              >
                                {paymentMethods.map((value) => (
                                  <option key={value} value={value}>
                                    {label(PAYMENT_METHODS, value)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-foreground">
                              Ödeme tarihi
                              <input
                                type="date"
                                value={paidAt}
                                onChange={(event) => setPaidAt(event.target.value)}
                                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                              />
                            </label>
                          </>
                        ) : (
                          <label className="block text-sm font-medium text-foreground">
                            Vade
                            <input
                              type="date"
                              value={dueDate}
                              onChange={(event) => setDueDate(event.target.value)}
                              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                            />
                          </label>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setTarget(null)}
                            disabled={isPending}
                            className="min-h-11 flex-1 cursor-pointer rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Vazgeç
                          </button>
                          <button
                            type="button"
                            onClick={submit}
                            disabled={isPending}
                            className="min-h-11 flex-1 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isPending ? "Kaydediliyor..." : "Kaydet"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.status === "bekliyor" ? (
                          <button
                            type="button"
                            onClick={() => openPay(item)}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <Banknote aria-hidden className="size-4" />
                            Ödendi işaretle
                          </button>
                        ) : null}
                        {role === "yonetici" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              Düzenle
                            </button>
                            {item.status === "odendi" ? (
                              <button
                                type="button"
                                onClick={() => revert(item)}
                                disabled={isPending}
                                className="min-h-11 cursor-pointer rounded-xl border border-red-200 bg-destructive-soft px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Geri Al
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold">
              <span className="text-muted-foreground">Toplam</span>
              <span className="tabular-nums text-foreground">
                {formatTRY(cell.paidKurus)} / {formatTRY(cell.totalKurus)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </td>
  );
}
