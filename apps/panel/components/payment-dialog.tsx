"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check } from "lucide-react";
import { takePayment, undoPayment } from "@/actions/payments";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import type { PaymentMethod } from "@/lib/constants";
import { formatTRY, kurusToTl, tlToKurus } from "@/lib/money";
import { nextMonthFifth } from "@/lib/payment-labels";
import { formatTlInput, parseTlInput } from "@/lib/tl-input";

export interface OpenPaymentItem {
  id: string;
  /** "Ekim aidatı", "Kitap - Kırtasiye" */
  label: string;
  dueDate: string;
  amountKurus: number;
  overdue: boolean;
}

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  items: OpenPaymentItem[];
  /** Açılışta işaretli gelecek taksitler; yoksa vadesi en eski olan. */
  preselect?: string[];
}

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "nakit", label: "Nakit" },
  { key: "pos", label: "Kart" },
  { key: "havale", label: "Havale" },
];

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Istanbul",
});

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const chip = (active: boolean) =>
  `flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    active ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-foreground hover:bg-muted"
  }`;

const inputClass =
  "min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

function defaultSelection(items: OpenPaymentItem[], preselect?: string[]) {
  const valid = (preselect ?? []).filter((id) => items.some((item) => item.id === id));
  if (valid.length) return valid;
  return items.length ? [items[0].id] : [];
}

