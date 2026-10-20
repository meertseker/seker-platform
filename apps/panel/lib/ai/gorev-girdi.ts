// AI konu önerisinin prompt'u (saf modül). Kişisel veri girmez: yalnız okul metni, konular, kelimeler ve sayılar.
// Harcama tutarı da girmez (danışman para görmez). Veri az ya da hiç yokken de derlenir.
import { SLOTS, type WeeklySlot } from "@/lib/content/slots";

export type PromptData = {
  /** Görevlerin açılacağı haftanın Pazartesi'si. */
  weekStart: string;
  schoolInfo: string;
  banned: string[];
  slots: WeeklySlot[];
  /** Son haftalarda verilmiş görevler (tekrar etmesin). */
  recentTopics: { weekStart: string; code: string; topic: string }[];
  /** İçerik koduyla gelen adayların aşama sayıları. */
  contentLeads: { code: string; topic: string | null; total: number; randevu: number; kayit: number; kayip: number }[];
  /** Arama kelimesi başına aday, randevu ve sonrası, kayıt. */
  keywords: { term: string; total: number; randevu: number; kayit: number }[];
  /** Kampanya adları ve tıklama/gösterim (tutar yok). */
  campaigns: { name: string; platform: string; clicks: number; impressions: number }[];
};

export const SCHOOL_INFO_MAX = 20_000;
const MAX_KEYWORDS = 20;
const MAX_TOPICS = 60;

const SLOT_HINTS: Record<WeeklySlot, string> = {
  reels_a: "Instagram Reels videosu: dikey, 20–45 saniye; öğretmen telefonla çeker ve kısa açıklamasını yazar.",
  reels_b: "İkinci Reels videosu: Reels A'dan farklı bir konu ya da farklı bir açı.",
  sayfa_google: "Google aramasından gelen veliye açılan sayfa: arama yapan velinin sorusuna cevap veren başlık ve kısa metin.",
  sayfa_instagram: "Instagram reklamından gelen veliye açılan sayfa: videoyu görmüş velinin merakını sürdüren başlık ve kısa metin.",
};

export const SYSTEM_PROMPT = `Sen Şeker Anaokulu'nun içerik planlamasına yardım ediyorsun. Görevi veren kişi her hafta öğretmenlere içerik görevi verir; sen yalnız konu önerirsin.

Kurallar:
- Yalnız konu öner: başlık, 2-3 cümlelik açıklama (ne anlatılacak, neden bu hafta) ve dayandığı okul artısı. Video metni, reklam yazısı, sayfa metni ya da açıklama yazma; içeriği öğretmen hazırlar.
- Dayanak, verilen okul bilgilerindeki bir artı olmalı. Okul bilgisinde olmayan bir özellik uydurma. Okul bilgisi yoksa velilerin genel sorularına dayan ve dayanakta bunu belirt.
- MEB kuralı: öğrencinin yüzünü ya da adını gerektiren konu önerme. Çekim el, arkadan çekim, boş sınıf, bahçe, materyal ya da öğretmenle yapılabilmeli.
- Kanıt isteyen iddia kullanma: "en iyi", "bir numara", "en güvenli", "garanti" ve verilen yasaklı ifadelerin hiçbiri (ekleriyle de) geçmesin.
- Para, fiyat, bütçe, harcama ya da maliyetten söz etme.
- Son haftalarda verilmiş konuları tekrar etme; aynı artıyı farklı açıdan işlemek serbest.
- Reklam ve aday verisi az ya da hiç olmayabilir; o zaman okul bilgilerine, mevsime ve okul takvimine dayan. Veriden kesin sonuç çıkarma.
- Her yuva için 2-3 öneri ver; öneriler birbirinden farklı olsun. Türkçe, sade ve kısa yaz.`;

const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function longDate(day: string): string {
  return dateFormatter.format(new Date(`${day}T00:00:00Z`));
}

/** Arama kelimesi: tek satır, kısa; 7+ haneli rakam dizileri (telefon gibi) silinir. */
function cleanTerm(term: string): string {
  return term.replace(/\d[\d\s]{6,}\d/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function oneLine(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildPromptInput(d: PromptData): string {
  const parts: string[] = [];
  parts.push(`Hafta: ${longDate(d.weekStart)} Pazartesi ile başlayan hafta.`);

  parts.push(
    "Öneri istenen yuvalar:\n" + d.slots.map((s) => `- ${s} (${SLOTS[s].label}): ${SLOT_HINTS[s]}`).join("\n"),
  );

  const info = d.schoolInfo.trim().slice(0, SCHOOL_INFO_MAX);
  parts.push(info ? `<okul_bilgileri>\n${info}\n</okul_bilgileri>` : "Okul bilgileri girilmedi.");

  const topics = d.recentTopics.slice(0, MAX_TOPICS);
  parts.push(
    topics.length > 0
      ? "Son haftalarda verilmiş görevler (tekrar etme):\n" +
          topics.map((t) => `- ${t.weekStart} ${t.code}: ${oneLine(t.topic, 200)}`).join("\n")
      : "Son haftalarda verilmiş görev yok.",
  );

  parts.push(
    d.contentLeads.length > 0
      ? "İçerik koduyla gelen veliler (aday / randevu ve sonrası / kayıt / kayıp):\n" +
          d.contentLeads
            .map((c) => `- ${c.code}${c.topic ? ` (${oneLine(c.topic, 120)})` : ""}: ${c.total} / ${c.randevu} / ${c.kayit} / ${c.kayip}`)
            .join("\n")
      : "İçerik koduyla gelen veli: henüz veri yok.",
  );

  const keywords = d.keywords
    .map((k) => ({ ...k, term: cleanTerm(k.term) }))
    .filter((k) => k.term.length > 0)
    .slice(0, MAX_KEYWORDS);
  parts.push(
    keywords.length > 0
      ? "Google arama kelimeleri (aday / randevu ve sonrası / kayıt):\n" +
          keywords.map((k) => `- ${k.term}: ${k.total} / ${k.randevu} / ${k.kayit}`).join("\n")
      : "Google arama kelimeleri: henüz veri yok.",
  );

  parts.push(
    d.campaigns.length > 0
      ? "Kampanyalar (tıklama / gösterim):\n" +
          d.campaigns.map((c) => `- ${oneLine(c.name, 100)} (${c.platform}): ${c.clicks} / ${c.impressions}`).join("\n")
      : "Kampanyalar: henüz veri yok (reklamlar kapalı olabilir).",
  );

  parts.push(`Yasaklı ifadeler: ${d.banned.map((b) => `"${b}"`).join(", ") || "yok"}.`);
  parts.push("Her yuva için 2-3 konu öner.");
  return parts.join("\n\n");
}
