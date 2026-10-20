// İçerik hattı aşamaları (saf modül).
import type { ContentKind } from "./codes";

export type StageKey = "gorev" | "kontrol" | "organik" | "test" | "kazanan" | "arsiv";

export const STAGES: { key: StageKey; title: string; hint: string }[] = [
  { key: "gorev", title: "Görev", hint: "Öğretmen hazırlıyor" },
  { key: "kontrol", title: "Kontrol", hint: "Onay bekliyor" },
  { key: "organik", title: "Organik · 72 saat", hint: "Reels önce bedava denenir" },
  { key: "test", title: "Testte", hint: "Küçük bütçe, kurala göre karar" },
  { key: "kazanan", title: "Kazanan", hint: "Büyütme kampanyasında" },
  { key: "arsiv", title: "Arşiv", hint: "Durdu ama öğrenilen kaldı" },
];

/** Onaydan sonraki aşama: Reels organiğe, sayfa doğrudan teste gider. */
export function nextStageAfterApproval(kind: ContentKind): "organik" | "test" {
  return kind === "reels" ? "organik" : "test";
}
