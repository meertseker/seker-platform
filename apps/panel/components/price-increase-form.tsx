"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyPriceIncrease, finalizeAmounts, previewPriceIncrease } from "@/actions/price-increase";
import { formatTRY } from "@/lib/money";
import type { PlanIncrease } from "@/lib/price-increase";

interface Props {
  season: string;
  months: { value: string; label: string }[];
  defaultMonth: string;
}

const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/15";
const primaryBtn =
  "min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn =
  "min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const monthFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "Europe/Istanbul" });
function monthName(key: string) {
  return monthFormatter.format(new Date(`${key}-01T12:00:00+03:00`));
}

function parsePercent(raw: string) {
  const value = Number(raw.trim().replace(",", "."));
  return raw.trim() === "" ? NaN : value;
}

export function PriceIncreaseForm({ season, months, defaultMonth }: Props) {
  const router = useRouter();
  const [percentText, setPercentText] = useState("");
  const [fromMonth, setFromMonth] = useState(
    months.some((m) => m.value === defaultMonth) ? defaultMonth : (months[0]?.value ?? ""),
  );
  const [plans, setPlans] = useState<PlanIncrease[] | null>(null);
  const [previewKey, setPreviewKey] = useState<{ percent: number; fromMonth: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const chosen = (plans ?? []).filter((p) => selected.has(p.planId));
  const installmentCount = chosen.reduce((sum, p) => sum + p.changes.length, 0);
  const totalDiff = chosen.reduce((sum, p) => sum + diffOf(p), 0);

  function diffOf(p: PlanIncrease) {
    return p.changes.reduce((s, c) => s + (c.toKurus - c.fromKurus), 0);
  }

  function preview() {
    const percent = parsePercent(percentText);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      setError("Zam oranı 0 ile 100 arasında olmalı");
      return;
    }
    setError(null);
    setMessage(null);
    setFailed([]);
    startTransition(async () => {
      const result = await previewPriceIncrease({ season, percent, fromMonth });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPlans(result.plans);
      setPreviewKey({ percent, fromMonth });
      setSelected(new Set(result.plans.map((p) => p.planId)));
    });
  }

  function apply() {
    if (!previewKey || chosen.length === 0) return;
    if (!window.confirm(`${chosen.length} öğrencinin ${installmentCount} taksiti değişecek. Bu işlem geri alınamaz.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await applyPriceIncrease({
        season,
        percent: previewKey.percent,
        fromMonth: previewKey.fromMonth,
        planIds: chosen.map((p) => p.planId),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setMessage(`${result.applied} öğrenciye zam uygulandı.`);
      setFailed(result.failed);
      setPlans(null);
      router.refresh();
    });
  }

  function finalize() {
    if (chosen.length === 0) return;
    if (!window.confirm(`${chosen.length} öğrencinin tutarı zam yapılmadan kesinleşecek. Bu işlem geri alınamaz.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await finalizeAmounts(chosen.map((p) => p.planId));
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setMessage(`${result.finalized} öğrencinin tutarı kesinleştirildi.`);
      setFailed([]);
      setPlans(null);
      router.refresh();
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <label className="block text-sm font-medium text-foreground">
            Zam oranı (%)
            <input
              inputMode="decimal"
              value={percentText}
              onChange={(e) => setPercentText(e.target.value)}
              placeholder="25"
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Hangi aydan itibaren
            <select value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className={inputClass}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={preview} disabled={isPending} className={primaryBtn}>
            Önizle
          </button>
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-medium text-emerald-700">
          {message}
        </p>
      ) : null}
      {failed.length > 0 ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
          Zam uygulanamayan öğrenciler: {failed.join(", ")}
        </p>
      ) : null}

      {plans !== null ? (
        <section className="space-y-3">
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Zam önizlemesi</caption>
              <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="w-12 px-3 py-3 text-left">
                    <span className="sr-only">Seç</span>
                  </th>
                  <th scope="col" className="px-3 py-3 text-left">
                    Öğrenci
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3 text-right">
                    Şu anki aylık
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3 text-right">
                    Yeni aylık
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3 text-right">
                    Değişen ay
                  </th>
                  <th scope="col" className="whitespace-nowrap px-3 py-3 text-right">
                    Toplam fark
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((p) => (
                  <tr key={p.planId}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(p.planId)}
                        onChange={() => toggle(p.planId)}
                        aria-label={`${p.fullName} seç`}
                        className="size-5 cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="min-w-48 px-3 py-2">
                      <span className="font-semibold text-foreground">{p.fullName}</span>
                      {p.skippedPaidMonths.length > 0 ? (
                        <span className="mt-1 block text-xs text-amber-800">
                          {p.skippedPaidMonths.map(monthName).join(", ")} ödendiği için değişmeyecek
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {p.monthlyFromKurus === null ? "—" : formatTRY(p.monthlyFromKurus)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                      {p.monthlyToKurus === null ? "—" : formatTRY(p.monthlyToKurus)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{p.changes.length}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatTRY(diffOf(p))}</td>
                  </tr>
                ))}
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Zam uygulanacak kesinleşmemiş plan yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {chosen.length} öğrenci seçili · toplam fark{" "}
              <span className="font-semibold tabular-nums text-foreground">{formatTRY(totalDiff)}</span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={finalize} disabled={isPending || chosen.length === 0} className={secondaryBtn}>
                Zam yok, tutarları kesinleştir
              </button>
              <button type="button" onClick={apply} disabled={isPending || chosen.length === 0} className={primaryBtn}>
                Uygula
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
