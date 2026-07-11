"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPaymentPlan } from "@/actions/payments";
import { ITEM_TYPES, label, type ItemType } from "@/lib/constants";
import { generateInstallments } from "@/lib/installments";
import { formatTRY, tlToKurus } from "@/lib/money";
import { formatTlInput, parseTlInput } from "@/lib/tl-input";

interface PlanWizardProps {
  studentId: string;
  initialOpen?: boolean;
  initialTotalTl?: number;
  initialInstallmentCount?: number;
  sourceOfferId?: string;
}

const itemTypes = Object.keys(ITEM_TYPES) as ItemType[];

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function PlanWizard({
  studentId,
  initialOpen = false,
  initialTotalTl,
  initialInstallmentCount,
  sourceOfferId,
}: PlanWizardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [itemType, setItemType] = useState<ItemType>("aidat");
  const [total, setTotal] = useState(
    initialTotalTl ? formatTlInput(initialTotalTl) : "",
  );
  const [count, setCount] = useState(initialInstallmentCount ?? 10);
  const [firstDueDate, setFirstDueDate] = useState(() => todayInIstanbul());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalTl = parseTlInput(total);
  const preview = useMemo(() => {
    if (totalTl === null || totalTl <= 0 || count < 1 || count > 12 || !firstDueDate) {
      return [];
    }

    try {
      return generateInstallments(tlToKurus(totalTl), count, firstDueDate);
    } catch {
      return [];
    }
  }, [count, firstDueDate, totalTl]);

  function submit() {
    if (totalTl === null) return;
    setError(null);
    startTransition(async () => {
      const result = await createPaymentPlan(
        studentId,
        itemType,
        totalTl,
        count,
        firstDueDate,
        sourceOfferId,
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.replace(`/ogrenciler/${studentId}`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">Ödeme planı</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Kalem tutarını taksitlere bölün; kuruş farkı son taksite eklenir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          {open ? "Sihirbazı kapat" : "Plan oluştur"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-medium text-zinc-700">
              Kalem tipi
              <select
                value={itemType}
                onChange={(event) => setItemType(event.target.value as ItemType)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              >
                {itemTypes.map((type) => (
                  <option key={type} value={type}>
                    {label(ITEM_TYPES, type)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-zinc-700">
              Toplam TL
              <input
                inputMode="decimal"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                placeholder="180000"
              />
            </label>

            <label className="block text-sm font-medium text-zinc-700">
              Taksit sayısı
              <input
                type="number"
                min={1}
                max={12}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </label>

            <label className="block text-sm font-medium text-zinc-700">
              İlk vade
              <input
                type="date"
                value={firstDueDate}
                onChange={(event) => setFirstDueDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </label>
          </div>

          {preview.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Vade</th>
                    <th className="px-4 py-3 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {preview.map((installment, index) => (
                    <tr key={`${installment.dueDate}-${index}`}>
                      <td className="px-4 py-3 font-medium text-zinc-700">{index + 1}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {new Intl.DateTimeFormat("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          timeZone: "Europe/Istanbul",
                        }).format(new Date(`${installment.dueDate}T12:00:00+03:00`))}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-950">
                        {formatTRY(installment.amountKurus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
              Önizleme için geçerli tutar, taksit sayısı ve vade girin.
            </p>
          )}

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={isPending || preview.length === 0}
            className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isPending ? "Kaydediliyor..." : "Onayla"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
