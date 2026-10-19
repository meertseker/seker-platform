import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { reopenLead } from "@/actions/leads";
import { CallButton } from "@/components/call-outcome";
import { StatusSelect } from "@/components/status-select";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { badgeClass, LEAD_STATUS_STYLES } from "@/lib/status-styles";
import {
  label,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOST_REASONS,
  type LeadSource,
  type LeadStatus,
  type LostReason,
} from "@/lib/constants";
import { sheetForAction, type NextStep } from "@/lib/next-step";

export interface LeadCardData {
  id: string;
  parent_name: string;
  phone: string;
  child_name: string | null;
  child_birth_month: number | null;
  child_birth_year: number | null;
  source: LeadSource;
  source_detail: string | null;
  status: LeadStatus;
  lost_reason: LostReason | null;
  assigned_to: string | null;
  converted_student_id: string | null;
  last_activity_at: string;
  first_contact_at: string | null;
  assigned: { id: string; full_name: string } | null;
}

interface LeadCardProps {
  lead: LeadCardData;
  archived?: boolean;
  step?: NextStep;
  /** Son işlemden bu yana geçen gün; eşik üstündeyse kırmızı uyarı gösterilir. */
  waitingDays?: number;
}

export const WAITING_DAYS_THRESHOLD = 3;

const PRIMARY_CLASS =
  "inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function formatChild(lead: LeadCardData) {
  const month = lead.child_birth_month?.toString().padStart(2, "0");
  const birth = [month, lead.child_birth_year].filter(Boolean).join("/");

  if (lead.child_name && birth) return `${lead.child_name} (${birth})`;
  if (lead.child_name) return lead.child_name;
  if (birth) return `Doğum: ${birth}`;
  return "Çocuk bilgisi yok";
}

async function reopenLeadAction(formData: FormData) {
  "use server";

  const leadId = String(formData.get("leadId"));
  await reopenLead(leadId);
}

function StepButton({ lead, step }: { lead: LeadCardData; step: NextStep }) {
  if (step.action === "call") {
    return (
      <CallButton
        leadId={lead.id}
        phone={lead.phone}
        leadName={lead.parent_name}
        contacted={!!lead.first_contact_at}
        label={step.title}
        variant="primary"
        className="min-h-12! w-full"
      />
    );
  }
  if (step.action === null) {
    return (
      <p className="rounded-xl bg-muted px-3 py-2.5 text-sm font-medium text-slate-700">
        {step.title}
      </p>
    );
  }
  const sheet = sheetForAction(step.action);
  return (
    <Link
      href={sheet ? `/leads/${lead.id}?adim=${sheet}` : `/leads/${lead.id}`}
      className={PRIMARY_CLASS}
    >
      {step.title}
    </Link>
  );
}

export function LeadCard({ lead, archived = false, step, waitingDays = 0 }: LeadCardProps) {
  const isLost = lead.status === "kaybedildi";
  const waiting = !archived && waitingDays >= WAITING_DAYS_THRESHOLD;

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/leads/${lead.id}`}
          className="min-w-0 text-base font-semibold text-foreground hover:underline"
        >
          {lead.parent_name}
        </Link>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
          {label(LEAD_SOURCES, lead.source)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{formatChild(lead)}</p>
      {waiting ? (
        <p className="mt-2 text-sm font-semibold text-red-700">{waitingDays} gündür bekliyor</p>
      ) : null}

      {archived ? (
        <div className="mt-3 space-y-3">
          <div className={badgeClass(LEAD_STATUS_STYLES[lead.status])}>
            {label(LEAD_STATUSES, lead.status)}
            {lead.lost_reason ? ` - ${label(LOST_REASONS, lead.lost_reason)}` : ""}
          </div>
          {isLost ? (
            <form action={reopenLeadAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              <button
                type="submit"
                className="min-h-12 w-full cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Yeniden Aç
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <>
          {step ? (
            <div className="mt-3">
              <StepButton lead={lead} step={step} />
            </div>
          ) : null}
          <details className="mt-2">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-1 rounded-xl px-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Diğer
              <ChevronDown aria-hidden className="size-4" />
            </summary>
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                {step?.action === "call" ? null : (
                  <CallButton
                    leadId={lead.id}
                    phone={lead.phone}
                    leadName={lead.parent_name}
                    contacted={!!lead.first_contact_at}
                    variant="icon"
                  />
                )}
                <WhatsAppButton phone={lead.phone} compact />
                <span className="text-sm tabular-nums text-muted-foreground">{lead.phone}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Danışman: {lead.assigned?.full_name ?? "Atanmamış"}
              </p>
              <StatusSelect
                leadId={lead.id}
                status={lead.status}
                converted={lead.converted_student_id !== null}
              />
            </div>
          </details>
        </>
      )}
    </article>
  );
}
