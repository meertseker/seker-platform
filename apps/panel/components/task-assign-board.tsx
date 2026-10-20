"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";
import { assignContentTasks, type AssignTaskInput } from "@/actions/task-assign";
import type { SlotState, WeekState } from "@/lib/ai/gorev-uret";
import type { Suggestion } from "@/lib/ai/gorev-oneri";
import type { WeeklySlot } from "@/lib/content/slots";

export type AssignSlot = {
  slot: WeeklySlot;
  label: string;
  existing: { code: string; owner: string; topic: string } | null;
};

interface Props {
  weekStart: string;
  teachers: { id: string; name: string }[];
  slots: AssignSlot[];
  initialSuggestions: Record<WeeklySlot, SlotState>;
  aiEnabled: boolean;
  defaultDue: string;
}

type Draft = { choice: number | "kendi" | null; topic: string; brief: string; ownerId: string; due: string };
type Sent = { code: string; owner: string; waLink: string | null };

const OWN = "kendi" as const;
const POLL_MS = 5000;
const MAX_POLLS = 24;

const fieldClass =
  "block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted placeholder:text-placeholder";
const primaryBtn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-on-primary hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60";
const secondaryBtn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60";

function briefOf(s: Suggestion): string {
  return `${s.aciklama} (Dayanak: ${s.dayanak})`.slice(0, 1000);
}

function needsFetch(state: SlotState | undefined): boolean {
  return !state || state.status !== "hazir";
}

