import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

/**
 * 0022 ödeme Faz 1: correct_payment ("Ödemeyi düzelt"), close_installment_remainder
 * ("Kalanı kapat"), sessiz WhatsApp kuyruğu ve aktif öğrenciye süzülen geciken görünümü.
 */
const DAN_ID = "00000000-0000-0000-0000-000000000002";
let yon: SupabaseClient;
let dan: SupabaseClient;

function istanbulYmd(offsetDays = 0) {
  const d = new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}
const at = (day: string) => `${day}T12:00:00+03:00`;

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
});

async function fixture(amounts: number[] = [15000, 15000, 15000], itemType = "kitap") {
  const { data: student, error: se } = await admin
    .from("students")
    .insert({ full_name: `Ödeme Faz1 ${Date.now()}`, season: "2026-2027", phone: null })
    .select("id")
    .single();
  if (se) throw se;
  const total = amounts.reduce((s, a) => s + a, 0);
  const { data: plan, error: pe } = await admin
    .from("payment_plans")
    .insert({ student_id: student!.id, season: "2026-2027", item_type: itemType, total_amount: total, installment_count: amounts.length })
    .select("id")
    .single();
  if (pe) throw pe;
  const { data: rows, error: ie } = await admin
    .from("installments")
    .insert(amounts.map((amount, i) => ({ plan_id: plan!.id, due_date: `2026-1${i}-05`, amount })))
    .select("id, due_date")
    .order("due_date");
  if (ie) throw ie;
  return { studentId: student!.id as string, planId: plan!.id as string, ids: rows!.map((r) => r.id as string) };
}

async function planRows(planId: string) {
  const { data } = await admin
    .from("installments")
    .select("id, amount, status, due_date, paid_amount, payment_method, paid_at")
    .eq("plan_id", planId)
    .order("due_date")
    .order("amount");
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount), paid_amount: r.paid_amount == null ? null : Number(r.paid_amount) }));
}

async function planTotal(planId: string) {
  const { data } = await admin.from("payment_plans").select("total_amount").eq("id", planId).single();
  return Number(data!.total_amount);
}

async function eventsOf(studentId: string, type: string) {
  const { data } = await admin
    .from("events")
    .select("id, payload")
    .eq("entity_id", studentId)
    .eq("event_type", type)
    .order("created_at");
  return (data ?? []) as { id: string; payload: Record<string, unknown> }[];
}

function pay(
  client: SupabaseClient,
  studentId: string,
  ops: { id: string; amount: number; parts: { amount: number; method: string }[]; remainders?: { dueDate: string; amount: number }[] }[],
  day = istanbulYmd(),
) {
  return client.rpc("take_payment", {
    p_student_id: studentId,
    p_paid_at: at(day),
    p_ops: ops,
    p_payload: { paidOn: day, methods: ["nakit"], note: "ilk kayıt" },
  });
}

function correct(
  client: SupabaseClient,
  installmentId: string,
  ops: { id: string; amount: number; parts: { amount: number; method: string; paidAt?: string }[]; remainders?: { dueDate: string; amount: number }[] }[],
  day = istanbulYmd(),
  note: string | null = null,
) {
  return client.rpc("correct_payment", {
    p_installment_id: installmentId,
    p_paid_at: at(day),
    p_ops: ops,
    p_payload: { paidOn: day, methods: [...new Set(ops.flatMap((o) => o.parts.map((p) => p.method)))], note },
  });
}

