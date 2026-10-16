"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
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
  gecikti: "Alınmadı",
  bekliyor: "Vadesi gelmedi",
};

/**
 * Aidat defterinin boyaları: yeşil ödendi, mor nakit ödendi, kırmızı alınmadı,
 * gri kısmi, boyasız henüz vadesi gelmedi.
 */
export const EXCEL_FILLS = {
  odendi: "bg-[#92D050] text-zinc-900",
  nakit: "bg-[#7030A0] text-white",
  kismi: "bg-[#A6A6A6] text-zinc-900",
  gecikti: "bg-[#FF0000] text-white",
  bekliyor: "text-foreground hover:bg-muted",
} as const;

function fillOf(cell: MatrixCell) {
  if (cell.state === "odendi") return cell.cash ? EXCEL_FILLS.nakit : EXCEL_FILLS.odendi;
  if (cell.state === "kismi") return EXCEL_FILLS.kismi;
  if (cell.state === "gecikti") return EXCEL_FILLS.gecikti;
  return EXCEL_FILLS.bekliyor;
}

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
    return <td className="border-l border-border px-2 py-2" aria-label="Taksit yok" />;
  }

  const stateLabel = cell.state === "odendi" && cell.cash ? "Nakit ödendi" : STATE_LABELS[cell.state];
  // Excel'deki gibi hücrede hep o kalemin tutarı yazar; durumu boya söyler.
  const display = formatTRY(cell.totalKurus);
  const hint =
    cell.state === "kismi"
      ? `${formatTRY(cell.paidKurus)} alındı`
      : cell.state === "bekliyor"
        ? null
        : stateLabel;

  return (
    <td className="border-l border-border p-0 align-middle">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${studentName}, ${monthLabel}, ${display}, ${stateLabel}`}
        className={`flex min-h-12 w-full cursor-pointer flex-col items-end justify-center gap-0.5 px-2 py-1.5 text-right text-sm font-semibold tabular-nums transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${fillOf(cell)}`}
      >
        <span className="whitespace-nowrap">{display}</span>
        {hint || cell.cancelledCount > 0 ? (
          <span className="whitespace-nowrap text-xs font-medium opacity-90">
            {hint}
            {cell.cancelledCount > 0 ? ` · ${cell.cancelledCount} iptal` : null}
          </span>
        ) : null}
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
                          {item.status === "odendi"
                            ? `${item.paidAt ? `${formatDate(item.paidAt.slice(0, 10))} ödendi` : "Ödendi"}${
                                item.paymentMethod ? ` · ${label(PAYMENT_METHODS, item.paymentMethod)}` : ""
                              }`
                            : `${formatDate(item.dueDate)} vadeli${item.overdue ? " · alınmadı" : ""}`}
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
