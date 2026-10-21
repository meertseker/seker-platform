/**
 * Para tanımları — tek kaynak. Ekranlar (Ödemeler, öğrenci sayfası ve listesi, Bugün,
 * Gecikenler), Rapor ve Pazartesi özeti bu tanımları kullanır; başka yerde yeniden yazılmaz.
 *
 *   tahsilat : status = 'odendi' satırın ödenen tutarı (paid_amount; eski kayıtta boşsa amount),
 *              günü paid_at'in İstanbul takvim günü.
 *   alacak   : status <> 'iptal' satırın tutarı (amount). payment_plans.total_amount ekranlarda
 *              kullanılmaz (iptal edilmiş taksitleri de içerir).
 *   geciken  : status = 'bekliyor' ve vade < İstanbul bugün, yalnız aktif öğrenci
 *              (DB'de v_overdue_installments aynı süzgeçle; 0022).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { istanbulDateString } from "@/lib/lead-flow/business-hours";
import { tlToKurus } from "@/lib/money";

type Tl = number | string | null | undefined;

function kurusOf(value: Tl): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? tlToKurus(n) : 0;
}

/** Tahsilat: ödenmiş satırın ödenen tutarı (kuruş). */
export function collectedKurus(row: { status: string; amount: Tl; paid_amount?: Tl }): number {
  if (row.status !== "odendi") return 0;
  return row.paid_amount === null || row.paid_amount === undefined ? kurusOf(row.amount) : kurusOf(row.paid_amount);
}

/** Tahsilatın günü: paid_at'in İstanbul takvim günü ("YYYY-MM-DD"); ödenmemişse null. */
export function collectedDay(row: { status: string; paid_at?: string | null }): string | null {
  if (row.status !== "odendi" || !row.paid_at) return null;
  const at = new Date(row.paid_at);
  return Number.isNaN(at.getTime()) ? null : istanbulDateString(at);
}

/** Alacak: iptal olmayan satırın tutarı (kuruş). */
export function receivableKurus(row: { status: string; amount: Tl }): number {
  return row.status === "iptal" ? 0 : kurusOf(row.amount);
}

/** Geciken: bekliyor, vadesi İstanbul bugününden önce ve öğrenci aktif. */
export function isOverdue(
  row: { status: string; due_date: string },
  today: string,
  studentStatus: string = "aktif",
): boolean {
  return studentStatus === "aktif" && row.status === "bekliyor" && row.due_date < today;
}

/** Geciken tutar (kuruş); geciken değilse 0. */
export function overdueKurus(
  row: { status: string; due_date: string; amount: Tl },
  today: string,
  studentStatus: string = "aktif",
): number {
  return isOverdue(row, today, studentStatus) ? kurusOf(row.amount) : 0;
}

export function sumKurus<T>(rows: readonly T[], of: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + of(row), 0);
}

/** İstanbul gününün (sabit +03:00) başlangıcı, timestamptz karşılaştırması için UTC ISO. */
export function istanbulDayStartIso(day: string): string {
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}

const PAGE = 1000;

/** Geciken satırlar DB'de bu görünümden okunur (aktif öğrenci süzgeci görünümde). */
export const OVERDUE_VIEW = "v_overdue_installments";

/**
 * [fromDay, toDayExclusive) İstanbul günlerinde tahsil edilen toplam. PostgREST satır sınırında
 * toplam kesilmesin diye sayfa sayfa okunur.
 */
export async function fetchCollectedKurus(
  db: SupabaseClient,
  fromDay: string,
  toDayExclusive: string,
): Promise<{ kurus: number; error: boolean }> {
  let kurus = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("installments")
      .select("id, status, amount, paid_amount")
      .eq("status", "odendi")
      .gte("paid_at", istanbulDayStartIso(fromDay))
      .lt("paid_at", istanbulDayStartIso(toDayExclusive))
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return { kurus, error: true };
    const rows = (data ?? []) as { status: string; amount: Tl; paid_amount: Tl }[];
    kurus += sumKurus(rows, collectedKurus);
    if (rows.length < PAGE) return { kurus, error: false };
  }
}

/** Geciken taksitlerin (aktif öğrenci) sayısı ve toplamı. */
export async function fetchOverdueTotal(db: SupabaseClient): Promise<{ count: number; kurus: number; error: boolean }> {
  let count = 0;
  let kurus = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(OVERDUE_VIEW)
      .select("installment_id, amount")
      .order("installment_id")
      .range(from, from + PAGE - 1);
    if (error) return { count, kurus, error: true };
    const rows = (data ?? []) as { amount: Tl }[];
    count += rows.length;
    kurus += sumKurus(rows, (row) => kurusOf(row.amount));
    if (rows.length < PAGE) return { count, kurus, error: false };
  }
}

/** "YYYY-MM" ayının ilk günü ve sonraki ayın ilk günü (İstanbul günleri). */
export function monthDayRange(monthOrDay: string): { from: string; to: string } {
  const month = monthOrDay.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}
