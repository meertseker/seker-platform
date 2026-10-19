"use client";

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { rescheduleInstallments, revertInstallment, updateInstallment } from "@/actions/payments";
import { PaymentDialog, type OpenPaymentItem } from "@/components/payment-dialog";
import { EXCEL_FILLS } from "@/lib/payment-fills";
import { ReminderButton } from "@/components/reminder-button";
import { Sheet } from "@/components/sheet";
import { ITEM_TYPES, PAYMENT_METHODS, label } from "@/lib/constants";
import { formatTRY, kurusToTl } from "@/lib/money";
import { nextMonthFifth, shortDate } from "@/lib/payment-labels";
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
  /** "tile": telefondaki kart listesinde, üstte kısa başlıklı kutu olarak çizilir. */
  variant?: "td" | "tile";
  /** tile başlığı ("EKİM", "Kitap") */
  tileLabel?: string;
}

const STATE_LABELS: Record<CellState, string> = {
  bos: "Taksit yok",
  odendi: "Ödendi",
  kismi: "Kısmi ödendi",
  gecikti: "Alınmadı",
  bekliyor: "Vadesi gelmedi",
};


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

export function PaymentMatrixCell({
  cell,
  studentName,
  monthLabel,
  role,
  variant = "td",
  tileLabel,
}: PaymentMatrixCellProps) {
  const payment = useContext(PaymentRowContext);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  if (cell.state === "bos" || !payment) {
    if (variant === "tile") return null;
    return <td className="border-l border-border px-2 py-2" aria-label="Taksit yok" />;
  }
  const Wrapper = variant === "tile" ? "div" : "td";

  const stateLabel = cell.state === "odendi" && cell.cash ? "Nakit ödendi" : STATE_LABELS[cell.state];
  // Excel'deki gibi hücrede hep o kalemin tutarı yazar; durumu boya söyler.
  const display = formatTRY(cell.totalKurus);
  const hint =
    cell.state === "kismi"
      ? `${formatTRY(cell.paidKurus)} alındı`
      : cell.state === "bekliyor"
        ? null
        : stateLabel;
  const hasTrace = cell.items.some(
    (item) =>
      (payment.notes[item.installmentId] ?? []).length > 0 ||
      (payment.reminders[item.installmentId] ?? []).length > 0,
  );

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <Wrapper
      className={
        variant === "tile"
          ? "relative overflow-hidden rounded-lg border border-border"
          : "relative border-l border-border p-0 align-middle"
      }
    >
      {variant === "tile" && tileLabel ? (
        <span className="block bg-muted px-2 py-0.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tileLabel}
        </span>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${studentName}, ${monthLabel}, ${display}${cell.tentative ? " (Kesinleşmedi)" : ""}, ${stateLabel}`}
        className={`flex min-h-12 w-full cursor-pointer flex-col items-end justify-center gap-0.5 px-2 py-1.5 text-right text-sm font-semibold tabular-nums transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${fillOf(cell)}`}
      >
        <span className="whitespace-nowrap">
          {cell.tentative ? (
            <span
              role="img"
              title="Kesinleşmedi"
              aria-label="Kesinleşmedi"
              className="mr-1 font-medium opacity-70"
            >
              ~
            </span>
          ) : null}
          {display}
        </span>
        {hint || cell.cancelledCount > 0 ? (
          <span className="whitespace-nowrap text-xs font-medium opacity-90">
            {hint}
            {cell.cancelledCount > 0 ? ` · ${cell.cancelledCount} iptal` : null}
          </span>
        ) : null}
      </button>
      {/* Excel'deki yorum üçgeni: notu ya da hatırlatması olan hücre */}
      {hasTrace ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 size-0 border-l-[8px] border-t-[8px] border-l-transparent border-t-zinc-900/70"
        />
      ) : null}

      {/* Sayfada ~2000 hücre var; pencere ve durumu yalnız açılınca kurulur. */}
      {open ? (
        <CellSheet
          cell={cell}
          studentName={studentName}
          monthLabel={monthLabel}
          role={role}
          payment={payment}
          onClose={close}
          onPay={() => {
            setOpen(false);
            setPaying(true);
          }}
        />
      ) : null}

      {paying ? (
        <PaymentDialog
          open
          onClose={() => setPaying(false)}
          studentId={payment.studentId}
          studentName={studentName}
          items={payment.openItems}
          preselect={cell.items.filter((item) => item.status === "bekliyor").map((item) => item.installmentId)}
        />
      ) : null}
    </Wrapper>
  );
}

function CellSheet({
  cell,
  studentName,
  monthLabel,
  role,
  payment,
  onClose,
  onPay,
}: {
  cell: MatrixCell;
  studentName: string;
  monthLabel: string;
  role: "yonetici" | "danisman";
  payment: CellPaymentContext;
  onClose: () => void;
  onPay: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MatrixCellItem | null>(null);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const openItems = cell.items.filter((item) => item.status === "bekliyor");
  const openIds = openItems.map((item) => item.installmentId);
  // Taksitlendirme tek kalem (plan) üzerinde yapılır; hücrede birden fazla kalem varsa ilki.
  const splitItems = openItems.filter((item) => item.planId === openItems[0]?.planId);
  const overdueIds = cell.items.filter((item) => item.overdue).map((item) => item.installmentId);
  const reminders = cell.items.flatMap((item) => payment.reminders[item.installmentId] ?? []);
  const lastReminder = [...reminders].sort((a, b) => b.at.localeCompare(a.at))[0];

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
    <Sheet open onClose={onClose} title={monthLabel} description={studentName}>
      {error ? (
        <p role="alert" className="mb-3 rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">{error}</p>
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
                  {item.tentative ? (
                    <span
                      title="Kesinleşmedi"
                      className="mr-2 rounded-full bg-muted px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground"
                    >
                      Kesinleşmedi
                    </span>
                  ) : null}
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
                      className="mt-2 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-base tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-foreground">
                    Vade
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="mt-2 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
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
            onClick={onPay}
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
      {splitItems.length > 0 ? (
        splitting ? (
          <RescheduleForm
            installmentIds={splitItems.map((item) => item.installmentId)}
            totalKurus={splitItems.reduce((sum, item) => sum + item.amountKurus, 0)}
            onCancel={() => setSplitting(false)}
            onDone={() => {
              onClose();
              router.refresh();
            }}
          />
        ) : (
          <button type="button" onClick={() => setSplitting(true)} className={`mt-2 w-full ${secondaryButton}`}>
            Taksitlendir · vadeyi değiştir
          </button>
        )
      ) : null}
      {overdueIds.length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {lastReminder
            ? `${shortDate(lastReminder.at)} tarihinde hatırlatıldı · ${lastReminder.actorName ?? "Panel"}`
            : "Henüz hatırlatılmadı"}
        </p>
      ) : null}
    </Sheet>
  );
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Bekleyen tutarı ayda bir taksite böler (1 = yalnız vadeyi değiştir). */
function RescheduleForm({
  installmentIds,
  totalKurus,
  onCancel,
  onDone,
}: {
  installmentIds: string[];
  totalKurus: number;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [count, setCount] = useState(2);
  const [firstDue, setFirstDue] = useState(() => nextMonthFifth(todayInIstanbul()));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await rescheduleInstallments(installmentIds, count, firstDue);
      if (result.error) return setError(result.error);
      onDone();
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-muted/60 p-3">
      <p className="text-sm font-semibold text-foreground">Bekleyen {formatTRY(totalKurus)} kaç taksit olsun?</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCount(option)}
            className={`min-h-12 cursor-pointer rounded-xl border text-base font-semibold ${
              count === option ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-foreground hover:bg-muted"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <label className="block text-sm font-semibold text-foreground">
        {count === 1 ? "Yeni vade" : "İlk taksit"}
        <input
          type="date"
          value={firstDue}
          onChange={(event) => setFirstDue(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </label>
      <p className="text-sm text-muted-foreground">
        {count === 1
          ? "Tutar tek seferde, yeni vadede alınır."
          : `${count} taksit, ayda bir · her biri yaklaşık ${formatTRY(Math.round(totalKurus / count))}`}
      </p>
      {error ? <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={isPending} className={`flex-1 ${secondaryButton}`}>
          Vazgeç
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="min-h-12 flex-1 cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-50"
        >
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
