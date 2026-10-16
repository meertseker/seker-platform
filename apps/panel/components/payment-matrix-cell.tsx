"use client";

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { revertInstallment, updateInstallment } from "@/actions/payments";
import { PaymentDialog, type OpenPaymentItem } from "@/components/payment-dialog";
import { ReminderButton } from "@/components/reminder-button";
import { Sheet } from "@/components/sheet";
import { ITEM_TYPES, PAYMENT_METHODS, label } from "@/lib/constants";
import { formatTRY, kurusToTl } from "@/lib/money";
import { shortDate } from "@/lib/payment-labels";
import type { CellState, MatrixCell, MatrixCellItem } from "@/lib/payment-matrix";
import { formatTlInput, parseTlInput } from "@/lib/tl-input";

/** Sunucudan gelen not / hatırlatma izi (Excel'deki hücre yorumunun karşılığı). */
export interface TraceDTO {
  at: string;
  actorName: string | null;
  note: string | null;
}

export interface CellPaymentContext {
  studentId: string;
  phone: string | null;
  /** Öğrencinin bütün bekleyen taksitleri — "Ödeme al" penceresi için. */
  openItems: OpenPaymentItem[];
  notes: Record<string, TraceDTO[]>;
  reminders: Record<string, TraceDTO[]>;
  /** Gecikmiş taksitler için hazır WhatsApp metni. */
  reminderMessage: string;
}

const PaymentRowContext = createContext<CellPaymentContext | null>(null);

/** Satırın ödeme bağlamı bir kez gönderilir; satırdaki bütün hücreler buradan okur. */
export function PaymentRowProvider({ value, children }: { value: CellPaymentContext; children: ReactNode }) {
  return <PaymentRowContext.Provider value={value}>{children}</PaymentRowContext.Provider>;
}

interface PaymentMatrixCellProps {
  cell: MatrixCell;
  studentName: string;
  /** "Ekim 2026" — ekran okuyucu ve pencere başlığı için tam ad. */
  monthLabel: string;
  role: "yonetici" | "danisman";
}

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