describe("correct_payment (Ödemeyi düzelt)", () => {
  it("olaylı ödeme: eski ödeme geri alınır, yeni tutar / yöntem / tarih yazılır, olay önce/sonra özetini taşır", async () => {
    const f = await fixture();
    const first = await pay(yon, f.studentId, [{ id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "nakit" }] }]);
    expect(first.error).toBeNull();
    const firstEvent = (first.data as { eventId: string }).eventId;

    const yesterday = istanbulYmd(-1);
    const { data, error } = await correct(
      yon, f.ids[0], [{ id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "havale" }] }], yesterday, "havaleymiş",
    );
    expect(error).toBeNull();
    const res = data as { studentId: string; eventId: string; correctionEventId: string };
    expect(res.studentId).toBe(f.studentId);

    const row = (await planRows(f.planId)).find((r) => r.id === f.ids[0])!;
    expect(row).toMatchObject({ status: "odendi", amount: 15000, paid_amount: 15000, payment_method: "havale" });
    expect(new Date(row.paid_at!).toISOString()).toBe(new Date(at(yesterday)).toISOString());
    expect(await planTotal(f.planId)).toBe(45000);

    const old = await admin.from("events").select("payload").eq("id", firstEvent).single();
    expect((old.data!.payload as { undone?: boolean }).undone).toBe(true);

    const [corr] = await eventsOf(f.studentId, "odeme_duzeltildi");
    expect(corr.id).toBe(res.correctionEventId);
    expect(corr.payload).toMatchObject({
      installmentId: f.ids[0],
      source: "odeme",
      undoneEventId: firstEvent,
      newEventId: res.eventId,
      before: { totalTl: 15000, parts: [{ amountTl: 15000, method: "nakit", paidOn: istanbulYmd() }] },
      after: { totalTl: 15000, parts: [{ amountTl: 15000, method: "havale", paidOn: yesterday }] },
      remainderTl: 0,
      items: [{ itemType: "kitap", dueDate: "2026-10-05" }],
      note: "havaleymiş",
    });

    // Yeni ödeme de sıradan bir ödeme gibi geri alınabilir.
    const again = await yon.rpc("undo_payment", { p_event_id: res.eventId });
    expect(again.error).toBeNull();
    expect((await planRows(f.planId)).every((r) => r.status === "bekliyor")).toBe(true);
  });

  it("olaysız (içe aktarma) satır: yalnız o satır düzeltilir, tutar artışı yazılabilir", async () => {
    const f = await fixture([14495, 15000]);
    await admin.from("installments").update({
      status: "odendi", paid_at: at(istanbulYmd(-3)), paid_amount: 14495, payment_method: "diger", marked_by: DAN_ID,
    }).eq("id", f.ids[0]);

    // Taksit tutarı 14.495 olduğundan düzeltme bu tutara kadar yazılabilir.
    const { error } = await correct(yon, f.ids[0], [{ id: f.ids[0], amount: 14495, parts: [{ amount: 14495, method: "pos" }] }]);
    expect(error).toBeNull();
    const rows = await planRows(f.planId);
    expect(rows.find((r) => r.id === f.ids[0])).toMatchObject({ status: "odendi", paid_amount: 14495, payment_method: "pos" });
    expect(rows.find((r) => r.id === f.ids[1])).toMatchObject({ status: "bekliyor", amount: 15000 });
    const [corr] = await eventsOf(f.studentId, "odeme_duzeltildi");
    expect(corr.payload).toMatchObject({
      source: "ice_aktarma",
      undoneEventId: null,
      before: { totalTl: 14495, parts: [{ method: "diger", paidOn: istanbulYmd(-3) }] },
      after: { totalTl: 14495, parts: [{ method: "pos" }] },
    });
  });

  it("kısmi düzeltme: ödenen tutar düşer, kalan aynı vadeye bekleyen satır olur, plan toplamı değişmez", async () => {
    const f = await fixture();
    const first = await pay(yon, f.studentId, [{ id: f.ids[1], amount: 15000, parts: [{ amount: 15000, method: "nakit" }] }]);
    expect(first.error).toBeNull();

    const { data, error } = await correct(yon, f.ids[1], [
      { id: f.ids[1], amount: 15000, parts: [{ amount: 14995, method: "nakit" }], remainders: [{ dueDate: "2026-11-05", amount: 5 }] },
    ]);
    expect(error).toBeNull();
    expect(Number((data as { remainderTl: number }).remainderTl)).toBe(5);
    const nov = (await planRows(f.planId)).filter((r) => r.due_date === "2026-11-05");
    expect(nov.map((r) => [r.status, r.amount]).sort()).toEqual([["bekliyor", 5], ["odendi", 14995]]);
    expect(await planTotal(f.planId)).toBe(45000);
    const [corr] = await eventsOf(f.studentId, "odeme_duzeltildi");
    expect(corr.payload).toMatchObject({ before: { totalTl: 15000 }, after: { totalTl: 14995 }, remainderTl: 5 });
  });

  it("iki taksitlik ödeme düzeltilirken yeni tutar ödemenin taksitleri dışına yazılamaz", async () => {
    const f = await fixture();
    const first = await pay(yon, f.studentId, [{ id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "nakit" }] }]);
    expect(first.error).toBeNull();
    const { error } = await correct(yon, f.ids[0], [
      { id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "nakit" }] },
      { id: f.ids[2], amount: 15000, parts: [{ amount: 15000, method: "nakit" }] },
    ]);
    expect(error?.message).toContain("yalnız bu ödemenin taksitlerine");
    expect((await planRows(f.planId)).find((r) => r.id === f.ids[2])!.status).toBe("bekliyor");
    expect((await eventsOf(f.studentId, "odeme_duzeltildi"))).toHaveLength(0);
  });

  it("engellenen düzeltme: kalan sonradan ödendiyse nedeniyle reddedilir, hiçbir şey değişmez", async () => {
    const f = await fixture();
    const first = await pay(yon, f.studentId, [
      { id: f.ids[0], amount: 15000, parts: [{ amount: 10000, method: "nakit" }], remainders: [{ dueDate: "2026-10-05", amount: 5000 }] },
    ]);
    const remainderId = (first.data as { createdIds: string[] }).createdIds[0];
    expect((await pay(yon, f.studentId, [{ id: remainderId, amount: 5000, parts: [{ amount: 5000, method: "nakit" }] }])).error).toBeNull();

    const before = await planRows(f.planId);
    const { error } = await correct(yon, f.ids[0], [{ id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "havale" }] }]);
    expect(error?.message).toContain("düzeltilemez");
    expect(error?.message).toContain("kalan taksit ödendi");
    expect(await planRows(f.planId)).toEqual(before);
  });

  it("danışman düzeltemez; ileri tarih reddedilir", async () => {
    const f = await fixture();
    await pay(yon, f.studentId, [{ id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "nakit" }] }]);
    const byDan = await correct(dan, f.ids[0], [{ id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "havale" }] }]);
    expect(byDan.error?.message).toContain("yalnız yönetici");
    const future = await correct(yon, f.ids[0], [{ id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "havale" }] }], istanbulYmd(2));
    expect(future.error?.message).toContain("ileri olamaz");
    expect((await planRows(f.planId)).find((r) => r.id === f.ids[0])).toMatchObject({ status: "odendi", payment_method: "nakit" });
  });

  it("WhatsApp kuyruğuna yalnız 'odeme_duzeltildi' girer (içteki geri alma ve yeni ödeme sessiz)", async () => {
    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "wa_enabled").maybeSingle();
    await admin.from("app_settings").upsert({ key: "wa_enabled", value: true });
    try {
      const f = await fixture();
      const first = await pay(yon, f.studentId, [{ id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "nakit" }] }]);
      expect(first.error).toBeNull();
      const { error } = await correct(yon, f.ids[0], [{ id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "pos" }] }]);
      expect(error).toBeNull();
      const { data: evs } = await admin.from("events").select("id, event_type").eq("entity_id", f.studentId);
      const { data: outbox } = await admin.from("wa_outbox").select("event_id").in("event_id", (evs ?? []).map((e) => e.id));
      const queued = new Set((outbox ?? []).map((o) => o.event_id));
      const queuedTypes = (evs ?? []).filter((e) => queued.has(e.id)).map((e) => e.event_type).sort();
      expect(queuedTypes).toEqual(["odeme_alindi", "odeme_duzeltildi"]);
      await admin.from("wa_outbox").delete().in("event_id", [...queued]);
    } finally {
      await admin.from("app_settings").upsert({ key: "wa_enabled", value: setting?.value ?? false });
    }
  });
});

