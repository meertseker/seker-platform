import { describe, it, expect } from "vitest";
import { clientFor, admin } from "./helpers";

async function setup(tentative: string | null) {
  const { data: student, error: se } = await admin
    .from("students")
    .insert({ full_name: `Zam Öğrenci ${Date.now()}`, season: "2026-2027", phone: null })
    .select("id")
    .single();
  if (se) throw se;
  const { data: plan, error: pe } = await admin
    .from("payment_plans")
    .insert({
      student_id: student!.id, season: "2026-2027", item_type: "aidat",
      total_amount: 66000, installment_count: 3, tentative_from: tentative,
    })
    .select("id")
    .single();
  if (pe) throw pe;
  const rows = [1, 2, 3].map((n) => ({
    plan_id: plan!.id, due_date: `2027-0${n}-05`, amount: 22000, status: "bekliyor",
  }));
  const { data: ins, error: ie } = await admin.from("installments").insert(rows).select("id, due_date").order("due_date");
  if (ie) throw ie;
  return { planId: plan!.id as string, ids: ins!.map((r) => r.id as string) };
}

describe("apply_plan_amounts", () => {
  it("tutarları günceller, toplamı eşitler, tentative_from'u temizler", async () => {
    const { planId, ids } = await setup("2027-01-01");
    const { error } = await admin.rpc("apply_plan_amounts", {
      p_plan_id: planId,
      p_changes: [{ id: ids[1], amount: 27500 }, { id: ids[2], amount: 27500 }],
      p_clear_tentative: true,
    });
    expect(error).toBeNull();
    const { data: plan } = await admin.from("payment_plans").select("total_amount, tentative_from").eq("id", planId).single();
    expect(Number(plan!.total_amount)).toBe(77000);
    expect(plan!.tentative_from).toBeNull();
    const { data: inst } = await admin.from("installments").select("amount").eq("plan_id", planId).order("due_date");
    expect(inst!.map((r) => Number(r.amount))).toEqual([22000, 27500, 27500]);
  });

  it("ödenmiş taksit değiştirilmek istenirse hiçbir şeyi değiştirmez", async () => {
    const { planId, ids } = await setup("2027-01-01");
    await admin.from("installments").update({
      status: "odendi", paid_at: new Date().toISOString(), paid_amount: 22000, payment_method: "havale",
      marked_by: "00000000-0000-0000-0000-000000000002",
    }).eq("id", ids[0]);
    const { error } = await admin.rpc("apply_plan_amounts", {
      p_plan_id: planId,
      p_changes: [{ id: ids[1], amount: 27500 }, { id: ids[0], amount: 27500 }],
      p_clear_tentative: true,
    });
    expect(error).not.toBeNull();
    const { data: plan } = await admin.from("payment_plans").select("total_amount, tentative_from").eq("id", planId).single();
    expect(Number(plan!.total_amount)).toBe(66000);
    expect(plan!.tentative_from).toBe("2027-01-01");
    const { data: inst } = await admin.from("installments").select("amount").eq("plan_id", planId).order("due_date");
    expect(inst!.map((r) => Number(r.amount))).toEqual([22000, 22000, 22000]);
  });

  it("iptal taksitin tutarı da yeniden hesaplanan toplama dahildir", async () => {
    const { planId, ids } = await setup(null);
    await admin.from("installments").update({ status: "iptal" }).eq("id", ids[0]);
    const { error } = await admin.rpc("apply_plan_amounts", {
      p_plan_id: planId, p_changes: [{ id: ids[1], amount: 27500 }], p_clear_tentative: false,
    });
    expect(error).toBeNull();
    const { data: plan } = await admin.from("payment_plans").select("total_amount").eq("id", planId).single();
    expect(Number(plan!.total_amount)).toBe(22000 + 27500 + 22000);
  });

  it("danışman ve yönetici oturumu RPC'yi çağıramaz", async () => {
    const { planId, ids } = await setup(null);
    for (const email of ["danisman@test.local", "yonetici@test.local"]) {
      const c = await clientFor(email);
      const { error } = await c.rpc("apply_plan_amounts", {
        p_plan_id: planId, p_changes: [{ id: ids[1], amount: 1 }], p_clear_tentative: false,
      });
      expect(error).not.toBeNull();
    }
    const { data: inst } = await admin.from("installments").select("amount").eq("id", ids[1]).single();
    expect(Number(inst!.amount)).toBe(22000);
  });
});