export function fillOf(cell: MatrixCell) {
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

const secondaryButton =
  "min-h-12 cursor-pointer rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function PaymentMatrixCell({ cell, studentName, monthLabel, role }: PaymentMatrixCellProps) {
  const router = useRouter();
  const payment = useContext(PaymentRowContext);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState<MatrixCellItem | null>(null);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (cell.state === "bos" || !payment) {
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

  const openIds = cell.items.filter((item) => item.status === "bekliyor").map((item) => item.installmentId);
  const overdueIds = cell.items.filter((item) => item.overdue).map((item) => item.installmentId);
  const reminders = cell.items.flatMap((item) => payment.reminders[item.installmentId] ?? []);
  const lastReminder = [...reminders].sort((a, b) => b.at.localeCompare(a.at))[0];
  const hasNote = cell.items.some((item) => (payment.notes[item.installmentId] ?? []).length > 0);

  function close() {
    setOpen(false);
    setEditing(null);
    setError(null);
    triggerRef.current?.focus();
  }

  function startEdit(item: MatrixCellItem) {
    setError(null);
    setEditing(item);
    setAmount(formatTlInput(kurusToTl(item.amountKurus)));
    setDueDate(item.dueDate);
  }

  function saveEdit() {
    if (!editing) return;
    const parsed = parseTlInput(amount);
    if (parsed === null) return setError("Geçerli bir tutar girin");
    startTransition(async () => {
      const result = await updateInstallment(editing.installmentId, { amountTl: parsed, dueDate });
      if (result.error) return setError(result.error);
      setEditing(null);
      router.refresh();
    });
  }

  function revert(item: MatrixCellItem) {
    if (!window.confirm("Bu ödemenin geri alınmasını onaylıyor musunuz?")) return;
    setError(null);
    startTransition(async () => {
      const result = await revertInstallment(item.installmentId);
      if (result.error) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <td className="relative border-l border-border p-0 align-middle">
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
      {/* Excel'deki yorum üçgeni: notu ya da hatırlatması olan hücre */}
      {hasNote || lastReminder ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 size-0 border-l-[8px] border-t-[8px] border-l-transparent border-t-zinc-900/70"
        />
      ) : null}

      <Sheet open={open} onClose={close} title={monthLabel} description={studentName}>
        {error ? (
          <p className="mb-3 rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        ) : null}

        <ul className="divide-y divide-border">
          {cell.items.map((item) => {
            const notes = payment.notes[item.installmentId] ?? [];
            return (
              <li key={item.installmentId} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{label(ITEM_TYPES, item.itemType)}</p>
                    <p className={`mt-0.5 text-sm ${item.overdue ? "font-semibold text-red-700" : "text-muted-foreground"}`}>
                      {item.status === "odendi"
                        ? `${item.paidAt ? `${formatDate(item.paidAt.slice(0, 10))} ödendi` : "Ödendi"}${
                            item.paymentMethod ? ` · ${label(PAYMENT_METHODS, item.paymentMethod)}` : ""
                          }`
                        : `${formatDate(item.dueDate)} vadeli${item.overdue ? " · alınmadı" : ""}`}
                    </p>
                    {notes.map((trace) => (
                      <p key={trace.at} className="mt-1 rounded-lg bg-warning-soft px-2 py-1 text-sm text-foreground">
                        {trace.note}
                        <span className="text-muted-foreground">
                          {" "}
                          · {trace.actorName ?? "Panel"}, {shortDate(trace.at)}
                        </span>
                      </p>
                    ))}
                  </div>
                  <p className="font-semibold tabular-nums text-foreground">
                    {formatTRY(item.paidAmountKurus ?? item.amountKurus)}
                  </p>
                </div>

                {editing?.installmentId === item.installmentId ? (
                  <div className="mt-3 space-y-3 rounded-xl bg-muted/60 p-3">
                    <label className="block text-sm font-semibold text-foreground">
                      Tutar
                      <input
                        inputMode="decimal"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-foreground">
                      Vade
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                        className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(null)} disabled={isPending} className={`flex-1 ${secondaryButton}`}>
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={isPending}
                        className="min-h-12 flex-1 cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-50"
                      >
                        {isPending ? "Kaydediliyor…" : "Kaydet"}
                      </button>
                    </div>
                  </div>
                ) : role === "yonetici" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(item)} className={secondaryButton}>
                      Düzenle
                    </button>
                    {item.status === "odendi" ? (
                      <button
                        type="button"
                        onClick={() => revert(item)}
                        disabled={isPending}
                        className="min-h-12 cursor-pointer rounded-xl border border-red-200 bg-destructive-soft px-4 text-sm font-semibold text-red-700 hover:border-red-300 disabled:opacity-50"
                      >
                        Ödemeyi geri al
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-base font-semibold">
          <span className="text-muted-foreground">Alınan / tutar</span>
          <span className="tabular-nums text-foreground">
            {formatTRY(cell.paidKurus)} / {formatTRY(cell.totalKurus)}
          </span>
        </div>

        {openIds.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPaying(true);
              }}
              className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Banknote aria-hidden className="size-5" />
              Ödeme al
            </button>
            {overdueIds.length > 0 ? (
              <ReminderButton
                studentId={payment.studentId}
                installmentIds={overdueIds}
                phone={payment.phone}
                message={payment.reminderMessage}
                big
              />
            ) : null}
          </div>
        ) : null}
        {overdueIds.length > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {lastReminder
              ? `${shortDate(lastReminder.at)} tarihinde hatırlatıldı · ${lastReminder.actorName ?? "Panel"}`
              : "Henüz hatırlatılmadı"}
          </p>
        ) : null}
      </Sheet>

      <PaymentDialog
        open={paying}
        onClose={() => setPaying(false)}
        studentId={payment.studentId}
        studentName={studentName}
        items={payment.openItems}
        preselect={openIds}
      />
    </td>
  );
}
