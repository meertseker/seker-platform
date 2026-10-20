"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveRecommendation, holdRecommendation } from "@/actions/recommendations";
import type { RecommendationRow } from "@/lib/ads/recommendations";

const MIN_REASON = 10;

type RowState = { result?: string; error?: string; reasonOpen?: boolean; reason?: string };

const PLATFORM: Record<"google" | "meta", { label: string; className: string }> = {
  google: { label: "Google", className: "bg-google-soft text-google" },
  meta: { label: "Instagram", className: "bg-instagram-soft text-instagram" },
};

const btn = "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed";

/**
 * 2 · Panelin önerdiği kararlar. Onayla / Şimdilik bekle; sonuç yazısı eylemden gelir.
 * Kapı kırmızıyken bütçe artışı tek onayla yapılabilir ama gerekçe (en az 10 karakter) zorunludur.
 */
export function WeeklyRecommendations({ recs, redGates }: { recs: RecommendationRow[]; redGates: string[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, RowState>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const patch = (id: string, p: RowState) => setState((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  function run(id: string, call: () => ReturnType<typeof holdRecommendation>) {
    setBusyId(id);
    patch(id, { error: undefined });
    startTransition(async () => {
      try {
        const res = await call();
        if ("error" in res) {
          patch(id, { error: res.error, ...(res.needsReason ? { reasonOpen: true } : {}) });
          return;
        }
        patch(id, { result: res.result, reasonOpen: false });
        router.refresh();
      } catch {
        patch(id, { error: "İşlem yapılamadı, tekrar deneyin." });
      } finally {
        setBusyId(null);
      }
    });
  }

  const gateNames = redGates.length > 0 ? redGates.join(", ") : "bir kapı";

  return (
    <section id="kararlar" aria-labelledby="kararlar-baslik" className="flex scroll-mt-4 flex-col gap-2.5">
      <h2 id="kararlar-baslik" className="text-xl font-bold text-foreground">
        2 · Panelin önerdiği kararlar
      </h2>
      <p className="text-sm text-muted-foreground">
        Panel kuralları uygular ve öneri yazar. Siz onaylamadan hiçbir şey değişmez.
      </p>
      {recs.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Bu hafta panelin önerdiği karar yok.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recs.map((r) => {
            const s = state[r.id] ?? {};
            const decided = s.result ?? (r.status !== "acik" ? r.result ?? "Karar verildi" : null);
            const blocked = !!r.blockedReason;
            const busy = busyId === r.id;
            const reason = s.reason ?? "";
            const plat = r.platform ? PLATFORM[r.platform] : null;
            return (
              <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${plat ? plat.className : "bg-muted text-muted-foreground"}`}
                  >
                    {plat ? plat.label : "İçerik"}
                  </span>
                  <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
                    <span className="text-base font-bold text-foreground">{r.title}</span>
                    <span className="text-[13.5px] text-muted-foreground">{r.why}</span>
                  </div>
                  {decided ? (
                    <span
                      role="status"
                      className={`text-sm font-semibold ${decided.startsWith("✓") ? "text-accent" : "text-muted-foreground"}`}
                    >
                      {decided}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        aria-expanded={blocked ? !!s.reasonOpen : undefined}
                        onClick={() =>
                          blocked ? patch(r.id, { reasonOpen: !s.reasonOpen }) : run(r.id, () => approveRecommendation(r.id))
                        }
                        className={`${btn} ${
                          blocked
                            ? "border border-border bg-muted text-muted-foreground hover:bg-border/60"
                            : "bg-primary text-on-primary hover:bg-primary-strong disabled:opacity-60"
                        }`}
                      >
                        {blocked ? r.blockedReason : busy ? "Uygulanıyor…" : "Onayla"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(r.id, () => holdRecommendation(r.id))}
                        className={`${btn} border border-border bg-surface text-foreground hover:bg-muted disabled:opacity-60`}
                      >
                        Şimdilik bekle
                      </button>
                    </div>
                  )}
                </div>
                {!decided && s.reasonOpen ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive-soft p-3">
                    <p className="text-sm text-destructive-strong">
                      Bu hafta bir kapı kırmızı ({gateNames}). Bütçe artışı önerilmiyor. Yine de yapacaksanız nedenini yazın.
                    </p>
                    <label htmlFor={`gerekce-${r.id}`} className="text-sm font-medium text-foreground">
                      Gerekçe (en az {MIN_REASON} karakter)
                    </label>
                    <textarea
                      id={`gerekce-${r.id}`}
                      value={reason}
                      onChange={(e) => patch(r.id, { reason: e.target.value })}
                      rows={2}
                      maxLength={500}
                      className="block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || reason.trim().length < MIN_REASON}
                        onClick={() => run(r.id, () => approveRecommendation(r.id, reason.trim()))}
                        className={`${btn} bg-destructive text-on-primary hover:bg-destructive-strong disabled:opacity-60`}
                      >
                        {busy ? "Uygulanıyor…" : "Gerekçeyle onayla"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => patch(r.id, { reasonOpen: false })}
                        className={`${btn} border border-border bg-surface text-foreground hover:bg-muted`}
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : null}
                {s.error ? (
                  <p role="alert" className="text-sm font-medium text-destructive-strong">
                    {s.error}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
