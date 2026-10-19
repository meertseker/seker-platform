"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarPlus, ChevronDown, FileText, NotebookPen } from "lucide-react";
import { reopenLead } from "@/actions/leads";
import { createOfferFromCounter } from "@/actions/offers";
import { AppointmentForm } from "@/components/appointment-form";
import { AppointmentList, type AppointmentListItem } from "@/components/appointment-list";
import { CallButton } from "@/components/call-outcome";
import { LeadConversionForm } from "@/components/lead-conversion-form";
import { DeleteLeadButton, LeadEditForm } from "@/components/lead-edit-form";
import { NoteForm } from "@/components/note-form";
import { OfferForm, type ActivePriceItem } from "@/components/offer-form";
import { Sheet } from "@/components/sheet";
import { StatusSelect } from "@/components/status-select";
import type { LeadSource, LeadStatus } from "@/lib/constants";
import { sheetForAction, type NextStep, type StepSheet } from "@/lib/next-step";

export type LeadSheet = StepSheet | "durum" | "duzenle";

export interface LeadEditData {
  id: string;
  parent_name: string;
  phone: string;
  source: LeadSource;
  source_detail: string | null;
  child_name: string | null;
  child_birth_month: number | null;
  child_birth_year: number | null;
  ingilizce_gerekli: boolean;
  ozel_durum: boolean;
  ozel_durum_note: string | null;
  wants_summer: boolean;
}

interface LeadActionsProps {
  lead: LeadEditData;
  status: LeadStatus;
  convertedStudentId: string | null;
  role: "yonetici" | "danisman";
  step: NextStep;
  initialSheet: LeadSheet | null;
  priceItems: ActivePriceItem[];
  resultAppointments: AppointmentListItem[];
  counterOfferId: string | null;
  canConvert: boolean;
  /** Dönüştürme mümkün değilse ne eksik olduğu (kayıt paneli bunu yazar). */
  convertBlocker: string;
}

const PRIMARY_CLASS =
  "inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";
const OUTLINE_CLASS =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const MENU_ITEM_CLASS =
  "min-h-12 w-full cursor-pointer rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const PRIMARY_LABELS: Partial<Record<NonNullable<NextStep["action"]>, string>> = {
  appointment: "Randevu ver",
  appointment_result: "Sonucu gir",
  offer: "Teklif hazırla",
  convert: "Öğrenciye dönüştür",
};

