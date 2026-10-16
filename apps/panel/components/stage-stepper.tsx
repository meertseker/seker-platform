import { Check } from "lucide-react";
import { label, LEAD_STATUSES, LOST_REASONS, type LeadStatus } from "@/lib/constants";

const STEPS: { status: LeadStatus; label: string }[] = [
  { status: "yeni", label: "Yeni" },
  { status: "ulasildi", label: "Ulaşıldı" },
  { status: "randevu", label: "Randevu" },
  { status: "gorusme_yapildi", label: "Görüşme" },
  { status: "teklif", label: "Teklif" },
  { status: "kazanildi", label: "Kayıt" },
];

interface StageStepperProps {
  status: LeadStatus;
  lostReason?: string | null;
}

/** Velinin aşamasını yatay adım çubuğu olarak gösterir; kayıp/beklemede ise tek rozet. */
export function StageStepper({ status, lostReason }: StageStepperProps) {
  if (status === "kaybedildi" || status === "beklemede") {
    const lost = status === "kaybedildi";
    return (
      <div
        className={`inline-flex min-h-12 items-center rounded-full px-4 py-2 text-sm font-semibold ${
          lost ? "bg-destructive-soft text-red-700" : "bg-muted text-slate-700"
        }`}
      >
        {label(LEAD_STATUSES, status)}
        {lost && lostReason ? ` · ${label(LOST_REASONS, lostReason)}` : ""}
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((step) => step.status === status);

  return (
    <ol className="flex flex-wrap gap-2" aria-label="Aşama">
      {STEPS.map((step, index) => {
        const done = index < currentIndex || status === "kazanildi";
        const current = index === currentIndex && status !== "kazanildi";
        return (
          <li
            key={step.status}
            aria-current={current ? "step" : undefined}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              current
                ? "bg-primary text-on-primary"
                : done
                  ? "bg-primary-soft text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {done ? <Check aria-hidden className="size-4" /> : null}
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
