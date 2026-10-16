"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { createEnrollmentPlan } from "@/actions/payments";
import { Sheet } from "@/components/sheet";
import { buildEnrollmentPlans, type AidatMode } from "@/lib/enrollment-plan";
import { formatTRY, tlToKurus } from "@/lib/money";
import { formatTlInput, parseTlInput } from "@/lib/tl-input";

interface EnrollmentPlanProps {
  studentId: string;
  studentName: string;
  /** Sezonun son ayı "YYYY-MM". */
  lastMonth: string;
  initialFirstDue: string;
  initialMonthlyTl?: number;
  sourceOfferId?: string;
  initialOpen?: boolean;
}

const monthFormatter = new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: "Europe/Istanbul" });

const chip = (active: boolean) =>
  `flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-4 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    active ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-foreground hover:bg-muted"
  }`;

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

/** Kayıt planı tek ekranda: aidat nasıl ödenecek, kaç lira, kitap kaç taksit. */
export function EnrollmentPlanButton(props: EnrollmentPlanProps) {
  const [open, setOpen] = useState(Boolean(props.initialOpen));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <CalendarPlus aria-hidden className="size-5" />
        Ödeme planı kur
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Ödeme planı · ${props.studentName}`}>
        {open ? <EnrollmentPlanForm {...props} onDone={() => setOpen(false)} /> : null}
      </Sheet>
    </>
  );
}

function EnrollmentPlanForm({
  studentId,
  lastMonth,
  initialFirstDue,
  initialMonthlyTl,
  sourceOfferId,
  onDone,
}: EnrollmentPlanProps & { onDone: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<AidatMode>("aylik");
  const [monthly, setMonthly] = useState(initialMonthlyTl ? formatTlInput(initialMonthlyTl) : "");
  const [firstDifferent, setFirstDifferent] = useState(false);
  const [firstMonth, setFirstMonth] = useState("");
  const [annual, setAnnual] = useState("");
  const [firstDue, setFirstDue] = useState(initialFirstDue);
  const [kitap, setKitap] = useState("");
  const [kitapCount, setKitapCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toKurus = (value: string) => {
    const parsed = parseTlInput(value);
    return parsed === null ? undefined : tlToKurus(parsed);
  };

  const preview = useMemo(
    () =>
      buildEnrollmentPlans({
        aidatMode: mode,
        monthlyKurus: toKurus(monthly),
        firstMonthKurus: firstDifferent ? (toKurus(firstMonth) ?? null) : null,
        annualKurus: toKurus(annual),
        firstDueDate: firstDue,
        lastMonth,
        kitapKurus: toKurus(kitap) ?? null,
        kitapCount,
      }),
    [mode, monthly, firstDifferent, firstMonth, annual, firstDue, lastMonth, kitap, kitapCount],
  );

  function submit() {
    setError(null);
    if (!preview.ok) return setError(preview.error);
    startTransition(async () => {
      const result = await createEnrollmentPlan({
        studentId,
        aidatMode: mode,
        monthlyTl: parseTlInput(monthly) ?? undefined,
        firstMonthTl: firstDifferent ? parseTlInput(firstMonth) : null,
        annualTl: parseTlInput(annual) ?? undefined,
        firstDueDate: firstDue,
        kitapTl: parseTlInput(kitap),
        kitapCount,
        sourceOfferId,
      });
      if (result.error) return setError(result.error);
      onDone();
      router.replace(`/ogrenciler/${studentId}`);
      router.refresh();
    });
  }

  const aidat = preview.ok ? preview.plans.find((plan) => plan.itemType === "aidat") : null;
  const kitapPlan = preview.ok ? preview.plans.find((plan) => plan.itemType === "kitap") : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Aidat nasıl ödenecek?</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode("aylik")} className={chip(mode === "aylik")}>
            Her ay
          </button>
          <button type="button" onClick={() => setMode("pesin")} className={chip(mode === "pesin")}>
            Yıllık peşin
          </button>
        </div>
      </div>

      {mode === "aylik" ? (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-foreground">
            Aylık aidat
            <input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Örn. 25.000" className={inputClass} />
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base text-foreground">
            <input type="checkbox" checked={firstDifferent} onChange={(e) => setFirstDifferent(e.target.checked)} className="size-5" />
            İlk ay farklı (ör. ayın ortasında başlıyor)
          </label>
          {firstDifferent ? (
            <label className="block text-sm font-semibold text-foreground">
              İlk ayın tutarı
              <input inputMode="decimal" value={firstMonth} onChange={(e) => setFirstMonth(e.target.value)} placeholder="Örn. 12.500" className={inputClass} />
            </label>
          ) : null}
        </div>
      ) : (
        <label className="block text-sm font-semibold text-foreground">
          Yıllık tutar
          <input inputMode="decimal" value={annual} onChange={(e) => setAnnual(e.target.value)} placeholder="Örn. 250.000" className={inputClass} />
        </label>
      )}

      <label className="block text-sm font-semibold text-foreground">
        İlk ödeme günü (sonraki aylar aynı gün; varsayılan ay sonu)
        <input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} className={inputClass} />
      </label>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="block text-sm font-semibold text-foreground">
          Kitap - kırtasiye (yoksa boş)
          <input inputMode="decimal" value={kitap} onChange={(e) => setKitap(e.target.value)} placeholder="Örn. 50.000" className={inputClass} />
        </label>
        <div>
          <p className="text-sm font-semibold text-foreground">Kaç taksit?</p>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4].map((count) => (
              <button key={count} type="button" onClick={() => setKitapCount(count)} className={`${chip(kitapCount === count)} w-12 px-0`}>
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Aidat listesinde böyle görünecek</p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="text-sm tabular-nums">
            <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-right">Kitap</th>
                {mode === "pesin" ? <th className="border-l border-border px-2 py-2 text-right">Aidat</th> : null}
                {mode === "aylik"
                  ? aidat?.installments.map((item) => (
                      <th key={item.dueDate} className="border-l border-border px-2 py-2 text-right">
                        {monthFormatter.format(new Date(`${item.dueDate}T12:00:00+03:00`))}
                      </th>
                    ))
                  : null}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                  {kitapPlan ? formatTRY(kitapPlan.totalKurus) : "—"}
                </td>
                {mode === "pesin" ? (
                  <td className="whitespace-nowrap border-l border-border px-2 py-2 text-right font-semibold">
                    {aidat ? formatTRY(aidat.totalKurus) : "—"}
                  </td>
                ) : null}
                {mode === "aylik"
                  ? aidat?.installments.map((item) => (
                      <td key={item.dueDate} className="whitespace-nowrap border-l border-border px-2 py-2 text-right font-semibold">
                        {formatTRY(item.amountKurus)}
                      </td>
                    ))
                  : null}
              </tr>
            </tbody>
          </table>
        </div>
        {aidat ? (
          <p className="text-sm text-muted-foreground">
            Aidat toplamı {formatTRY(aidat.totalKurus)}
            {mode === "aylik" ? ` · ${aidat.installmentCount} ay` : ""}
            {kitapPlan ? ` · kitap ${kitapPlan.installmentCount} taksit` : ""}
          </p>
        ) : null}
      </div>

      {error ? <p className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="flex min-h-14 w-full cursor-pointer items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {isPending ? "Kaydediliyor…" : "Planı kaydet"}
      </button>
    </div>
  );
}
