"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import {
  markInstallmentPaid,
  revertInstallment,
  updateInstallment,
} from "@/actions/payments";
import {
  PAYMENT_METHODS,
  label,
  type PaymentMethod,
} from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";
import { badgeClass, INSTALLMENT_STATUS_STYLES } from "@/lib/status-styles";
import { formatTlInput, parseTlInput } from "@/lib/tl-input";

export interface InstallmentTableItem {
  id: string;
  due_date: string;
  amount: number;
  status: "bekliyor" | "odendi" | "iptal";
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: PaymentMethod | null;
  /** Kalem etiketi (Aidat / Kitap-Kırtasiye / Servis) — birden çok plan tek takvimde toplandığında gösterilir. */
  itemLabel?: string;
  /** Tutar henüz kesinleşmedi (bekleyen zamlı taksit). */
  tentative?: boolean;
}

interface InstallmentTableProps {
  installments: InstallmentTableItem[];
  role: "yonetici" | "danisman";
  today: string;
  /** Kalem sütununu + aya göre gruplamayı göster (öğrenci detayında tüm planlar tek takvimde). */
  showItemColumn?: boolean;
  /** false: satır başına "Ödendi işaretle" gösterilmez (ödeme sayfanın "Ödeme al" düğmesinden alınır). */
  allowPay?: boolean;
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

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function formatMonth(date: string) {
  return monthFormatter.format(new Date(`${date}T12:00:00+03:00`));
}

export function InstallmentTable({ installments, role, today, showItemColumn = false, allowPay = true }: InstallmentTableProps) {
  const router = useRouter();
  const [paying, setPaying] = useState<InstallmentTableItem | null>(null);
  const [editing, setEditing] = useState<InstallmentTableItem | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("havale");
  const [paidAt, setPaidAt] = useState(() => todayInIstanbul());
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sorted = useMemo(
    () =>
      [...installments].sort(
        (a, b) => a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
      ),
    [installments],
  );

  // Aya göre alt-toplam (YYYY-MM) — grup başlığında "Eylül · 70.000 ₺" göstermek için.
  const monthTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of sorted) {
      const key = item.due_date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + tlToKurus(item.amount));
    }
    return map;
  }, [sorted]);

  const columnCount = showItemColumn ? 5 : 4;

  function openPayModal(installment: InstallmentTableItem) {
    setError(null);
    setPaying(installment);
    setPaidAmount(formatTlInput(installment.amount));
    setPaymentMethod("havale");
    setPaidAt(todayInIstanbul());
  }

  function submitPaid() {
    if (!paying) return;
    const amount = parseTlInput(paidAmount);
    if (amount === null) {
      setError("Geçerli bir tutar girin");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await markInstallmentPaid(
        paying.id,
        amount,
        paymentMethod,
        paidAt,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setPaying(null);
      router.refresh();
    });
  }

  function openEdit(installment: InstallmentTableItem) {
    setError(null);
    setEditing(installment);
    setEditAmount(formatTlInput(installment.amount));
    setEditDueDate(installment.due_date);
  }

  function submitEdit() {
    if (!editing) return;
    const amount = parseTlInput(editAmount);
    if (amount === null) {
      setError("Geçerli bir tutar girin");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateInstallment(editing.id, {
        amountTl: amount,
        dueDate: editDueDate,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function revert(id: string) {
    if (!window.confirm("Bu ödemenin geri alınmasını onaylıyor musunuz?")) return;
    setError(null);
    startTransition(async () => {
      const result = await revertInstallment(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (installments.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
        Bu planda henüz taksit yok.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="hidden overflow-x-auto rounded-2xl border border-border sm:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Vade</th>
              {showItemColumn ? <th className="px-4 py-3">Kalem</th> : null}
              <th className="px-4 py-3 text-right">Tutar</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {(() => {
              let lastMonth: string | null = null;
              const out: React.ReactNode[] = [];
              for (const installment of sorted) {
                const overdue = installment.status === "bekliyor" && installment.due_date < today;
                const monthKey = installment.due_date.slice(0, 7);

                // Aya göre gruplama başlığı (yalnız birleşik takvimde).
                if (showItemColumn && monthKey !== lastMonth) {
                  lastMonth = monthKey;
                  out.push(
                    <tr key={`m-${monthKey}`} className="bg-muted/60">
                      <td
                        colSpan={columnCount}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        <span className="text-foreground">{formatMonth(installment.due_date)}</span>
                        <span className="ml-2 tabular-nums">
                          · {formatTRY(monthTotals.get(monthKey) ?? 0)}
                        </span>
                      </td>
                    </tr>,
                  );
                }

                out.push(
                <tr key={installment.id} className={overdue ? "bg-red-50/70" : undefined}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatDate(installment.due_date)}
                    {overdue ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                        Geciken
                      </span>
                    ) : null}
                  </td>
                  {showItemColumn ? (
                    <td className="px-4 py-3 text-muted-foreground">
                      {installment.itemLabel ?? "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                    {installment.tentative ? (
                      <span
                        title="Kesinleşmedi"
                        className="mr-2 rounded-full bg-muted px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground"
                      >
                        Kesinleşmedi
                      </span>
                    ) : null}
                    {formatTRY(tlToKurus(installment.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={badgeClass(INSTALLMENT_STATUS_STYLES[installment.status])}>
                      {installment.status === "odendi"
                        ? "Ödendi"
                        : installment.status === "iptal"
                          ? "İptal"
                          : "Bekliyor"}
                    </span>
                    {installment.payment_method ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {label(PAYMENT_METHODS, installment.payment_method)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {allowPay && installment.status === "bekliyor" ? (
                        <button
                          type="button"
                          onClick={() => openPayModal(installment)}
                          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Banknote aria-hidden className="size-4" />
                          Ödendi işaretle
                        </button>
                      ) : null}
                      {role === "yonetici" && installment.status !== "iptal" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(installment)}
                            className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Düzenle
                          </button>
                          {installment.status === "odendi" ? (
                            <button
                              type="button"
                              onClick={() => revert(installment.id)}
                              className="min-h-11 cursor-pointer rounded-xl border border-red-200 bg-destructive-soft px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Geri Al
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>,
                );
              }
              return out;
            })()}
          </tbody>
        </table>
      </div>

      {/* Mobil: satırlar kart olarak (tablo telefonda taşmasın, butonlar erişilir kalsın) */}
      <div className="space-y-2 sm:hidden">
        {(() => {
          let lastMonth: string | null = null;
          const out: React.ReactNode[] = [];
          for (const installment of sorted) {
            const overdue = installment.status === "bekliyor" && installment.due_date < today;
            const monthKey = installment.due_date.slice(0, 7);
            if (showItemColumn && monthKey !== lastMonth) {
              lastMonth = monthKey;
              out.push(
                <div
                  key={`mm-${monthKey}`}
                  className="flex items-center justify-between px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <span className="text-foreground">{formatMonth(installment.due_date)}</span>
                  <span className="tabular-nums">{formatTRY(monthTotals.get(monthKey) ?? 0)}</span>
                </div>,
              );
            }
            out.push(
              <div
                key={installment.id}
                className={`rounded-2xl border p-4 ${overdue ? "border-red-200 bg-red-50/70" : "border-border bg-surface"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{formatDate(installment.due_date)}</p>
                    {showItemColumn && installment.itemLabel ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{installment.itemLabel}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-foreground">
                      {installment.tentative ? (
                        <span
                        title="Kesinleşmedi"
                        className="mr-2 rounded-full bg-muted px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground"
                      >
                        Kesinleşmedi
                      </span>
                      ) : null}
                      {formatTRY(tlToKurus(installment.amount))}
                    </p>
                    <span className={`mt-1 inline-block ${badgeClass(INSTALLMENT_STATUS_STYLES[installment.status])}`}>
                      {installment.status === "odendi"
                        ? "Ödendi"
                        : installment.status === "iptal"
                          ? "İptal"
                          : "Bekliyor"}
                    </span>
                    {installment.payment_method ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {label(PAYMENT_METHODS, installment.payment_method)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {allowPay && installment.status === "bekliyor" ? (
                    <button
                      type="button"
                      onClick={() => openPayModal(installment)}
                      className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Banknote aria-hidden className="size-4" />
                      Ödendi işaretle
                    </button>
                  ) : null}
                  {role === "yonetici" && installment.status !== "iptal" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(installment)}
                        className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Düzenle
                      </button>
                      {installment.status === "odendi" ? (
                        <button
                          type="button"
                          onClick={() => revert(installment.id)}
                          className="min-h-11 cursor-pointer rounded-xl border border-red-200 bg-destructive-soft px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Geri Al
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>,
            );
          }
          return out;
        })()}
      </div>

      {paying ? (
        <div
          className="scrim fixed inset-0 z-50 flex animate-scrim-in items-end p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-thick w-full animate-materialize rounded-[1.75rem] p-5 sm:max-w-md">
            <h2 className="text-lg font-semibold text-foreground">Taksiti ödendi işaretle</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Ödenen tutar
                <input
                  inputMode="decimal"
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Yöntem
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {label(PAYMENT_METHODS, method)}
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
                  className="mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPaying(null)}
                disabled={isPending}
                className="min-h-11 flex-1 cursor-pointer rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submitPaid}
                disabled={isPending}
                className="min-h-11 flex-1 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div
          className="scrim fixed inset-0 z-50 flex animate-scrim-in items-end p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-thick w-full animate-materialize rounded-[1.75rem] p-5 sm:max-w-md">
            <h2 className="text-lg font-semibold text-foreground">Taksiti düzenle</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Tutar
                <input
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Vade
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(event) => setEditDueDate(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={isPending}
                className="min-h-11 flex-1 cursor-pointer rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={isPending}
                className="min-h-11 flex-1 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
