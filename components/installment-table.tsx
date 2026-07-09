"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

export interface InstallmentTableItem {
  id: string;
  due_date: string;
  amount: number;
  status: "bekliyor" | "odendi";
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: PaymentMethod | null;
}

interface InstallmentTableProps {
  installments: InstallmentTableItem[];
  role: "yonetici" | "danisman";
  today: string;
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

function moneyInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function parseTl(value: string) {
  return Number(value.replace(",", ".").trim());
}

export function InstallmentTable({ installments, role, today }: InstallmentTableProps) {
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

  function openPayModal(installment: InstallmentTableItem) {
    setError(null);
    setPaying(installment);
    setPaidAmount(moneyInput(installment.amount));
    setPaymentMethod("havale");
    setPaidAt(todayInIstanbul());
  }

  function submitPaid() {
    if (!paying) return;
    setError(null);
    startTransition(async () => {
      const result = await markInstallmentPaid(
        paying.id,
        parseTl(paidAmount),
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
    setEditAmount(moneyInput(installment.amount));
    setEditDueDate(installment.due_date);
  }

  function submitEdit() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const result = await updateInstallment(editing.id, {
        amountTl: parseTl(editAmount),
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
      <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
        Bu planda henüz taksit yok.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-200">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Vade</th>
              <th className="px-4 py-3 text-right">Tutar</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {sorted.map((installment) => {
              const overdue = installment.status === "bekliyor" && installment.due_date < today;

              return (
                <tr key={installment.id} className={overdue ? "bg-red-50/70" : undefined}>
                  <td className="px-4 py-3 font-medium text-zinc-800">
                    {formatDate(installment.due_date)}
                    {overdue ? (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Geciken
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-950">
                    {formatTRY(tlToKurus(installment.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        installment.status === "odendi"
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {installment.status === "odendi" ? "Ödendi" : "Bekliyor"}
                    </span>
                    {installment.payment_method ? (
                      <span className="ml-2 text-xs text-zinc-500">
                        {label(PAYMENT_METHODS, installment.payment_method)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {installment.status === "bekliyor" ? (
                        <button
                          type="button"
                          onClick={() => openPayModal(installment)}
                          className="rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
                        >
                          Ödendi işaretle
                        </button>
                      ) : null}
                      {role === "yonetici" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(installment)}
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300"
                          >
                            Düzenle
                          </button>
                          {installment.status === "odendi" ? (
                            <button
                              type="button"
                              onClick={() => revert(installment.id)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-300"
                            >
                              Geri Al
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {paying ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-zinc-950/40 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-3xl bg-white p-5 shadow-xl sm:max-w-md">
            <h2 className="text-lg font-semibold text-zinc-950">Taksiti ödendi işaretle</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-zinc-700">
                Ödenen tutar
                <input
                  inputMode="decimal"
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700">
                Yöntem
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {label(PAYMENT_METHODS, method)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-zinc-700">
                Ödeme tarihi
                <input
                  type="date"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPaying(null)}
                disabled={isPending}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submitPaid}
                disabled={isPending}
                className="flex-1 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {isPending ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-zinc-950/40 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-3xl bg-white p-5 shadow-xl sm:max-w-md">
            <h2 className="text-lg font-semibold text-zinc-950">Taksiti düzenle</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-zinc-700">
                Tutar
                <input
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700">
                Vade
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(event) => setEditDueDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={isPending}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={isPending}
                className="flex-1 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
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
