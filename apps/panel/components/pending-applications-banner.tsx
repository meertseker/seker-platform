import Link from "next/link";
import { CallButton } from "@/components/call-outcome";
import { elapsedText } from "@/lib/next-step";

export interface PendingApplication {
  id: string;
  parent_name: string;
  phone: string;
  created_at: string;
}

/** Son 24 saatte gelen, hâlâ aranmamış web/reklam başvuruları — her sayfanın üstünde. */
export function PendingApplicationsBanner({
  applications,
  now,
}: {
  applications: PendingApplication[];
  now: string;
}) {
  if (applications.length === 0) return null;
  const oldest = applications[0];

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-destructive-soft p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-base font-semibold text-red-800">
        {applications.length} başvuru aranmayı bekliyor · {oldest.parent_name} ·{" "}
        {elapsedText(oldest.created_at, now)}
      </p>
      <div className="flex flex-wrap gap-2">
        <CallButton
          leadId={oldest.id}
          phone={oldest.phone}
          leadName={oldest.parent_name}
          label={`${oldest.parent_name.split(" ")[0]} ara`}
          variant="primary"
          className="min-h-12!"
        />
        <Link
          href="/pipeline?filtre=basvuru"
          className="inline-flex min-h-12 items-center rounded-xl border border-red-200 bg-surface px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Hepsini gör
        </Link>
      </div>
    </div>
  );
}
