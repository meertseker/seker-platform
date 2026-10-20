"use client";

import Link from "next/link";
import { ChevronDown, Clock } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAppointmentOutcome } from "@/actions/appointments";
import { CallButton } from "@/components/call-outcome";
import { PanelDid } from "@/components/panel-did";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { APPOINTMENT_OUTCOME_STYLES, badgeClass } from "@/lib/status-styles";
import {
  APPOINTMENT_OUTCOMES,
  APPOINTMENT_TYPES,
  label,
  type AppointmentOutcome,
  type AppointmentType,
} from "@/lib/constants";

export interface AppointmentListItem {
  id: string;
  leadId?: string;
  leadName?: string;
  leadPhone?: string;
  /** Velinin ilk teması yapıldı mı; bilinmiyorsa arama üstlenme yolundan geçer. */
  leadContacted?: boolean;
  scheduled_at: string;
  type: AppointmentType;
  outcome: AppointmentOutcome;
  outcome_note: string | null;
}

interface AppointmentListProps {
  appointments: AppointmentListItem[];
  emptyText?: string;
  compactTime?: boolean;
  onResult?: () => void;
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

interface NoteDraft {
  id: string;
  outcome: AppointmentOutcome;
  note: string;
}

const OUTCOME_BUTTON_BASE =
  "min-h-12 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_OUTCOME_CLASS = `${OUTCOME_BUTTON_BASE} min-h-14 bg-primary px-5 text-base text-on-primary hover:bg-primary-strong focus-visible:ring-offset-2`;
const OUTLINE_OUTCOME_CLASS = `${OUTCOME_BUTTON_BASE} min-h-14 border border-border bg-surface px-5 text-base text-slate-700 hover:border-slate-300 hover:text-foreground`;
const MENU_ITEM_CLASS =
  "min-h-12 w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Geçmiş saatli ama hâlâ "bekliyor" olan randevu = gecikmiş iş (üstte kırmızı gösterilir). */
function isOverduePending(appointment: AppointmentListItem) {
  return (
    appointment.outcome === "bekliyor" &&
    new Date(appointment.scheduled_at).getTime() < Date.now()
  );
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function needsNote(outcome: AppointmentOutcome) {
  return outcome === "gelmedi" || outcome === "ertelendi";
}

export function AppointmentList({
  appointments,
  emptyText = "Henüz randevu yok. İlk randevuyu ekleyin.",
  compactTime = false,
  onResult,
}: AppointmentListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  // Son işlemin "Panel şunları yaptı" listesi; yenileme sonrası randevunun altında kalır.
  const [done, setDone] = useState<{ id: string; items: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitOutcome(id: string, outcome: AppointmentOutcome, note?: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await setAppointmentOutcome(id, outcome, note?.trim() || undefined);
      setPendingId(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      setNoteDraft(null);
      setDone({ id, items: result.done ?? [] });
      router.refresh();
      onResult?.();
    });
  }

  function updateOutcome(id: string, outcome: AppointmentOutcome) {
    if (needsNote(outcome)) {
      setError(null);
      setNoteDraft({ id, outcome, note: "" });
      return;
    }

    submitOutcome(id, outcome);
  }

  if (appointments.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {appointments.map((appointment) => {
          const activeNoteDraft =
            noteDraft?.id === appointment.id ? noteDraft : null;
          const isSavingAppointment = pendingId === appointment.id && isPending;
          const overduePending = isOverduePending(appointment);

          return (
            <li
              key={appointment.id}
              className={`rounded-2xl border p-4 shadow-sm ${
                overduePending
                  ? "border-red-300 bg-destructive-soft"
                  : "border-border bg-surface"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Clock
                      aria-hidden
                      className={`size-4 ${overduePending ? "text-red-700" : "text-muted-foreground"}`}
                    />
                    <time
                      dateTime={appointment.scheduled_at}
                      className={`text-base font-semibold tabular-nums ${
                        overduePending ? "text-red-800" : "text-foreground"
                      }`}
                    >
                      {compactTime
                        ? formatTime(appointment.scheduled_at)
                        : formatDate(appointment.scheduled_at)}
                    </time>
                    {overduePending ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                        Geçmiş / sonuçlanmadı
                      </span>
                    ) : null}
                  </div>
                  {appointment.leadId ? (
                    <div className="mt-1 flex items-center gap-2">
                      <Link
                        href={`/leads/${appointment.leadId}`}
                        className="text-sm font-semibold text-foreground transition-colors hover:underline"
                      >
                        {appointment.leadName ?? "Veli kartına git"}
                      </Link>
                      {appointment.leadPhone ? (
                        <>
                          <CallButton
                            leadId={appointment.leadId}
                            phone={appointment.leadPhone}
                            leadName={appointment.leadName}
                            contacted={appointment.leadContacted ?? false}
                            variant="icon"
                          />
                          <WhatsAppButton phone={appointment.leadPhone} compact />
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {label(APPOINTMENT_TYPES, appointment.type)}
                  </p>
                  {appointment.outcome_note ? (
                    <p className="mt-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {appointment.outcome_note}
                    </p>
                  ) : null}
                </div>

                <span
                  className={`w-fit ${badgeClass(
                    APPOINTMENT_OUTCOME_STYLES[appointment.outcome],
                  )}`}
                >
                  {label(APPOINTMENT_OUTCOMES, appointment.outcome)}
                </span>
              </div>

              {appointment.outcome === "bekliyor" ? (
                <>
                  <div className="mt-4 flex flex-wrap items-start gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => updateOutcome(appointment.id, "geldi")}
                      className={PRIMARY_OUTCOME_CLASS}
                    >
                      {isSavingAppointment ? "Kaydediliyor..." : label(APPOINTMENT_OUTCOMES, "geldi")}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => updateOutcome(appointment.id, "gelmedi")}
                      className={OUTLINE_OUTCOME_CLASS}
                    >
                      {label(APPOINTMENT_OUTCOMES, "gelmedi")}
                    </button>
                    <details className="relative">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-1 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        Diğer…
                        <ChevronDown aria-hidden className="size-4" />
                      </summary>
                      <div className="glass-thick absolute left-0 z-20 mt-1 w-44 origin-top-left animate-pop-in rounded-2xl p-1">
                        {(["ertelendi", "iptal"] as AppointmentOutcome[]).map((value) => (
                          <button
                            key={value}
                            type="button"
                            disabled={isPending}
                            onClick={(event) => {
                              event.currentTarget.closest("details")?.removeAttribute("open");
                              updateOutcome(appointment.id, value);
                            }}
                            className={MENU_ITEM_CLASS}
                          >
                            {label(APPOINTMENT_OUTCOMES, value)}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>

                  {activeNoteDraft ? (
                    <div className="mt-3 rounded-2xl border border-border bg-muted p-3">
                      <label
                        htmlFor={`appointment-note-${appointment.id}`}
                        className="text-sm font-medium text-foreground"
                      >
                        Kısa not (opsiyonel)
                      </label>
                      <input
                        id={`appointment-note-${appointment.id}`}
                        type="text"
                        value={activeNoteDraft.note}
                        disabled={isPending}
                        onChange={(event) =>
                          setNoteDraft({
                            ...activeNoteDraft,
                            note: event.target.value,
                          })
                        }
                        className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
                        placeholder="Örn. veli tekrar aranacak"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            submitOutcome(
                              activeNoteDraft.id,
                              activeNoteDraft.outcome,
                              activeNoteDraft.note,
                            )
                          }
                          className="min-h-12 cursor-pointer rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingAppointment ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setNoteDraft(null)}
                          className="min-h-12 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Vazgeç
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
              {done?.id === appointment.id ? (
                <div className="mt-3">
                  <PanelDid items={done.items} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
