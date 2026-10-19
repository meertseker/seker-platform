"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import type { InstallmentStatus } from "@/lib/constants";
import { logEvent } from "@/lib/events";
import { kurusToTl, tlToKurus } from "@/lib/money";
import { computeIncrease, type IncreasePlanInput, type PlanIncrease } from "@/lib/price-increase";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export interface IncreaseRequest {
  season: string;
  percent: number;
  fromMonth: string;
}

const FORBIDDEN = "Bu işlem için yönetici yetkisi gerekir";
const PLAN_SELECT =
  "id, student_id, tentative_from, total_amount, student:students!inner(full_name, status), installments(id, due_date, amount, status)";

interface PlanRow {
  id: string;
  student_id: string;
  tentative_from: string | null;
  total_amount: string | number;
  student: { full_name: string; status: string } | null;
  installments: { id: string; due_date: string; amount: string | number; status: InstallmentStatus }[] | null;
}

/** "2026-2027" için geçerli aylar: 2026-09 … 2027-06. */
function validFromMonth(season: string, month: string) {
  const match = /^(\d{4})-(\d{4})$/.exec(season);
  if (!match || !/^\d{4}-\d{2}$/.test(month)) return false;
  const start = Number(match[1]);
  const months = [9, 10, 11, 12].map((m) => `${start}-${String(m).padStart(2, "0")}`);
  months.push(...[1, 2, 3, 4, 5, 6].map((m) => `${start + 1}-${String(m).padStart(2, "0")}`));
  return months.includes(month);
}

function validate(req: IncreaseRequest): string | null {
  if (!Number.isFinite(req.percent) || req.percent <= 0 || req.percent > 100) {
    return "Zam oranı 0 ile 100 arasında olmalı";
  }
  if (!validFromMonth(req.season, req.fromMonth)) return "Zam başlangıç ayı sezonun Eylül-Haziran aylarından biri olmalı";
  return null;
}

function toInput(row: PlanRow): IncreasePlanInput {
  return {
    planId: row.id,
    studentId: row.student_id,
    fullName: row.student?.full_name ?? "",
    tentativeFrom: row.tentative_from,
    totalKurus: tlToKurus(Number(row.total_amount)),
    installments: (row.installments ?? []).map((i) => ({
      id: i.id,
      dueDate: i.due_date,
      amountKurus: tlToKurus(Number(i.amount)),
      status: i.status,
    })),
  };
}

/** Yalnızca aidat, bu sezon, kesinleşmemiş ve aktif öğrenci. */
async function loadPlans(season: string, planIds?: string[]): Promise<PlanRow[] | null> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("payment_plans")
    .select(PLAN_SELECT)
    .eq("item_type", "aidat")
    .eq("season", season)
    .not("tentative_from", "is", null)
    .eq("student.status", "aktif");
  if (planIds) query = query.in("id", planIds);
  const { data, error } = await query;
  if (error) return null;
  return ((data ?? []) as unknown as PlanRow[]).filter((r) => r.tentative_from !== null);
}

function refresh() {
  for (const path of ["/odemeler", "/odemeler/zam", "/odemeler/gecikenler", "/bugun", "/ogrenciler"]) {
    revalidatePath(path);
  }
}

export async function previewPriceIncrease(req: IncreaseRequest): Promise<{ error: string } | { plans: PlanIncrease[] }> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: FORBIDDEN };
  const invalid = validate(req);
  if (invalid) return { error: invalid };

  const rows = await loadPlans(req.season);
  if (!rows) return { error: "Planlar okunamadı" };
  const plans = rows
    .map((row) => computeIncrease(toInput(row), req.percent, req.fromMonth))
    .filter((p) => p.changes.length > 0)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
  return { plans };
}

export async function applyPriceIncrease(
  req: IncreaseRequest & { planIds: string[] },
): Promise<{ error: string } | { applied: number; failed: string[] }> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: FORBIDDEN };
  const invalid = validate(req);
  if (invalid) return { error: invalid };
  if (!Array.isArray(req.planIds) || req.planIds.length === 0) return { applied: 0, failed: [] };

  const admin = createAdminSupabase();
  if (!admin) return { error: "Sunucu anahtarı yapılandırılmamış" };
  const rows = await loadPlans(req.season, req.planIds);
  if (!rows) return { error: "Planlar okunamadı" };

  let applied = 0;
  const failed: string[] = [];
  for (const row of rows) {
    const result = computeIncrease(toInput(row), req.percent, req.fromMonth);
    if (result.changes.length === 0) continue;
    const { error } = await admin.rpc("apply_plan_amounts", {
      p_plan_id: row.id,
      p_changes: result.changes.map((c) => ({ id: c.installmentId, amount: kurusToTl(c.toKurus) })),
      p_clear_tentative: true,
    });
    if (error) {
      failed.push(result.fullName);
      continue;
    }
    applied += 1;
    await logEvent(admin, {
      entityType: "student",
      entityId: row.student_id,
      eventType: "zam_uygulandi",
      actorId: profile.id,
      payload: {
        percent: req.percent,
        fromMonth: req.fromMonth,
        changes: result.changes.map((c) => ({ id: c.installmentId, fromTl: kurusToTl(c.fromKurus), toTl: kurusToTl(c.toKurus) })),
        skippedPaidMonths: result.skippedPaidMonths,
      },
    });
  }

  refresh();
  return { applied, failed };
}

export async function finalizeAmounts(planIds: string[]): Promise<{ error: string } | { finalized: number }> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: FORBIDDEN };
  if (!Array.isArray(planIds) || planIds.length === 0) return { finalized: 0 };

  const admin = createAdminSupabase();
  if (!admin) return { error: "Sunucu anahtarı yapılandırılmamış" };
  const { data, error } = await admin
    .from("payment_plans")
    .update({ tentative_from: null })
    .in("id", planIds)
    .eq("item_type", "aidat")
    .not("tentative_from", "is", null)
    .select("id, student_id");
  if (error) return { error: "Tutarlar kesinleştirilemedi" };

  const done = (data ?? []) as { id: string; student_id: string }[];
  for (const row of done) {
    await logEvent(admin, {
      entityType: "student",
      entityId: row.student_id,
      eventType: "tutar_kesinlesti",
      actorId: profile.id,
      payload: { planId: row.id },
    });
  }
  refresh();
  return { finalized: done.length };
}
