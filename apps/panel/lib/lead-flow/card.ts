// Veli kartı kuralları (saf modül): tek arama yolu ve bağlama göre hazır mesajlar.
import type { NextStep } from "@/lib/next-step";
import type { WaTemplate } from "./settings";

/**
 * R19: takip sırası etkinken tek arama yolu onun üstlenen "Ara · açtı" düğmesidir;
 * "Sıradaki adım" kutusundaki arama düğmesi kaldırılır.
 */
export function suppressCallStep(step: NextStep, timelineActive: boolean): NextStep {
  if (!timelineActive || step.action !== "call") return step;
  return { ...step, action: null, hint: "Takip sırasındaki düğmelerle ara." };
}

const AFTER_VISIT_STATUSES = ["gorusme_yapildi", "teklif", "kazanildi"];

/**
 * Hazır mesajlar velinin durumuna göre süzülür. Okulun eklediği bilinmeyen şablonlar her zaman görünür.
 * - randevu_onay: bekleyen randevu varsa
 * - ziyaret_tesekkur: görüşme yapıldıktan sonra
 * - kontenjan: veli kaybedildiyse
 */
export function cardTemplates(
  templates: WaTemplate[],
  ctx: { status: string; hasPendingAppointment: boolean },
): WaTemplate[] {
  return templates.filter((t) => {
    switch (t.key) {
      case "randevu_onay":
        return ctx.hasPendingAppointment;
      case "ziyaret_tesekkur":
        return AFTER_VISIT_STATUSES.includes(ctx.status);
      case "kontenjan":
        return ctx.status === "kaybedildi";
      default:
        return true;
    }
  });
}
