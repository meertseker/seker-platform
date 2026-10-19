// Arama sonrası hazır WhatsApp mesajı: hangi sonuçta hangi şablon, ve wa.me linki.
// Hem arama ekranı (düğme) hem recordCall (bitti listesindeki satır) bunu kullanır; düğme yoksa satır da yoktur.
import type { WaTemplate } from "./settings";
import { fillTemplate } from "./template";
import { waMeUrl } from "@/lib/whatsapp";

export const CALL_WA_TEMPLATES: Readonly<Record<string, string>> = {
  randevu: "randevu_onay",
  ulasilamadi: "ulasilamadi",
};

/** Sonuç için şablon yoksa ya da telefon geçersizse null. */
export function callWaLink(
  result: string,
  phone: string,
  templates: WaTemplate[],
  vars: { veli: string; danisman: string },
): string | null {
  const key = Object.hasOwn(CALL_WA_TEMPLATES, result) ? CALL_WA_TEMPLATES[result] : null;
  const template = key ? templates.find((t) => t.key === key) : undefined;
  return template ? waMeUrl(phone, fillTemplate(template.text, vars)) : null;
}
