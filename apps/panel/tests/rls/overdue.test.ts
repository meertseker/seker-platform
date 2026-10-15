import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const DAN_ID = "00000000-0000-0000-0000-000000000002";
let dan: SupabaseClient;
let studentWithFamilyPhone: string;
let overdueId: string;
let todayDueId: string;
let paidId: string;
let cancelledId: string;

function istanbulYmd(offsetDays: number) {
  const d = new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  dan = await clientFor("danisman@test.local");

  const { data: family } = await admin
    .from("families")
    .insert({ family_code: `OVD-${Date.now()}`, primary_parent_name: "Gecikme Ailesi", phone: "+905551112233" })
    .select("id")
    .single();

  const { data: student } = await admin
    .from("students")
    .insert({ full_name: "Gecikme Öğrenci", season: "2026-2027", family_id: family!.id, phone: null })
    .select("id")
    .single();
  studentWithFamilyPhone = student!.id;

  const { data: plan } = await admin
    .from("payment_plans")
    .insert({ student_id: student!.id, season: "2026-2027", item_type: "aidat", total_amount: 40000, installment_count: 4 })
    .select("id")
    .single();

  const rows = [
    { plan_id: plan!.id, due_date: istanbulYmd(-10), amount: 10000, status: "bekliyor" },
    { plan_id: plan!.id, due_date: istanbulYmd(0), amount: 10000, status: "bekliyor" },
    {
      plan_id: plan!.id, due_date: istanbulYmd(-40), amount: 10000, status: "odendi",
      paid_at: new Date().toISOString(), paid_amount: 10000, payment_method: "havale", marked_by: DAN_ID,
    },
    { plan_id: plan!.id, due_date: istanbulYmd(-70), amount: 10000, status: "iptal" },
  ];
  const { data: inserted, error } = await admin.from("installments").insert(rows).select("id, due_date, status");
  if (error) throw error;
  [overdueId, todayDueId, paidId, cancelledId] = inserted!.map((r) => r.id);
});

describe("v_overdue_installments", () => {
  it("yalnızca bekleyen ve vadesi geçmiş taksiti, aile telefonu ve gün sayısıyla döner", async () => {
    const { data, error } = await dan
      .from("v_overdue_installments")
      .select("installment_id, student_id, student_name, family_phone, amount, days_overdue, item_type, season")
      .eq("student_id", studentWithFamilyPhone);
    expect(error).toBeNull();
    expect(data).toEqual([
      {
        installment_id: overdueId,
        student_id: studentWithFamilyPhone,
        student_name: "Gecikme Öğrenci",
        family_phone: "+905551112233",
        amount: 10000,
        days_overdue: 10,
        item_type: "aidat",
        season: "2026-2027",
      },
    ]);
  });

  it("bugün vadeli, ödenmiş ve iptal taksitler listede yok", async () => {
    const { data } = await dan.from("v_overdue_installments").select("installment_id").eq("student_id", studentWithFamilyPhone);
    const ids = (data ?? []).map((r) => r.installment_id);
    expect(ids).not.toContain(todayDueId);
    expect(ids).not.toContain(paidId);
    expect(ids).not.toContain(cancelledId);
  });

  it("giriş yapmamış ziyaretçi hiçbir satır göremez", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await anon.from("v_overdue_installments").select("installment_id").limit(1);
    expect(data ?? []).toEqual([]);
    if (error) expect(error.code).toMatch(/42501|PGRST/);
  });
});
