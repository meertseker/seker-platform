import Link from "next/link";
import { reopenLead } from "@/actions/leads";
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
  assigned: { id: string; full_name: string } | null;
}

interface LeadCardProps {
  lead: LeadCardData;
  archived?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

function formatChild(lead: LeadCardData) {
  const birth = [lead.child_birth_month, lead.child_birth_year]
    .filter(Boolean)
    .join("/");

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

export function LeadCard({ lead, archived = false }: LeadCardProps) {
  const isLost = lead.status === "kaybedildi";

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/leads/${lead.id}`}
            className="font-semibold text-foreground hover:underline"
          >
            {lead.parent_name}
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{lead.phone}</p>
            <WhatsAppButton phone={lead.phone} compact />
          </div>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          {label(LEAD_SOURCES, lead.source)}
        </span>
      </div>

      {lead.source_detail ? (
        <p className="mt-3 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          {lead.source_detail}
        </p>
      ) : null}

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Çocuk</dt>
          <dd className="text-foreground">{formatChild(lead)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Danışman</dt>
          <dd className="text-foreground">
            {lead.assigned?.full_name ?? "Atanmamış"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Son aktivite</dt>
          <dd className="text-foreground tabular-nums">
            {dateFormatter.format(new Date(lead.last_activity_at))}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        {archived ? (
          <div className="space-y-3">
            <div className={badgeClass(LEAD_STATUS_STYLES[lead.status])}>
              {label(LEAD_STATUSES, lead.status)}
              {lead.lost_reason
                ? ` - ${label(LOST_REASONS, lead.lost_reason)}`
                : ""}
            </div>
            {isLost ? (
              <form action={reopenLeadAction}>
                <input type="hidden" name="leadId" value={lead.id} />
                <button
                  type="submit"
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Yeniden Aç
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <StatusSelect
            leadId={lead.id}
            status={lead.status}
            converted={lead.converted_student_id !== null}
          />
        )}
      </div>
    </article>
  );
}