/** Veli sayfasının "Sıradaki adım" kutusu, ikincil butonları ve tüm form panelleri. */
export function LeadActions({
  lead,
  status,
  convertedStudentId,
  role,
  step,
  initialSheet,
  priceItems,
  resultAppointments,
  counterOfferId,
  canConvert,
  convertBlocker,
}: LeadActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sheet, setSheet] = useState<LeadSheet | null>(initialSheet);
  const [prevInitial, setPrevInitial] = useState<LeadSheet | null>(initialSheet);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ?adim= değişince (ör. arama sonrası yönlendirme) ilgili paneli aç.
  if (initialSheet !== prevInitial) {
    setPrevInitial(initialSheet);
    setSheet(initialSheet);
  }

  const converted = convertedStudentId !== null;
  const lost = status === "kaybedildi";
  const active = !converted && !lost;

  function closeSheet() {
    setSheet(null);
    if (initialSheet) router.replace(pathname, { scroll: false });
  }

  function runCounterOffer() {
    if (!counterOfferId) return;
    setActionError(null);
    startTransition(async () => {
      const result = await createOfferFromCounter(counterOfferId);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function runReopen() {
    setActionError(null);
    startTransition(async () => {
      const result = await reopenLead(lead.id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function primaryButton() {
    const target = sheetForAction(step.action);
    if (target) {
      return (
        <button type="button" onClick={() => setSheet(target)} className={PRIMARY_CLASS}>
          {PRIMARY_LABELS[step.action as keyof typeof PRIMARY_LABELS] ?? step.title}
        </button>
      );
    }
    switch (step.action) {
      case "call":
        return (
          <CallButton
            leadId={lead.id}
            phone={lead.phone}
            leadName={lead.parent_name}
            variant="primary"
            className="w-full sm:w-auto"
          />
        );
      case "counter_offer":
        return (
          <button type="button" disabled={isPending} onClick={runCounterOffer} className={PRIMARY_CLASS}>
            {isPending ? "Oluşturuluyor..." : "Karşı rakamla teklif oluştur"}
          </button>
        );
      case "open_student":
        return (
          <Link href={`/ogrenciler/${convertedStudentId}`} className={PRIMARY_CLASS}>
            Öğrenci kaydına git
          </Link>
        );
      case "reopen":
        return (
          <button type="button" disabled={isPending} onClick={runReopen} className={PRIMARY_CLASS}>
            {isPending ? "Açılıyor..." : "Yeniden aç"}
          </button>
        );
      default:
        return null;
    }
  }

  const showOther = !converted || role === "yonetici";

  return (
    <>
      <section className="rounded-2xl bg-primary-soft p-5 sm:p-6" aria-labelledby="next-step-title">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-strong">Sıradaki adım</p>
        <h2 id="next-step-title" className="mt-1 text-2xl font-semibold text-foreground">
          {step.title}
        </h2>
        <p className="mt-1 text-base text-slate-700">{step.hint}</p>
        {step.action ? <div className="mt-4">{primaryButton()}</div> : null}
        {actionError ? (
          <p role="alert" className="mt-3 rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
            {actionError}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {active ? (
          <>
            <button type="button" onClick={() => setSheet("randevu")} className={OUTLINE_CLASS}>
              <CalendarPlus aria-hidden className="size-4" />
              Randevu ver
            </button>
            <button type="button" onClick={() => setSheet("teklif")} className={OUTLINE_CLASS}>
              <FileText aria-hidden className="size-4" />
              Teklif hazırla
            </button>
          </>
        ) : null}
        <button type="button" onClick={() => setSheet("not")} className={OUTLINE_CLASS}>
          <NotebookPen aria-hidden className="size-4" />
          Not yaz
        </button>
        {showOther ? (
          <details className="relative">
            <summary
              className={`${OUTLINE_CLASS} list-none [&::-webkit-details-marker]:hidden`}
            >
              Diğer
              <ChevronDown aria-hidden className="size-4" />
            </summary>
            <div className="glass-thick absolute right-0 z-20 mt-1 w-56 origin-top-right animate-pop-in rounded-2xl p-1 sm:left-0 sm:right-auto sm:origin-top-left">
              {!converted ? (
                <>
                  <button
                    type="button"
                    className={MENU_ITEM_CLASS}
                    onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      setSheet("durum");
                    }}
                  >
                    Durum değiştir
                  </button>
                  <button
                    type="button"
                    className={MENU_ITEM_CLASS}
                    onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      setSheet("duzenle");
                    }}
                  >
                    Bilgileri düzenle
                  </button>
                </>
              ) : null}
              {role === "yonetici" ? (
                <DeleteLeadButton leadId={lead.id} parentName={lead.parent_name} />
              ) : null}
            </div>
          </details>
        ) : null}
      </div>

      <Sheet
        open={sheet === "randevu"}
        onClose={closeSheet}
        title="Randevu ver"
        description="Okul ziyareti veya telefon görüşmesi için gün ve saat seçin."
      >
        {active ? (
          <AppointmentForm leadId={lead.id} onSuccess={closeSheet} />
        ) : (
          <p className="text-base text-muted-foreground">Bu veli için randevu verilemez.</p>
        )}
      </Sheet>

      <Sheet open={sheet === "teklif"} onClose={closeSheet} title="Teklif hazırla">
        {active ? (
          <OfferForm leadId={lead.id} priceItems={priceItems} onSuccess={closeSheet} />
        ) : (
          <p className="text-base text-muted-foreground">Bu veli için teklif hazırlanamaz.</p>
        )}
      </Sheet>

      <Sheet
        open={sheet === "kayit"}
        onClose={closeSheet}
        title="Öğrenciye dönüştür"
        description="Onaylı teklifle öğrenci kaydı açılır, ardından ödeme planına geçilir."
      >
        {canConvert ? (
          <LeadConversionForm leadId={lead.id} />
        ) : (
          <div className="space-y-4">
            <p className="rounded-xl bg-warning-soft px-4 py-3 text-base font-medium text-amber-900">
              {convertBlocker}
            </p>
            {active ? (
              <button type="button" onClick={() => setSheet("teklif")} className={PRIMARY_CLASS}>
                Teklif hazırla
              </button>
            ) : null}
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === "not"} onClose={closeSheet} title="Not yaz">
        <NoteForm leadId={lead.id} onSuccess={closeSheet} rows={4} primary />
      </Sheet>

      <Sheet
        open={sheet === "sonuc"}
        onClose={closeSheet}
        title="Ziyaret sonucunu gir"
        description="Veli randevuya geldi mi?"
      >
        <AppointmentList
          appointments={resultAppointments}
          emptyText="Sonuç bekleyen randevu yok."
          onResult={closeSheet}
        />
      </Sheet>

      <Sheet open={sheet === "durum"} onClose={closeSheet} title="Durum değiştir">
        {converted ? (
          <p className="text-base text-muted-foreground">Öğrenciye dönüştürülen velinin durumu değişmez.</p>
        ) : (
          <StatusSelect
            leadId={lead.id}
            status={status}
            converted={converted}
            onChanged={closeSheet}
          />
        )}
      </Sheet>

      <Sheet open={sheet === "duzenle"} onClose={closeSheet} title="Bilgileri düzenle">
        {converted ? (
          <p className="text-base text-muted-foreground">Öğrenciye dönüştürülen veli düzenlenemez.</p>
        ) : (
          <LeadEditForm lead={lead} onSuccess={closeSheet} />
        )}
      </Sheet>
    </>
  );
}
