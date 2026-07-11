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
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold text-zinc-950">Sezonlar</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Aktif sezon fiyat listesi teklif ve öğrenci kayıtlarında esas alınır.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 divide-y divide-zinc-200 rounded-2xl border border-zinc-200">
        {seasons.length === 0 ? (
          <li className="px-4 py-4 text-sm text-zinc-500">Henüz sezon eklenmedi.</li>
        ) : (
          seasons.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className="text-sm font-semibold text-zinc-900">{item.season}</span>
              {item.isActive ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Aktif
                </span>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => submitActivate(item.id)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
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
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:bg-zinc-100"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={submitCreate}
          className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {pendingId === "new" && isPending ? "Kaydediliyor..." : "Yeni Sezon"}
        </button>
      </div>
    </section>
  );
}
