import Link from "next/link";
import { reopenLead } from "@/actions/leads";
import { StatusSelect } from "@/components/status-select";
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
    <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/leads/${lead.id}`}
            className="font-semibold text-zinc-950 hover:underline"
          >
            {lead.parent_name}
          </Link>
          <p className="mt-1 text-sm text-zinc-500">{lead.phone}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {label(LEAD_SOURCES, lead.source)}
        </span>
      </div>

      {lead.source_detail ? (
        <p className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          {lead.source_detail}
        </p>
      ) : null}

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium text-zinc-500">Çocuk</dt>
          <dd className="text-zinc-800">{formatChild(lead)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500">Danışman</dt>
          <dd className="text-zinc-800">
            {lead.assigned?.full_name ?? "Atanmamış"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500">Son aktivite</dt>
          <dd className="text-zinc-800">
            {dateFormatter.format(new Date(lead.last_activity_at))}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        {archived ? (
          <div className="space-y-3">
            <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700">
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
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
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
