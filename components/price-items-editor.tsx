"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertPriceItem } from "@/actions/price-lists";
import { label, PROGRAMS, type Program } from "@/lib/constants";
import { formatTlInput, parseTlInput } from "@/lib/tl-input";

export interface PriceItemRow {
  program: Program;
  monthlyFeeTl: number;
  registrationFeeTl: number;
}

interface PriceItemsEditorProps {
  priceListId: string;
  items: PriceItemRow[];
}

export function PriceItemsEditor({ priceListId, items }: PriceItemsEditorProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<Program, { monthly: string; registration: string }>>(
    () =>
      Object.fromEntries(
        items.map((item) => [
          item.program,
          {
            monthly: formatTlInput(item.monthlyFeeTl),
            registration: formatTlInput(item.registrationFeeTl),
          },
        ]),
      ) as Record<Program, { monthly: string; registration: string }>,
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingProgram, setPendingProgram] = useState<Program | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateDraft(program: Program, field: "monthly" | "registration", value: string) {
    setDrafts((current) => ({
      ...current,
      [program]: {
        ...(current[program] ?? { monthly: "", registration: "" }),
        [field]: value,
      },
    }));
  }

  function submit(program: Program) {
    const draft = drafts[program];
    const monthlyFeeTl = parseTlInput(draft?.monthly ?? "");
    const registrationFeeTl = parseTlInput(draft?.registration ?? "");

    if (monthlyFeeTl === null || monthlyFeeTl <= 0) {
      setError("Geçerli bir aylık aidat girin");
      return;
    }
    if (registrationFeeTl === null) {
      setError("Geçerli bir kayıt ücreti girin");
      return;
    }

    setError(null);
    setPendingProgram(program);
    startTransition(async () => {
      const result = await upsertPriceItem(priceListId, program, monthlyFeeTl, registrationFeeTl);
      setPendingProgram(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold text-zinc-950">Aktif Sezon Fiyatları</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Program bazlı aylık aidat ve kayıt ücretini güncelleyin.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {(Object.keys(PROGRAMS) as Program[]).map((program) => {
          const draft = drafts[program] ?? { monthly: "", registration: "" };
          const isSaving = pendingProgram === program && isPending;

          return (
            <div
              key={program}
              className="grid gap-3 rounded-2xl border border-zinc-200 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
            >
              <div className="text-sm font-semibold text-zinc-900">
                {label(PROGRAMS, program)}
              </div>

              <label className="block text-sm font-medium text-zinc-700">
                Aylık aidat (TL)
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.monthly}
                  disabled={isPending}
                  onChange={(event) => updateDraft(program, "monthly", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100"
                />
              </label>

              <label className="block text-sm font-medium text-zinc-700">
                Kayıt ücreti (TL)
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.registration}
                  disabled={isPending}
                  onChange={(event) => updateDraft(program, "registration", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100"
                />
              </label>

              <button
                type="button"
                disabled={isPending}
                onClick={() => submit(program)}
                className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {isSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