/** Excel'deki en sık ödeme biçimlerine göre: tek ya da çok ay, tek ya da iki yöntem. */
export function PaymentDialog({ open, onClose, studentId, studentName, items, preselect }: PaymentDialogProps) {
  const router = useRouter();
  const showToast = useToast();

  // Bildirim düzen katmanında yaşar: bu pencere (ve onu açan hücre) kapansa da "Geri al" kalır.
  function announce(text: string, eventId: string | null) {
    showToast({
      text,
      action: eventId
        ? {
            label: "Geri al",
            onClick: () => {
              void undoPayment(eventId).then((result) => {
                showToast({ text: result.error ?? "Ödeme geri alındı" });
                router.refresh();
              });
            },
          }
        : undefined,
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Ödeme al · ${studentName}`}>
      {open ? (
        <PaymentForm
          studentId={studentId}
          studentName={studentName}
          items={items}
          preselect={preselect}
          onDone={(text, eventId) => {
            announce(text, eventId);
            onClose();
            router.refresh();
          }}
        />
      ) : null}
    </Sheet>
  );
}

interface PaymentFormProps {
  studentId: string;
  studentName: string;
  items: OpenPaymentItem[];
  preselect?: string[];
  onDone: (toastText: string, eventId: string | null) => void;
}

/** Pencere her açılışta yeniden kurulur; bu yüzden başlangıç değerleri doğrudan state'e girer. */
function PaymentForm({ studentId, studentName, items, preselect, onDone }: PaymentFormProps) {
  const sumOf = (ids: string[]) =>
    items.filter((item) => ids.includes(item.id)).reduce((sum, item) => sum + item.amountKurus, 0);
  const [selected, setSelected] = useState<string[]>(() => defaultSelection(items, preselect));
  const [twoMethods, setTwoMethods] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(() => formatTlInput(kurusToTl(sumOf(defaultSelection(items, preselect)))));
  const [firstMethod, setFirstMethod] = useState<PaymentMethod>("pos");
  const [firstAmount, setFirstAmount] = useState("");
  const [secondMethod, setSecondMethod] = useState<PaymentMethod>("nakit");
  const [paidOn, setPaidOn] = useState(todayInIstanbul);
  /** İki yöntemde ikinci parçanın günü; null = ilk parçayla aynı gün. */
  const [secondPaidOn, setSecondPaidOn] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);
  /** Eksik ödemede kalan: 0 = aynı vadede tek taksit, n = n taksit. */
  const [remainderCount, setRemainderCount] = useState(0);
  const [remainderFirst, setRemainderFirst] = useState(() => nextMonthFifth(todayInIstanbul()));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dueKurus = useMemo(() => sumOf(selected), [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
    setSelected(next);
    setAmount(formatTlInput(kurusToTl(sumOf(next))));
  }

  const firstKurus = tlToKurus(parseTlInput(firstAmount) ?? 0);
  const secondKurus = Math.max(dueKurus - firstKurus, 0);
  const singleKurus = tlToKurus(parseTlInput(amount) ?? 0);
  const totalKurus = twoMethods ? firstKurus + secondKurus : singleKurus;

  function submit() {
    setError(null);
    if (selected.length === 0) return setError("Ödenecek ayı seçin");
    let payments: { method: PaymentMethod; amountTl: number; paidOn?: string }[];
    if (twoMethods) {
      if (firstKurus <= 0) return setError("İlk yöntemin tutarını girin");
      if (firstKurus >= dueKurus) return setError("İlk tutar toplamdan küçük olmalı; tek yöntem seçin");
      if (firstMethod === secondMethod) return setError("İki farklı yöntem seçin");
      const secondDay = secondPaidOn ?? paidOn;
      if (!paidOn || !secondDay) return setError("Her parçanın tarihini girin");
      const today = todayInIstanbul();
      if (paidOn > today || secondDay > today) return setError("Ödeme tarihi bugünden ileri olamaz");
      payments = [
        { method: firstMethod, amountTl: kurusToTl(firstKurus), paidOn },
        { method: secondMethod, amountTl: kurusToTl(secondKurus), paidOn: secondDay },
      ];
    } else {
      if (!method) return setError("Nasıl ödendiğini seçin");
      if (singleKurus <= 0) return setError("Geçerli bir tutar girin");
      if (singleKurus > dueKurus) return setError("Tutar seçilen ayların toplamını aşamaz");
      payments = [{ method, amountTl: kurusToTl(singleKurus) }];
    }

    startTransition(async () => {
      const partial = !twoMethods && singleKurus < dueKurus;
      const result = await takePayment({
        studentId,
        installmentIds: selected,
        payments,
        paidOn,
        note,
        remainder: partial && remainderCount > 0 ? { count: remainderCount, firstDueDate: remainderFirst } : undefined,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      const paidTl = "totalTl" in result && result.totalTl ? result.totalTl : kurusToTl(totalKurus);
      onDone(
        `${studentName} · ${formatTRY(tlToKurus(paidTl))} ödeme kaydedildi`,
        "eventId" in result ? (result.eventId ?? null) : null,
      );
    });
  }

  if (items.length === 0) return <p className="text-base text-muted-foreground">Bekleyen ödeme yok.</p>;

  // Gecikenler, seçilenler ve sıradaki ay görünür; ileriki aylar istenince açılır.
  const firstUpcomingRaw = items.findIndex((item) => !item.overdue);
  const firstUpcoming = firstUpcomingRaw === -1 ? items.length : firstUpcomingRaw;
  const hiddenCount = items.filter(
    (item, index) => !(item.overdue || selected.includes(item.id) || index < firstUpcoming + 1),
  ).length;

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-foreground">Hangi ödeme?</legend>
        {items.filter((item, index) => showAll || item.overdue || selected.includes(item.id) || index < firstUpcoming + 1).map((item) => {
          const checked = selected.includes(item.id);
          return (
            <label
              key={item.id}
              className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                checked ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-muted"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.id)}
                  className="size-5 accent-[var(--color-primary)]"
                />
                <span>
                  <span className="block font-semibold text-foreground">{item.label}</span>
                  <span className={`block text-sm ${item.overdue ? "font-semibold text-red-700" : "text-muted-foreground"}`}>
                    {dateFormatter.format(new Date(`${item.dueDate}T12:00:00+03:00`))} vadeli
                    {item.overdue ? " · alınmadı" : ""}
                  </span>
                </span>
              </span>
              <span className="font-semibold tabular-nums text-foreground">{formatTRY(item.amountKurus)}</span>
            </label>
          );
        })}
        {!showAll && hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="min-h-12 w-full cursor-pointer rounded-xl border border-dashed border-border px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Sonraki aylar ({hiddenCount})
          </button>
        ) : null}
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Nasıl ödedi?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METHODS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setTwoMethods(false);
                setMethod(option.key);
              }}
              className={chip(!twoMethods && method === option.key)}
            >
              {option.label}
            </button>
          ))}
          <button type="button" onClick={() => setTwoMethods(true)} className={chip(twoMethods)}>
            İki yöntemle
          </button>
        </div>
      </div>

      {twoMethods ? (
        <div className="space-y-3 rounded-xl bg-muted/60 p-3">
          <p className="text-sm text-muted-foreground">Farklı günlerde ödendiyse parçaların tarihini ayrı girin.</p>
          {[
            {
              n: 1,
              method: firstMethod,
              setMethod: setFirstMethod,
              day: paidOn,
              setDay: setPaidOn,
              amount: (
                <input
                  aria-label="İlk yöntemle ödenen"
                  inputMode="decimal"
                  placeholder="Örn. 15.000"
                  value={firstAmount}
                  onChange={(event) => setFirstAmount(event.target.value)}
                  className={inputClass}
                />
              ),
            },
            {
              n: 2,
              method: secondMethod,
              setMethod: setSecondMethod,
              day: secondPaidOn ?? paidOn,
              setDay: (value: string) => setSecondPaidOn(value),
              amount: <div className={`${inputClass} flex items-center text-muted-foreground`}>Kalan {formatTRY(secondKurus)}</div>,
            },
          ].map((part) => (
            <div key={part.n} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <select
                aria-label={part.n === 1 ? "İlk yöntem" : "İkinci yöntem"}
                value={part.method}
                onChange={(event) => part.setMethod(event.target.value as PaymentMethod)}
                className={inputClass}
              >
                {METHODS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              {part.amount}
              <label className="col-span-2 flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
                {part.n}. parçanın tarihi
                <input
                  type="date"
                  value={part.day}
                  max={todayInIstanbul()}
                  onChange={(event) => part.setDay(event.target.value)}
                  className={`${inputClass} max-w-48`}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <label className="block text-sm font-semibold text-foreground">
          Tutar
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={`mt-2 ${inputClass}`}
          />
        </label>
      )}

      {!twoMethods && singleKurus > 0 && singleKurus < dueKurus ? (
        <div className="space-y-3 rounded-xl bg-muted/60 p-3">
          <p className="text-sm font-semibold text-foreground">
            Kalan {formatTRY(dueKurus - singleKurus)} nasıl ödenecek?
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 2, 3, 4].map((count) => (
              <button key={count} type="button" onClick={() => setRemainderCount(count)} className={chip(remainderCount === count)}>
                {count === 0 ? "Tek seferde" : `${count} taksit`}
              </button>
            ))}
          </div>
          {remainderCount > 0 ? (
            <label className="block text-sm font-semibold text-foreground">
              İlk taksit
              <input
                type="date"
                value={remainderFirst}
                onChange={(event) => setRemainderFirst(event.target.value)}
                className={`mt-2 ${inputClass}`}
              />
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {remainderCount} taksit, ayda bir · her biri yaklaşık {formatTRY(Math.round((dueKurus - singleKurus) / remainderCount))}
              </span>
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">Kalan, aynı vadeyle tek taksit olarak bekler.</p>
          )}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* İki yöntemde her parçanın kendi tarihi yukarıda. */}
        {twoMethods ? null : (
          <label className="block text-sm font-semibold text-foreground">
            Ödeme tarihi
            <input
              type="date"
              value={paidOn}
              max={todayInIstanbul()}
              onChange={(event) => setPaidOn(event.target.value)}
              className={`mt-2 ${inputClass}`}
            />
          </label>
        )}
        <label className="block text-sm font-semibold text-foreground">
          Not (isteğe bağlı)
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Örn. anne nakit getirdi"
            className={`mt-2 ${inputClass}`}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">{error}</p>
      ) : null}

      <div className="flex items-center justify-between border-t border-border pt-4 text-lg font-semibold">
        <span className="text-muted-foreground">Toplam</span>
        <span className="tabular-nums text-foreground">{formatTRY(totalKurus)}</span>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Check aria-hidden className="size-5" />
        {isPending ? "Kaydediliyor…" : "Ödemeyi kaydet"}
      </button>
    </div>
  );
}

interface PaymentButtonProps extends Omit<PaymentDialogProps, "open" | "onClose"> {
  big?: boolean;
  label?: string;
}

/** Sayfadaki tek "Ödeme al" düğmesi. */
export function PaymentButton({ big = false, label = "Ödeme al", ...props }: PaymentButtonProps) {
  const [open, setOpen] = useState(false);
  if (props.items.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          big ? "min-h-14 text-base" : "min-h-12 text-sm"
        }`}
      >
        <Banknote aria-hidden className="size-5" />
        {label}
      </button>
      <PaymentDialog open={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}
