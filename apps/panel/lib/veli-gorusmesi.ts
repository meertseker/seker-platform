/**
 * Borç takibi: veli görüşmesi ve ödeme sözü kuralları (saf). Ekranlar (öğrenci sayfası, Gecikenler),
 * WhatsApp mesajı ve /api/cron/daily ödeme sözü görevi bu tanımları kullanır.
 */
import { collectedDay, collectedKurus, sumKurus } from "@/lib/queries/money";
import { tlToKurus } from "@/lib/money";

export const CONTACT_WITH = {
  anne: "Anne", baba: "Baba", diger_veli: "Diğer veli", diger: "Diğer",
} as const;
export type ContactWith = keyof typeof CONTACT_WITH;

export const CALL_OUTCOMES = {
  ulasilamadi: "Ulaşılamadı", ulasildi: "Ulaşıldı", soz_verdi: "Söz verdi", odeme_yapti: "Ödeme yaptı",
} as const;
export type CallOutcome = keyof typeof CALL_OUTCOMES;

/** Not üst sınırı (DB check ile aynı). */
export const NOTE_MAX = 4000;

/** Ödeme sözü görevinin rule_key öneki: 'odeme_sozu:<gorusme_id>'. */
export const PROMISE_RULE_PREFIX = "odeme_sozu";

export function promiseRuleKey(gorusmeId: string): string {
  return `${PROMISE_RULE_PREFIX}:${gorusmeId}`;
}

export function isPromiseRuleKey(ruleKey: string | null | undefined): boolean {
  return !!ruleKey && ruleKey.startsWith(`${PROMISE_RULE_PREFIX}:`);
}

export interface GorusmeRow {
  id: string;
  student_id: string;
  author_id: string;
  contacted_at: string;
  created_at: string;
  contact_with: ContactWith;
  outcome: CallOutcome;
  note: string | null;
  promise_date: string | null;
  promise_amount: number | string | null;
}

function newerFirst(a: Pick<GorusmeRow, "contacted_at" | "created_at">, b: Pick<GorusmeRow, "contacted_at" | "created_at">) {
  return Date.parse(b.contacted_at) - Date.parse(a.contacted_at) || Date.parse(b.created_at) - Date.parse(a.created_at);
}

/** Öğrenci başına en son görüşme (görüşme anına göre; eşitse son eklenen). */
export function latestByStudent<T extends GorusmeRow>(rows: readonly T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const row of [...rows].sort(newerFirst)) {
    if (!out.has(row.student_id)) out.set(row.student_id, row);
  }
  return out;
}

/**
 * Açık söz: öğrencinin EN SON görüşmesi "söz verdi" ise o söz. Sonraki bir görüşme (yeni söz,
 * ulaşılamadı, ödeme yaptı) eski sözü kapatır.
 */
export function openPromises<T extends GorusmeRow>(rows: readonly T[]): T[] {
  return [...latestByStudent(rows).values()].filter((row) => row.outcome === "soz_verdi" && !!row.promise_date);
}

export interface PromiseInstallment {
  status: string;
  due_date: string;
  amount: number | string;
  paid_amount?: number | string | null;
  paid_at?: string | null;
}

/** "YYYY-MM-DD" İstanbul günü (görüşme anı). */
function istanbulDay(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}

/**
 * Söz tutuldu mu? Tutar verildiyse görüşme gününden bu yana o kadar tahsilat yapılmış olmalı;
 * verilmediyse söz tarihine kadar vadesi gelen bekleyen taksit kalmamalı.
 */
export function promiseKept(
  promise: Pick<GorusmeRow, "contacted_at" | "promise_date" | "promise_amount">,
  installments: readonly PromiseInstallment[],
): boolean {
  const amount = promise.promise_amount === null || promise.promise_amount === "" ? null : Number(promise.promise_amount);
  if (amount !== null && Number.isFinite(amount) && amount > 0) {
    const since = istanbulDay(promise.contacted_at);
    const paid = sumKurus(
      installments.filter((row) => (collectedDay(row) ?? "") >= since),
      collectedKurus,
    );
    return paid >= tlToKurus(amount);
  }
  const by = promise.promise_date ?? "";
  return !installments.some((row) => row.status === "bekliyor" && row.due_date <= by);
}

/** Gecikenler kartı: sözün durumu. "gecti" söz günü geçmiş, "bugun" bugün, "ileride" henüz gelmedi. */
export type PromiseState = "gecti" | "bugun" | "ileride";