/** Görev ver: her yuva için öneri seç ya da kendi konunu yaz, öğretmeni seç, gönder. */
export function TaskAssignBoard({ weekStart, teachers, slots, initialSuggestions, aiEnabled, defaultDue }: Props) {
  const router = useRouter();
  const open = slots.filter((s) => !s.existing);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  // Açılışta eksik öneriler istenecek yuvalar "hazırlanıyor" görünür.
  const [loading, setLoading] = useState<Set<WeeklySlot>>(
    () => new Set(aiEnabled ? open.filter((s) => needsFetch(initialSuggestions[s.slot])).map((s) => s.slot) : []),
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(open.map((s) => [s.slot, { choice: null, topic: "", brief: "", ownerId: "", due: defaultDue }])),
  );
  const [sent, setSent] = useState<Record<string, Sent>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const alive = useRef(true);

  const fetchSuggestions = useCallback(
    async (slot?: WeeklySlot, force = false): Promise<WeekState | null> => {
      try {
        const res = await fetch("/api/ai/gorev-onerileri", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart, slot, force }),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as WeekState | { enabled: false };
        return "slots" in body ? body : null;
      } catch {
        return null;
      }
    },
    [weekStart],
  );

  // Sayfa açılınca eksik öneriler istenir; arayüz beklemez, elle girme her an çalışır.
  useEffect(() => {
    alive.current = true;
    if (!aiEnabled) return;
    const want = open.filter((s) => needsFetch(initialSuggestions[s.slot])).map((s) => s.slot);
    if (want.length === 0) return;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      const state = await fetchSuggestions();
      if (!alive.current) return;
      if (state) setSuggestions(state.slots);
      const still = state ? want.filter((s) => state.slots[s].status === "hazirlaniyor") : [];
      setLoading(new Set(still));
      // Başka bir sekme üretiyorsa kısa aralıklarla yeniden bakılır.
      if (still.length > 0 && ++polls < MAX_POLLS) timer = setTimeout(run, POLL_MS);
    };
    void run();
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
    };
    // Yalnız ilk açılışta; yeniden öner kendi isteğini atar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function regenerate(slot: WeeklySlot) {
    setLoading((l) => new Set(l).add(slot));
    const state = await fetchSuggestions(slot, true);
    if (!alive.current) return;
    if (state) setSuggestions((cur) => ({ ...cur, [slot]: state.slots[slot] }));
    else setSuggestions((cur) => ({ ...cur, [slot]: { status: "hata", suggestions: [] } }));
    setLoading((l) => {
      const n = new Set(l);
      n.delete(slot);
      return n;
    });
    setDrafts((d) => (typeof d[slot]?.choice === "number" ? { ...d, [slot]: { ...d[slot], choice: null } } : d));
  }

  function update(slot: WeeklySlot, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [slot]: { ...d[slot], ...patch } }));
  }

  function choose(slot: WeeklySlot, choice: number | typeof OWN) {
    const s = choice === OWN ? null : suggestions[slot]?.suggestions[choice];
    update(slot, s ? { choice, topic: s.baslik, brief: briefOf(s) } : { choice, topic: "", brief: "" });
  }

  function ready(slot: WeeklySlot): boolean {
    const d = drafts[slot];
    return !!d && !sent[slot] && d.ownerId !== "" && d.topic.trim().length >= 3;
  }

  function send(which: WeeklySlot[]) {
    const tasks: AssignTaskInput[] = which.filter(ready).map((slot) => ({
      slot,
      ownerId: drafts[slot].ownerId,
      topic: drafts[slot].topic.trim(),
      brief: drafts[slot].brief.trim() || undefined,
      dueAt: drafts[slot].due,
    }));
    if (tasks.length === 0) return;
    setErrors((e) => {
      const n = { ...e };
      for (const t of tasks) delete n[t.slot];
      delete n.genel;
      return n;
    });
    startTransition(async () => {
      try {
        const res = await assignContentTasks({ weekStart, tasks });
        if ("error" in res) {
          setErrors((e) => ({ ...e, genel: res.error }));
          return;
        }
        const names = new Map(teachers.map((t) => [t.id, t.name]));
        setSent((s) => {
          const n = { ...s };
          for (const c of res.created) {
            n[c.slot] = { code: c.code, owner: names.get(drafts[c.slot].ownerId) ?? "Öğretmen", waLink: c.waLink };
          }
          return n;
        });
        setErrors((e) => ({ ...e, ...Object.fromEntries(res.errors.map((x) => [x.slot, x.error])) }));
        router.refresh();
      } catch {
        setErrors((e) => ({ ...e, genel: "Gönderilemedi, tekrar deneyin." }));
      }
    });
  }

  const readyCount = open.filter((s) => ready(s.slot)).length;

  return (
    <div className="flex flex-col gap-4">
      {!aiEnabled ? (
        <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          AI önerileri kapalı (anahtar girilmedi)
        </p>
      ) : null}
      {teachers.length === 0 ? <p className="text-sm text-warning">Etkin öğretmen yok; görev verilemez.</p> : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3">
        {slots.map((s) => {
          const done = sent[s.slot];
          if (s.existing || done) {
            const info = s.existing ?? { code: done.code, owner: done.owner, topic: drafts[s.slot]?.topic ?? "" };
            return (
              <section key={s.slot} aria-label={s.label} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-bold text-foreground">{s.label}</h2>
                <p className="text-sm text-muted-foreground">
                  <b className="text-foreground">{info.code}</b> açık · {info.owner}
                </p>
                {info.topic ? <p className="text-sm text-foreground">{info.topic}</p> : null}
                {done?.waLink ? (
                  <a
                    href={done.waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center self-start rounded-xl bg-accent px-4 text-sm font-semibold text-on-primary hover:bg-accent-strong"
                  >
                    {done.owner}: WhatsApp&apos;tan haber ver
                  </a>
                ) : null}
              </section>
            );
          }
          const d = drafts[s.slot];
          const state = suggestions[s.slot];
          const isLoading = loading.has(s.slot);
          const list = state?.status === "hazir" ? state.suggestions : [];
          const groupName = `oneri-${s.slot}`;
          return (
            <section key={s.slot} aria-label={s.label} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground">{s.label}</h2>
                {aiEnabled ? (
                  <button type="button" onClick={() => regenerate(s.slot)} disabled={isLoading} className={secondaryBtn}>
                    <RefreshCw aria-hidden className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
                    Yeniden öner
                  </button>
                ) : null}
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[13px] text-muted-foreground">Konu</legend>
                {aiEnabled && isLoading ? (
                  <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles aria-hidden className="size-4" /> Öneriler hazırlanıyor…
                  </p>
                ) : null}
                {aiEnabled && !isLoading && state?.status === "hata" ? (
                  <p className="text-sm text-muted-foreground">Öneri alınamadı; konuyu elle yazın.</p>
                ) : null}
                {aiEnabled && !isLoading && state?.status === "hazir" && list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Bu yuva için öneri çıkmadı; konuyu elle yazın.</p>
                ) : null}
                {list.map((o, i) => (
                  <label
                    key={`${o.baslik}-${i}`}
                    className={`flex cursor-pointer gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
                      d.choice === i ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name={groupName}
                      checked={d.choice === i}
                      onChange={() => choose(s.slot, i)}
                      className="mt-1 size-4 shrink-0 accent-primary"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <b className="text-foreground">{o.baslik}</b>
                      <span className="text-muted-foreground">{o.aciklama}</span>
                      <span className="text-[13px] text-muted-foreground">Dayanak: {o.dayanak}</span>
                    </span>
                  </label>
                ))}
                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
                    d.choice === OWN ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={groupName}
                    checked={d.choice === OWN}
                    onChange={() => choose(s.slot, OWN)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <b className="text-foreground">Kendi konum</b>
                </label>
              </fieldset>

              <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                Konu başlığı (öğretmen görür)
                <input
                  type="text"
                  value={d.topic}
                  onChange={(e) => update(s.slot, { topic: e.target.value, choice: d.choice ?? OWN })}
                  maxLength={200}
                  placeholder="Örn. Sabah servis karşılaması"
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                Öğretmene not (isteğe bağlı)
                <textarea
                  value={d.brief}
                  onChange={(e) => update(s.slot, { brief: e.target.value })}
                  maxLength={1000}
                  rows={3}
                  className={fieldClass}
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                  Öğretmen
                  <select
                    value={d.ownerId}
                    onChange={(e) => update(s.slot, { ownerId: e.target.value })}
                    disabled={teachers.length === 0}
                    className={fieldClass}
                  >
                    <option value="">Seçin</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                  Teslim
                  <input
                    type="datetime-local"
                    value={d.due}
                    onChange={(e) => update(s.slot, { due: e.target.value })}
                    className={fieldClass}
                  />
                </label>
              </div>
              <button type="button" onClick={() => send([s.slot])} disabled={pending || !ready(s.slot)} className={`${primaryBtn} self-start`}>
                {pending ? "Gönderiliyor…" : "Gönder"}
              </button>
              {errors[s.slot] ? (
                <p role="alert" className="text-sm font-medium text-destructive-strong">
                  {errors[s.slot]}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      {open.length > 1 ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => send(open.map((s) => s.slot))} disabled={pending || readyCount === 0} className={primaryBtn}>
            {readyCount > 1 ? `Hazır ${readyCount} görevi birden gönder` : "Hazır görevleri gönder"}
          </button>
          <span className="text-[13px] text-muted-foreground">Konusu yazılmış ve öğretmeni seçilmiş yuvalar gönderilir.</span>
        </div>
      ) : null}
      {errors.genel ? (
        <p role="alert" className="text-sm font-medium text-destructive-strong">
          {errors.genel}
        </p>
      ) : null}
    </div>
  );
}
