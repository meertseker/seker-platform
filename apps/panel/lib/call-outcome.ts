import type { LeadStatus, LostReason } from "./constants";

export const CALL_OUTCOMES = {
  ulastim: "Ulaştım",
  acmadi: "Açmadı",
  yanlis: "Yanlış numara",
} as const;
export type CallOutcome = keyof typeof CALL_OUTCOMES;

export const CALL_NEXT_STEPS = {
  randevu: "Randevu ver",
  fiyat: "Fiyat gönder",
  sonra: "Sonra ara",
} as const;
export type CallNextStep = keyof typeof CALL_NEXT_STEPS;

export interface CallOutcomePlan {
  note: string;
  status: { to: LeadStatus; lostReason?: LostReason } | null;
  task: { title: string; dueInDays: number } | null;
  redirectToAppointment: boolean;
}

/** Arama sonucuna göre yazılacak not, durum değişikliği ve görevi belirler (saf fonksiyon). */
export function planCallOutcome(input: {
  outcome: CallOutcome;
  next?: CallNextStep | null;
  status: LeadStatus;
  note?: string | null;
}): CallOutcomePlan {
  const userNote = input.note?.trim() ?? "";
  const withNote = (base: string) => (userNote ? `${base} ${userNote}` : base);

  if (input.outcome === "ulastim") {
    const next = input.next ?? "randevu";
    return {
      note: userNote || "Arandı, ulaşıldı.",
      status: input.status === "yeni" ? { to: "ulasildi" } : null,
      task:
        next === "fiyat"
          ? { title: "Fiyat bilgisini gönder", dueInDays: 0 }
          : next === "sonra"
            ? { title: "Tekrar ara", dueInDays: 1 }
            : null,
      redirectToAppointment: next === "randevu",
    };
  }

  if (input.outcome === "acmadi") {
    return {
      note: withNote("Arandı, açmadı."),
      status: null,
      task: { title: "Tekrar ara", dueInDays: 0 },
      redirectToAppointment: false,
    };
  }

  return {
    note: withNote("Yanlış numara."),
    status:
      input.status === "kaybedildi"
        ? null
        : { to: "kaybedildi", lostReason: "ulasilamadi" },
    task: null,
    redirectToAppointment: false,
  };
}

/** YYYY-MM-DD tarihine gün ekler (takvim günü, saat dilimi bağımsız). */
export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}
