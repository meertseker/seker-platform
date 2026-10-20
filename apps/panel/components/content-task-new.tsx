"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createContentTask } from "@/actions/content";
import { Sheet } from "@/components/sheet";
import { addDaysToDateString, istanbulDateString } from "@/lib/lead-flow/business-hours";

interface Props {
  teachers: { id: string; name: string }[];
  onCreated: (code: string) => void;
}

type Created = { code: string; waLink: string | null };

const fieldClass =
  "mt-1.5 block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted placeholder:text-placeholder";
const labelClass = "text-sm font-medium text-foreground";

/** Varsayılan teslim: üç gün sonra 17:00 (İstanbul). */
function defaultDue(): string {
  return `${addDaysToDateString(istanbulDateString(new Date()), 3)}T17:00`;
}

export function ContentTaskNew({ teachers, onCreated }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"reels" | "sayfa">("reels");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [due, setDue] = useState("");
  const [pending, startTransition] = useTransition();

  function openForm() {
    setError(null);
    setCreated(null);
    setDue(defaultDue());
    setOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "");
    setError(null);
    startTransition(async () => {
      const result = await createContentTask({
        kind,
        pagePlatform: text("pagePlatform") === "instagram" ? "instagram" : "google",
        ownerId: text("ownerId"),
        topic: text("topic"),
        audience: text("audience"),
        brief: text("brief"),
        dueAt: text("dueAt"),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCreated({ code: result.code, waLink: result.waLink });
      router.refresh();
    });
  }

  function showCard() {
    if (created) onCreated(created.code);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openForm}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-semibold text-on-primary hover:bg-primary-strong"
      >
        <Plus size={18} aria-hidden />
        Yeni görev
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Yeni görev"
        description="Öğretmene bu haftanın Reels ya da sayfa görevi. Metni öğretmen yazar."
      >
        {created ? (
          <div className="flex flex-col gap-4">
            <p className="text-base text-foreground">
              <b>{created.code}</b> açıldı. Öğretmene panel bildirimi gitti.
            </p>
            {created.waLink ? (
              <a
                href={created.waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-14 items-center justify-center rounded-xl bg-accent px-5 text-base font-semibold text-on-primary hover:bg-accent-strong"
              >
                Öğretmene WhatsApp&apos;tan haber ver
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Öğretmenin telefonu kayıtlı değil; WhatsApp bağlantısı yok.</p>
            )}
            <button
              type="button"
              onClick={showCard}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-foreground hover:bg-muted"
            >
              Kartı aç
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className={labelClass}>Tür</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(["reels", "sayfa"] as const).map((k) => (
                  <label
                    key={k}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-[15px] font-semibold ${
                      kind === k ? "border-primary bg-primary-soft text-primary-strong" : "border-input text-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={k}
                      checked={kind === k}
                      onChange={() => setKind(k)}
                      className="accent-primary"
                    />
                    {k === "reels" ? "Reels" : "Sayfa"}
                  </label>
                ))}
              </div>
            </fieldset>

            {kind === "sayfa" ? (
              <div>
                <label htmlFor="task-page-platform" className={labelClass}>
                  Sayfa platformu
                </label>
                <select id="task-page-platform" name="pagePlatform" defaultValue="google" className={fieldClass}>
                  <option value="google">Google sayfası</option>
                  <option value="instagram">Instagram sayfası</option>
                </select>
              </div>
            ) : null}

            <div>
              <label htmlFor="task-owner" className={labelClass}>
                Öğretmen
              </label>
              <select id="task-owner" name="ownerId" required defaultValue="" className={fieldClass}>
                <option value="" disabled>
                  Seçin
                </option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {teachers.length === 0 ? (
                <p className="mt-1 text-sm text-warning">Etkin öğretmen yok. Önce öğretmen hesabı açılmalı.</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="task-topic" className={labelClass}>
                Konu
              </label>
              <input
                id="task-topic"
                name="topic"
                required
                minLength={3}
                maxLength={200}
                placeholder="Örn. 07:30'da kapımız açık"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="task-audience" className={labelClass}>
                Kime
              </label>
              <input
                id="task-audience"
                name="audience"
                maxLength={200}
                placeholder="Örn. çalışan anne babalar"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="task-brief" className={labelClass}>
                Tek cümle
              </label>
              <input
                id="task-brief"
                name="brief"
                maxLength={1000}
                placeholder="Videoda ne anlatılacak, tek cümleyle"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="task-due" className={labelClass}>
                Teslim zamanı
              </label>
              <input
                id="task-due"
                name="dueAt"
                type="datetime-local"
                required
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className={fieldClass}
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending || teachers.length === 0}
              className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Açılıyor…" : "Görevi aç"}
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}