export function promiseState(promiseDate: string, today: string): PromiseState {
  if (promiseDate < today) return "gecti";
  return promiseDate === today ? "bugun" : "ileride";
}

const dayMonthFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

/** "2026-11-30" → "30 Kasım". */
export function promiseDayLabel(day: string): string {
  return dayMonthFormatter.format(new Date(`${day}T12:00:00+03:00`));
}

/** Ödeme sözü görevinin başlığı: "Aziz Mirza Eryener: 30 Kasım ödeme sözü — ödeme geldi mi?" */
export function promiseTaskTitle(studentName: string, promiseDate: string): string {
  return `${studentName}: ${promiseDayLabel(promiseDate)} ödeme sözü — ödeme geldi mi?`;
}

/**
 * Formdaki "YYYY-MM-DDTHH:MM" (İstanbul, sabit +03:00) → ISO. Geçersizse null.
 * Gelecekteki görüşme kaydedilmez (5 dk saat farkı payı).
 */
export function parseContactedAt(value: string, now: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const at = new Date(`${value}:00+03:00`);
  if (Number.isNaN(at.getTime())) return null;
  if (at.getTime() > now.getTime() + 5 * 60_000) return null;
  return at.toISOString();
}

/** Formun varsayılan anı: şimdi, İstanbul saatiyle "YYYY-MM-DDTHH:MM". */
export function contactedAtInputValue(now: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now);
  return parts.replace(" ", "T");
}

export interface GorusmeInput {
  contactWith: string;
  outcome: string;
  note: string;
  contactedAt: string;
  promiseDate?: string | null;
  promiseAmountTl?: number | null;
}

export interface GorusmeRecord {
  contact_with: ContactWith;
  outcome: CallOutcome;
  note: string | null;
  contacted_at: string;
  promise_date: string | null;
  promise_amount: number | null;
}

/** Saf: formu DB satırına çevirir ya da kullanıcıya gösterilecek hatayı döner. */
export function validateGorusmeInput(input: GorusmeInput, now: Date): { record: GorusmeRecord } | { error: string } {
  if (!(input.contactWith in CONTACT_WITH)) return { error: "Kiminle görüşüldüğünü seçin" };
  if (!(input.outcome in CALL_OUTCOMES)) return { error: "Görüşmenin sonucunu seçin" };
  const contactedAt = parseContactedAt(input.contactedAt, now);
  if (!contactedAt) return { error: "Geçerli bir görüşme tarihi girin (ileri tarih olamaz)" };
  const note = input.note.trim();
  if (note.length > NOTE_MAX) return { error: `Not en çok ${NOTE_MAX} karakter olabilir` };

  const outcome = input.outcome as CallOutcome;
  let promiseDate: string | null = null;
  let promiseAmount: number | null = null;
  if (outcome === "soz_verdi") {
    promiseDate = input.promiseDate?.trim() || null;
    if (!promiseDate || !/^\d{4}-\d{2}-\d{2}$/.test(promiseDate)) return { error: "Söz verilen ödeme tarihini girin" };
    if (promiseDate < istanbulDay(contactedAt)) return { error: "Söz tarihi görüşme tarihinden önce olamaz" };
    if (input.promiseAmountTl !== null && input.promiseAmountTl !== undefined) {
      if (!Number.isFinite(input.promiseAmountTl) || input.promiseAmountTl <= 0) return { error: "Söz tutarı 0'dan büyük olmalı" };
      promiseAmount = Math.round(input.promiseAmountTl * 100) / 100;
    }
  }
  return {
    record: {
      contact_with: input.contactWith as ContactWith,
      outcome,
      note: note || null,
      contacted_at: contactedAt,
      promise_date: promiseDate,
      promise_amount: promiseAmount,
    },
  };
}

/**
 * Gecikenler sırası: söz günü gelmiş ya da geçmiş olanlar en üstte (en eski söz önce);
 * geri kalanların sırası korunur.
 */
export function duePromisesFirst<T>(list: readonly T[], promiseDateOf: (item: T) => string | null, today: string): T[] {
  const due = list
    .map((item, index) => ({ item, index, date: promiseDateOf(item) }))
    .filter((entry) => entry.date !== null && entry.date <= today)
    .sort((a, b) => a.date!.localeCompare(b.date!) || a.index - b.index);
  const dueSet = new Set(due.map((entry) => entry.index));
  return [...due.map((entry) => entry.item), ...list.filter((_, index) => !dueSet.has(index))];
}
