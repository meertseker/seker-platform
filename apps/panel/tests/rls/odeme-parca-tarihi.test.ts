import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

/**
 * 0021: "İki yöntemle" ödemede her parçanın kendi tarihi. take_payment
 * parts[].paidAt'i satırın paid_at'ine ve olayın "paid" listesine yazar;
 * her parçanın tarihi ayrı ayrı "bugünden ileri olamaz" denetiminden geçer.
 */
let dan: SupabaseClient;

function istanbulYmd(offsetDays = 0) {
  const d = new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}
const at = (ymd: string) => `${ymd}T12:00:00+03:00`;
const ymdOf = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3600000).toISOString().slice(0, 10);

beforeAll(async () => {
  dan = await clientFor("danisman@test.local");
});

async function fixture(amount = 19000) {
  const { data: student, error: se } = await admin
    .from("students")
    .insert({ full_name: `Parça Tarihi ${Date.now()}`, season: "2026-2027", phone: null })
    .select("id")
    .single();
  if (se) throw se;
  const { data: plan, error: pe } = await admin
    .from("payment_plans")
    .insert({ student_id: student!.id, season: "2026-2027", item_type: "kitap", total_amount: amount, installment_count: 1 })
    .select("id")
    .single();
  if (pe) throw pe;
  const { data: row, error: ie } = await admin
    .from("installments")
    .insert({ plan_id: plan!.id, due_date: "2026-10-05", amount })
    .select("id")
    .single();
  if (ie) throw ie;
  return { studentId: student!.id as string, planId: plan!.id as string, id: row!.id as string };
}

describe("take_payment parça tarihi (0021)", () => {
  it("her parça kendi tarihiyle yazılır; olay parçaların tarihini taşır", async () => {
    const f = await fixture();
    const first = istanbulYmd(-2);
    const second = istanbulYmd(0);
    const { data, error } = await dan.rpc("take_payment", {
      p_student_id: f.studentId,
      p_paid_at: at(first),
      p_ops: [
        {
          id: f.id,
          amount: 19000,
          parts: [
            { amount: 4000, method: "nakit", paidAt: at(first) },
            { amount: 15000, method: "pos", paidAt: at(second) },
          ],
        },
      ],
      p_payload: { paidOn: first, methods: ["nakit", "pos"] },
    });
    expect(error).toBeNull();

    const { data: rows } = await admin
      .from("installments")
      .select("amount, status, paid_at, payment_method")
      .eq("plan_id", f.planId)
      .order("amount");
    expect(rows!.map((r) => [Number(r.amount), r.status, r.payment_method, ymdOf(r.paid_at as string)])).toEqual([
      [4000, "odendi", "nakit", first],
      [15000, "odendi", "pos", second],
    ]);

    const { data: ev } = await admin.from("events").select("payload").eq("id", (data as { eventId: string }).eventId).single();
    const paid = (ev!.payload as { paid: { amount: number; method: string; paidAt: string }[] }).paid;
    expect(paid.map((p) => [Number(p.amount), p.method, ymdOf(p.paidAt)])).toEqual([
      [4000, "nakit", first],
      [15000, "pos", second],
    ]);
  });

  it("paidAt verilmeyen parça p_paid_at'i kullanır (eski istemci)", async () => {
    const f = await fixture();
    const day = istanbulYmd(-1);
    const { error } = await dan.rpc("take_payment", {
      p_student_id: f.studentId,
      p_paid_at: at(day),
      p_ops: [{ id: f.id, amount: 19000, parts: [{ amount: 19000, method: "havale" }] }],
      p_payload: {},
    });
    expect(error).toBeNull();
    const { data: row } = await admin.from("installments").select("paid_at").eq("id", f.id).single();
    expect(ymdOf(row!.paid_at as string)).toBe(day);
  });

  it("ileri tarihli parça reddedilir, hiçbir satır değişmez", async () => {
    const f = await fixture();
    const { error } = await dan.rpc("take_payment", {
      p_student_id: f.studentId,
      p_paid_at: at(istanbulYmd()),
      p_ops: [
        {
          id: f.id,
          amount: 19000,
          parts: [
            { amount: 4000, method: "nakit", paidAt: at(istanbulYmd()) },
            { amount: 15000, method: "pos", paidAt: at(istanbulYmd(2)) },
          ],
        },
      ],
      p_payload: {},
    });
    expect(error?.message).toContain("ileri olamaz");
    const { data: rows } = await admin.from("installments").select("status").eq("plan_id", f.planId);
    expect(rows!.map((r) => r.status)).toEqual(["bekliyor"]);
  });

  it("geçersiz parça tarihi anlaşılır hata verir", async () => {
    const f = await fixture();
    const { error } = await dan.rpc("take_payment", {
      p_student_id: f.studentId,
      p_paid_at: at(istanbulYmd()),
      p_ops: [{ id: f.id, amount: 19000, parts: [{ amount: 19000, method: "nakit", paidAt: "yarın" }] }],
      p_payload: {},
    });
    expect(error?.message).toContain("Geçerli bir ödeme tarihi");
  });
});
