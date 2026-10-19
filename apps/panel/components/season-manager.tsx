"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSeason, setActiveSeason } from "@/actions/price-lists";

export interface SeasonItem {
  id: string;
  season: string;
  isActive: boolean;
}

interface SeasonManagerProps {
  seasons: SeasonItem[];
}

export function SeasonManager({ seasons }: SeasonManagerProps) {
  const router = useRouter();
  const [newSeason, setNewSeason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitCreate() {
    setError(null);
    setPendingId("new");
    startTransition(async () => {
      const result = await createSeason(newSeason);
      setPendingId(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      setNewSeason("");
      router.refresh();
    });
  }

  function submitActivate(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await setActiveSeason(id);
      setPendingId(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold text-foreground">Sezonlar</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Aktif sezon fiyat listesi teklif ve öğrenci kayıtlarında esas alınır.
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
        {seasons.length === 0 ? (
          <li className="px-4 py-4 text-sm text-muted-foreground">Henüz sezon eklenmedi.</li>
        ) : (
          seasons.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className="text-sm font-semibold text-foreground tabular-nums">{item.season}</span>
              {item.isActive ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Aktif
                </span>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => submitActivate(item.id)}
                  className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingId === item.id && isPending ? "İşleniyor..." : "Aktif Yap"}
                </button>
              )}
            </li>
          ))
        )}
      </ul>

      <div className="mt-5 flex flex-wrap gap-2">
        <input
          type="text"
          value={newSeason}
          disabled={isPending}
          onChange={(event) => setNewSeason(event.target.value)}
          placeholder="2027-2028"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={submitCreate}
          className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingId === "new" && isPending ? "Kaydediliyor..." : "Yeni Sezon"}
        </button>
      </div>
    </section>
  );
}
