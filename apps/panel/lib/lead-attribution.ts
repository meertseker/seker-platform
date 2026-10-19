import { ageFromBirth } from "@/lib/lead-flow/age";
import { label, LEAD_SOURCES, START_WINDOWS } from "@/lib/constants";

export type LeadAttribution = {
  gclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_path: string | null;
};

export function attributionLines(lead: LeadAttribution): string[] {
  const lines: string[] = [];
  if (lead.utm_campaign) lines.push(`Kampanya: ${lead.utm_campaign}`);
  if (lead.utm_source) {
    lines.push(`Kaynak: ${lead.utm_medium ? `${lead.utm_source} / ${lead.utm_medium}` : lead.utm_source}`);
  }
  if (lead.landing_path) lines.push(`İniş sayfası: ${lead.landing_path}`);
  if (lead.gclid) lines.push("Google Ads tıklaması (dönüşüm geri bildirilebilir)");
  return lines;
}

export type LeadOrigin = {
  channel: string | null;
  content_code: string | null;
  source: string;
  gclid: string | null;
  landing_path: string | null;
  district: string | null;
  start_window: string | null;
  child_birth_month: number | null;
  child_birth_year: number | null;
  wants_whatsapp: boolean | null;
};

const CHANNEL_LABELS: Record<string, string> = {
  form: "Sayfa formu",
  ig_dm: "Instagram mesajı",
  ig_yorum: "Instagram yorumu",
  whatsapp: "WhatsApp",
  telefon: "Telefon",
};

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "Nereden geldi" kartı: kanal, içerik kodu (K5: R- Reels, S- sayfa) ve formdaki cevaplar. */
export function originLines(
  lead: LeadOrigin,
  now: Date = new Date(),
): { channelLabel: string; codeLabel: string | null; answers: string[] } {
  const channelLabel = lead.gclid
    ? lead.landing_path ? `Google · ${lead.landing_path}` : "Google"
    : (lead.channel && Object.hasOwn(CHANNEL_LABELS, lead.channel) ? CHANNEL_LABELS[lead.channel] : null) ??
      label(LEAD_SOURCES, lead.source);

  const code = lead.content_code?.trim() || null;
  const codeLabel = code
    ? code.startsWith("R-") ? `${code} · Reels` : code.startsWith("S-") ? `${code} · sayfa` : code
    : null;

  const answers: string[] = [];
  const age = ageFromBirth(lead.child_birth_month, lead.child_birth_year, now);
  if (age !== null) answers.push(`${age} yaş (${MONTHS[lead.child_birth_month! - 1]} ${lead.child_birth_year})`);
  if (lead.district) answers.push(lead.district);
  if (lead.start_window && Object.hasOwn(START_WINDOWS, lead.start_window)) {
    answers.push(START_WINDOWS[lead.start_window as keyof typeof START_WINDOWS]);
  }
  if (lead.wants_whatsapp) answers.push("\"WhatsApp'tan yazın\"");
  return { channelLabel, codeLabel, answers };
}
