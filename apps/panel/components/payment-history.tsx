"use client";

import { useState } from "react";
import { PaymentCorrectDialog } from "@/components/payment-correct-dialog";
import { PaymentRevertDialog } from "@/components/payment-revert-dialog";
import { PAYMENT_METHODS, label } from "@/lib/constants";
import { formatTRY } from "@/lib/money";
import { installmentLabel } from "@/lib/payment-labels";
import type { PaymentHistoryEntry } from "@/lib/payment-history";
import type { Role } from "@/lib/role-access";

const SHOWN = 10;

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
const shortFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });
const day = (value: string) => new Date(`${value}T12:00:00+03:00`);

const button =
  "min-h-11 cursor-pointer rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function methodsText(entry: PaymentHistoryEntry) {
  const methodName = (method: PaymentHistoryEntry["parts"][number]["method"]) =>
    method ? label(PAYMENT_METHODS, method) : "Yöntem yok";
  if (entry.parts.length <= 1) return methodName(entry.parts[0]?.method ?? null);
  const days = new Set(entry.parts.map((part) => part.paidOn));
  return entry.parts
    .map((part) => `${formatTRY(part.kurus)} ${methodName(part.method)}${days.size > 1 ? ` (${shortFormatter.format(day(part.paidOn))})` : ""}`)
    .join(" + ");
}

function itemsText(entry: PaymentHistoryEntry) {
  return [...new Set(entry.items.map((item) => installmentLabel(item.itemType, item.dueDate)))].join(", ");
}

/**
 * Öğrencinin bütün tahsilatları, en yeniden eskiye: tarih, tutar, yöntem, kalem / ay, kim aldı, not.
 * Her kayıtta "Geri al"; yöneticide "Ödemeyi düzelt".
 */
export function PaymentHistory({ entries, role, studentName }: { entries: PaymentHistoryEntry[]; role: Role; studentName: string }) {
  const [showAll, setShowAll] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<PaymentHistoryEntry | null>(null);
  const shown = showAll ? entries : entries.slice(0, SHOWN);

  return (
    <section aria-labelledby="odeme-gecmisi" className="rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
        <h2 id="odeme-gecmisi" className="text-lg font-semibold text-foreground">
          Ödeme geçmişi
        </h2>
        <p className="text-sm text-muted-foreground">
          {entries.length} ödeme · toplam {formatTRY(entries.reduce((sum, entry) => sum + entry.totalKurus, 0))}
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground">Henüz alınmış ödeme yok.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {shown.map((entry) => (
            <li key={entry.key} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-base">
                  <span className="font-semibold tabular-nums text-foreground">{formatTRY(entry.totalKurus)}</span>
                  <span className="text-muted-foreground">{entry.paidOn ? dateFormatter.format(day(entry.paidOn)) : "Tarih yok"}</span>
                  {entry.corrected ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Düzeltildi</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm text-foreground">
                  {methodsText(entry)} · {itemsText(entry)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {entry.kind === "ice_aktarma" ? "İçe aktarılan kayıt" : `Alan: ${entry.actorName ?? "Panel"}`}
                  {entry.kind === "ice_aktarma" && entry.actorName ? ` · ${entry.actorName}` : ""}
                </p>
                {entry.note ? (
                  <p className="mt-1 rounded-lg bg-warning-soft px-2 py-1 text-sm text-foreground">{entry.note}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReverting(entry.anchorId)}
                  className={`${button} border-red-200 bg-destructive-soft text-red-700 hover:border-red-300`}
                >
                  Geri al
                </button>
                {role === "yonetici" ? (
                  <button
                    type="button"
                    onClick={() => setCorrecting(entry)}
                    className={`${button} border-border bg-surface text-foreground hover:bg-muted`}
                  >
                    Ödemeyi düzelt
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {entries.length > SHOWN ? (
        <div className="border-t border-border px-5 py-2">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="min-h-11 cursor-pointer text-sm font-semibold text-primary-strong hover:underline"
          >
            {showAll ? "Daha az göster" : `Bütün ödemeleri göster (${entries.length})`}
          </button>
        </div>
      ) : null}
      {reverting ? <PaymentRevertDialog installmentId={reverting} onClose={() => setReverting(null)} /> : null}
      {correcting ? (
        <PaymentCorrectDialog
          installmentId={correcting.anchorId}
          title={`${itemsText(correcting)} · ${studentName}`}
          onClose={() => setCorrecting(null)}
        />
      ) : null}
    </section>
  );
}
