/**
 * Telefon kurtarma SKORLAMASI — saf fonksiyonlar. Havuzun (pool) dosyalardan
 * yüklenmesi CLI tarafında (parse-aidat.ts) yapılır; burada yalnız eşleştirme mantığı.
 *
 * Skor: soyadı geçiyor +3, her ebeveyn adı +2, çocuk adı +1. >=3 kabul.
 * Güven: >=6 high, 4-5 medium, 3 low. Sohbet bloğu: soyadı VE bir ebeveyn adı aynı
 * blokta geçmeli (aksi halde yanlış numara kapılır).
 */
export function normalizeName(s: string): string {
  // Türkçe aksanlı harfleri ASCII köküne indir — "Ayşe"/"Ayse", "Gökçe"/"Gokce" gibi
  // yazım farklarına dayanıklı eşleşme için (fuzzy telefon kurtarma).
  return String(s ?? "")
    .replace(/İ/g, "I").replace(/ı/g, "I").replace(/i/g, "I")
    .replace(/Ş/g, "S").replace(/ş/g, "S")
    .replace(/Ç/g, "C").replace(/ç/g, "C")
    .replace(/Ğ/g, "G").replace(/ğ/g, "G")
    .replace(/Ö/g, "O").replace(/ö/g, "O")
    .replace(/Ü/g, "U").replace(/ü/g, "U")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function nameTokens(s: string): string[] {
  return normalizeName(s).split(" ").filter((t) => t.length >= 3);
}

export type PoolEntry = { name: string; phone: string; source: string };
export type ChatBlock = { text: string; phones: string[] };
export type Query = { surname: string; first: string; parentTokens: string[] };
export type PhoneMatch = { phone: string; confidence: "high" | "medium" | "low"; source: string };

export function buildQuery(fullName: string, parents: string): Query {
  const t = nameTokens(fullName);
  const parentTokens = parents.split(/[&\-,]/).flatMap((p) => nameTokens(p));
  return { surname: t[t.length - 1] ?? "", first: t[0] ?? "", parentTokens };
}

function confidenceFor(score: number): PhoneMatch["confidence"] {
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export function scorePhone(query: Query, pool: PoolEntry[], chat: ChatBlock[]): PhoneMatch | null {
  const best: Record<string, { score: number; source: string }> = {};
  const consider = (phone: string, score: number, source: string) => {
    if (score < 3) return;
    if (!best[phone] || best[phone].score < score) best[phone] = { score, source };
  };

  for (const e of pool) {
    let sc = 0;
    if (query.surname && e.name.includes(query.surname)) sc += 3;
    for (const p of query.parentTokens) if (p && e.name.includes(p)) sc += 2;
    if (query.first && e.name.includes(query.first)) sc += 1;
    consider(e.phone, sc, e.source);
  }
  for (const b of chat) {
    if (query.surname && b.text.includes(query.surname) && query.parentTokens.some((p) => p && b.text.includes(p))) {
      for (const ph of b.phones) consider(ph, 4, "chat-block");
    }
  }

  const ranked = Object.entries(best).sort((a, b) => b[1].score - a[1].score);
  if (ranked.length === 0) return null;
  const [phone, info] = ranked[0];
  return { phone, confidence: confidenceFor(info.score), source: info.source };
}