describe("close_installment_remainder (Kalanı kapat)", () => {
  it("kalan silinir, plan toplamı aynı tutarda düşer, kalem kapanır, olay yazılır", async () => {
    const f = await fixture([15000, 15000, 15000]);
    // Zehra K. durumu: son taksit 14.995 ödendi, 5 TL kalan.
    const paid = await pay(yon, f.studentId, [
      { id: f.ids[0], amount: 15000, parts: [{ amount: 15000, method: "nakit" }] },
      { id: f.ids[1], amount: 15000, parts: [{ amount: 15000, method: "nakit" }] },
      { id: f.ids[2], amount: 15000, parts: [{ amount: 14995, method: "nakit" }], remainders: [{ dueDate: "2026-12-05", amount: 5 }] },
    ]);
    expect(paid.error).toBeNull();
    const paidEvent = paid.data as { eventId: string; createdIds: string[] };
    const remainderId = paidEvent.createdIds[0];

    const { data, error } = await yon.rpc("close_installment_remainder", { p_installment_id: remainderId, p_reason: "  küsurat " });
    expect(error).toBeNull();
    expect(data).toMatchObject({ studentId: f.studentId, closed: true });
    expect(Number((data as { planTotalTl: number }).planTotalTl)).toBe(44995);

    expect(await planTotal(f.planId)).toBe(44995);
    const rows = await planRows(f.planId);
    expect(rows.some((r) => r.id === remainderId)).toBe(false);
    expect(rows.every((r) => r.status === "odendi")).toBe(true);
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(44995);

    const [ev] = await eventsOf(f.studentId, "kalan_kapatildi");
    expect(ev.payload).toMatchObject({
      installmentId: remainderId, planId: f.planId, itemType: "kitap", dueDate: "2026-12-05",
      amountTl: 5, reason: "küsurat", planTotalBeforeTl: 45000, planTotalAfterTl: 44995, pendingCount: 0, closed: true,
    });

    // Kalanı kapatılan ödeme artık olduğu gibi geri alınamaz; nedeni söylenir.
    const preview = await yon.rpc("preview_installment_revert", { p_installment_id: f.ids[0] });
    expect((preview.data as { blocker: string }).blocker).toBe("kalanı kapatıldı");
  });

  it("neden boşsa reddedilir", async () => {
    const f = await fixture([100, 5]);
    for (const reason of ["", "   ", null]) {
      const { error } = await yon.rpc("close_installment_remainder", { p_installment_id: f.ids[1], p_reason: reason });
      expect(error?.message).toContain("nedenini yazın");
    }
    expect(await planTotal(f.planId)).toBe(105);
  });

  it("danışman reddedilir", async () => {
    const f = await fixture([100, 5]);
    const { error } = await dan.rpc("close_installment_remainder", { p_installment_id: f.ids[1], p_reason: "küsurat" });
    expect(error?.message).toContain("yalnız yönetici");
    expect((await planRows(f.planId))).toHaveLength(2);
  });

  it("ödenmiş taksit ve kalemin tek taksiti kapatılamaz", async () => {
    const f = await fixture([100, 5]);
    await pay(yon, f.studentId, [{ id: f.ids[0], amount: 100, parts: [{ amount: 100, method: "nakit" }] }]);
    const paid = await yon.rpc("close_installment_remainder", { p_installment_id: f.ids[0], p_reason: "indirim" });
    expect(paid.error?.message).toContain("Yalnız bekleyen");

    const single = await fixture([500]);
    const only = await yon.rpc("close_installment_remainder", { p_installment_id: single.ids[0], p_reason: "indirim" });
    expect(only.error?.message).toContain("başka taksiti yok");
    expect(await planTotal(single.planId)).toBe(500);
  });
});

describe("v_overdue_installments yalnız aktif öğrenci", () => {
  it("ayrılan öğrencinin vadesi geçmiş taksiti gecikenlerde görünmez", async () => {
    const f = await fixture([100, 200]);
    await admin.from("installments").update({ due_date: istanbulYmd(-5) }).eq("id", f.ids[0]);
    const seen = async () =>
      ((await yon.from("v_overdue_installments").select("installment_id").eq("student_id", f.studentId)).data ?? []).length;
    expect(await seen()).toBe(1);
    await admin.from("students").update({ status: "ayrildi" }).eq("id", f.studentId);
    expect(await seen()).toBe(0);
  });
});
