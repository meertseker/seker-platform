"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { usePaymentPanel } from "@/components/payment-matrix-cell";
import {
  PAYMENT_METHODS,
  label,
  type PaymentMethod,
} from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";
import { badgeClass, INSTALLMENT_STATUS_STYLES } from "@/lib/status-styles";

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
  today: string;
  /** Kalem sütununu + aya göre gruplamayı göster (öğrenci detayında tüm planlar tek takvimde). */
  showItemColumn?: boolean;
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

function statusText(status: InstallmentTableItem["status"]) {
  return status === "odendi" ? "Ödendi" : status === "iptal" ? "İptal" : "Bekliyor";
}

const openButton =
  "inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Bütün taksitlerin takvimi. Satıra dokununca o ayın ödeme paneli açılır (Ödemeler
 * ekranındaki hücre paneliyle aynı): ödeme alma, düzenleme ve geri alma oradan yapılır.
 */
export function InstallmentTable({ installments, today, showItemColumn = false }: InstallmentTableProps) {
  const panel = usePaymentPanel();

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

  /** Satırın panel anahtarı; iptal taksit ya da panel yoksa null. */
  function panelKey(installment: InstallmentTableItem) {
    return panel ? panel.keyFor(installment.id) : null;
  }

  function renderOpen(installment: InstallmentTableItem) {
    const key = panelKey(installment);
    if (!key || !panel) return null;
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          panel.open(key);
        }}
        aria-label={`${formatDate(installment.due_date)}${installment.itemLabel ? ` ${installment.itemLabel}` : ""} — ${
          installment.status === "bekliyor" ? "ödeme al" : "ayrıntı"
        }`}
        className={openButton}
      >
        {installment.status === "bekliyor" ? "Ödeme al" : "Ayrıntı"}
        <ChevronRight aria-hidden className="size-4" />
      </button>
    );
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
                const key = panelKey(installment);

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
                <tr
                  key={installment.id}
                  onClick={key && panel ? () => panel.open(key) : undefined}
                  className={`${overdue ? "bg-red-50/70" : ""} ${key ? "cursor-pointer hover:bg-muted/60" : ""}`}
                >
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
                      {statusText(installment.status)}
                    </span>
                    {installment.payment_method ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {label(PAYMENT_METHODS, installment.payment_method)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {renderOpen(installment)}
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
                      {statusText(installment.status)}
                    </span>
                    {installment.payment_method ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {label(PAYMENT_METHODS, installment.payment_method)}
                      </p>
                    ) : null}
                  </div>
                </div>
                {panelKey(installment) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {renderOpen(installment)}
                  </div>
                ) : null}
              </div>,
            );
          }
          return out;
        })()}
      </div>
    </div>
  );
}
