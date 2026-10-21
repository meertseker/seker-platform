import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

/**
 * 0019 ödeme korumaları: take_payment / undo_payment / revert_installment_payment /
 * reschedule_installments RPC'leri ve installments tetikleyicileri.
 */
const DAN_ID = "00000000-0000-0000-0000-000000000002";
let yon: SupabaseClient;
let dan: SupabaseClient;
let dan2: SupabaseClient;

function istanbulYmd(offsetDays = 0) {
  const d = new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}
const paidAt = () => `${istanbulYmd()}T12:00:00+03:00`;

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
  dan2 = await clientFor("danisman2@test.local");
});

async function fixture(amounts: number[] = [14495, 14495, 14495]) {
  const { data: student, error: se } = await admin
    .from("students")
    .insert({ full_name: `Ödeme Koruma ${Date.now()}`, season: "2026-2027", phone: null })
    .select("id")
    .single();
  if (se) throw se;
  const total = amounts.reduce((s, a) => s + a, 0);
  const { data: plan, error: pe } = await admin
    .from("payment_plans")
    .insert({ student_id: student!.id, season: "2026-2027", item_type: "kitap", total_amount: total, installment_count: amounts.length })
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
    .select("id, amount, status, due_date")
    .eq("plan_id", planId)
    .order("due_date")
    .order("amount");
  return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
}

async function event(id: string) {
  const { data } = await admin.from("events").select("payload").eq("id", id).single();
  return data!.payload as Record<string, unknown>;
}

function pay(
  client: SupabaseClient,
  studentId: string,
  ops: { id: string; amount: number; parts: { amount: number; method: string }[]; remainders?: { dueDate: string; amount: number }[] }[],
) {
  return client.rpc("take_payment", {
    p_student_id: studentId,
    p_paid_at: paidAt(),
    p_ops: ops,
    p_payload: { paidOn: istanbulYmd(), methods: ["nakit"] },
  });
}

describe("take_payment", () => {
  it("kısmi ödeme: taksit ödenen tutara iner, kalan yeni satır olur, olay ödenen/oluşanı yazar", async () => {
    const f = await fixture();
    const { data, error } = await pay(dan, f.studentId, [
      { id: f.ids[0], amount: 14495, parts: [{ amount: 10000, method: "nakit" }], remainders: [{ dueDate: "2026-10-05", amount: 4495 }] },
    ]);
    expect(error).toBeNull();
    const res = data as { eventId: string; createdIds: string[]; totalTl: number };
    expect(Number(res.totalTl)).toBe(10000);
    const rows = await planRows(f.planId);
    expect(rows.filter((r) => r.status === "odendi").map((r) => r.amount)).toEqual([10000]);
    expect(rows.filter((r) => r.status === "bekliyor").map((r) => r.amount).sort()).toEqual([14495, 14495, 4495].sort());
    const payload = await event(res.eventId);
    expect(payload.paidIds).toEqual([f.ids[0]]);
    expect(payload.createdIds).toEqual(res.createdIds);
  });

  it("eşzamanlı ikinci ödeme reddedilir", async () => {
    const f = await fixture();
    const op = [{ id: f.ids[1], amount: 14495, parts: [{ amount: 14495, method: "havale" }] }];
    const [a, b] = await Promise.all([pay(dan, f.studentId, op), pay(dan2, f.studentId, op)]);
    const errors = [a.error, b.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("az önce başka biri tarafından ödendi");
    const { count } = await admin.from("events").select("id", { count: "exact", head: true })
      .eq("event_type", "odeme_alindi").eq("entity_id", f.studentId);
    expect(count).toBe(1);
  });

  it("ödeme + kalan toplamı taksit tutarını tutmazsa reddedilir", async () => {
    const f = await fixture();
    const { error } = await pay(dan, f.studentId, [
      { id: f.ids[0], amount: 14495, parts: [{ amount: 10000, method: "nakit" }], remainders: [{ dueDate: "2026-10-05", amount: 1 }] },
    ]);
    expect(error).not.toBeNull();
    expect((await planRows(f.planId)).every((r) => r.status === "bekliyor")).toBe(true);
  });

  it("ileri tarihli ödeme reddedilir", async () => {
    const f = await fixture();
    const { error } = await dan.rpc("take_payment", {
      p_student_id: f.studentId,
      p_paid_at: `${istanbulYmd(2)}T12:00:00+03:00`,
      p_ops: [{ id: f.ids[0], amount: 14495, parts: [{ amount: 14495, method: "nakit" }] }],
      p_payload: {},
    });
    expect(error?.message).toContain("ileri olamaz");
  });

  it("istemci olaya geri alma işareti yazamaz", async () => {
    const f = await fixture();
    const { data, error } = await dan.rpc("take_payment", {
      p_student_id: f.studentId,
      p_paid_at: paidAt(),
      p_ops: [{ id: f.ids[0], amount: 14495, parts: [{ amount: 14495, method: "nakit" }] }],
      p_payload: { undone: true, undoBlocked: "x", paidIds: ["sahte"] },
    });
    expect(error).toBeNull();
    const payload = await event((data as { eventId: string }).eventId);
    expect(payload.undone).toBeUndefined();
    expect(payload.undoBlocked).toBeUndefined();
    expect(payload.paidIds).toEqual([f.ids[0]]);
  });

  it("anon çağıramaz", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { error } = await anon.rpc("take_payment", { p_student_id: DAN_ID, p_paid_at: paidAt(), p_ops: [], p_payload: {} });
    expect(error).not.toBeNull();
  });
});

describe("tablodan Geri al (revert_installment_payment)", () => {
  it("kısmi ödeme sonrası: tutar eski hâline döner, kalan silinir, olay undone", async () => {
    const f = await fixture();
    const { data } = await pay(dan, f.studentId, [
      { id: f.ids[0], amount: 14495, parts: [{ amount: 10000, method: "nakit" }], remainders: [{ dueDate: "2026-10-05", amount: 4495 }] },
    ]);
    const eventId = (data as { eventId: string }).eventId;

    const preview = await yon.rpc("preview_installment_revert", { p_installment_id: f.ids[0] });
    expect(preview.error).toBeNull();
    expect(preview.data).toMatchObject({ kind: "odeme", eventId, totalTl: 10000, installmentCount: 1, blocker: null, allowed: true });

    const { error } = await yon.rpc("revert_installment_payment", { p_installment_id: f.ids[0] });
    expect(error).toBeNull();
    const rows = await planRows(f.planId);
    expect(rows.map((r) => [r.amount, r.status])).toEqual([
      [14495, "bekliyor"], [14495, "bekliyor"], [14495, "bekliyor"],
    ]);
    expect((await event(eventId)).undone).toBe(true);
    const { data: undoEv } = await admin.from("events").select("payload")
      .eq("event_type", "odeme_geri_alindi").eq("entity_id", f.studentId).single();
    expect(undoEv!.payload).toMatchObject({ eventId, totalTl: 10000 });
  });

  it("iki taksitlik ödeme: tek taksitten geri al, ödemenin tamamını geri alır", async () => {
    const f = await fixture();
    const { data } = await pay(yon, f.studentId, [
      { id: f.ids[0], amount: 14495, parts: [{ amount: 14495, method: "havale" }] },
      { id: f.ids[1], amount: 14495, parts: [{ amount: 14495, method: "havale" }] },
    ]);
    const preview = await yon.rpc("preview_installment_revert", { p_installment_id: f.ids[1] });
    expect(preview.data).toMatchObject({ kind: "odeme", totalTl: 28990, installmentCount: 2 });
    const { error } = await yon.rpc("revert_installment_payment", { p_installment_id: f.ids[1] });
    expect(error).toBeNull();
    expect((await planRows(f.planId)).every((r) => r.status === "bekliyor")).toBe(true);
    expect((await event((data as { eventId: string }).eventId)).undone).toBe(true);
  });

  it("kalan ödendikten sonra ilk ödemeyi geri almak reddedilir", async () => {
    const f = await fixture();
    const first = await pay(dan, f.studentId, [
      { id: f.ids[0], amount: 14495, parts: [{ amount: 10000, method: "nakit" }], remainders: [{ dueDate: "2026-10-05", amount: 4495 }] },
    ]);
    const remainderId = (first.data as { createdIds: string[] }).createdIds[0];
    const second = await pay(dan, f.studentId, [{ id: remainderId, amount: 4495, parts: [{ amount: 4495, method: "nakit" }] }]);
    expect(second.error).toBeNull();

    const { error } = await yon.rpc("revert_installment_payment", { p_installment_id: f.ids[0] });
    expect(error?.message).toContain("Bu ödemeden sonra başka işlem yapılmış (kalan taksit ödendi)");
    expect(error?.message).toContain("Önce sonraki işlemi geri alın");
    const rows = await planRows(f.planId);
    expect(rows.filter((r) => r.status === "odendi").map((r) => r.amount).sort()).toEqual([10000, 4495].sort());

    // Sonraki ödeme önce geri alınırsa ilki de geri alınabilir.
    expect((await yon.rpc("revert_installment_payment", { p_installment_id: remainderId })).error).toBeNull();
    expect((await yon.rpc("revert_installment_payment", { p_installment_id: f.ids[0] })).error).toBeNull();
    expect((await planRows(f.planId)).map((r) => r.amount)).toEqual([14495, 14495, 14495]);
  });

  it("iki yöntemli ödemenin ek ödenmiş satırı da geri alınır (silme koruması RPC'de aşılır)", async () => {
    const f = await fixture();
    const { data, error } = await pay(dan, f.studentId, [
      { id: f.ids[0], amount: 14495, parts: [{ amount: 10000, method: "nakit" }, { amount: 4495, method: "pos" }] },
    ]);
    expect(error).toBeNull();
    expect((data as { createdIds: string[] }).createdIds).toHaveLength(1);
    expect((await yon.rpc("revert_installment_payment", { p_installment_id: f.ids[0] })).error).toBeNull();
    expect((await planRows(f.planId)).map((r) => [r.amount, r.status])).toEqual([
      [14495, "bekliyor"], [14495, "bekliyor"], [14495, "bekliyor"],
    ]);
  });

  it("olaysız (içe aktarma) ödenmiş satır: yalnız durum geri alınır ve olay yazılır", async () => {
    const f = await fixture();
    await admin.from("installments").update({
      status: "odendi", paid_at: paidAt(), paid_amount: 14495, payment_method: "diger", marked_by: DAN_ID,
    }).eq("id", f.ids[2]);

    const preview = await yon.rpc("preview_installment_revert", { p_installment_id: f.ids[2] });
    expect(preview.data).toMatchObject({ kind: "ice_aktarma", totalTl: 14495, installmentCount: 1, blocker: null });

    // Danışman olaysız satırı geri alamaz.
    expect((await dan.rpc("revert_installment_payment", { p_installment_id: f.ids[2] })).error).not.toBeNull();

    expect((await yon.rpc("revert_installment_payment", { p_installment_id: f.ids[2] })).error).toBeNull();
    const rows = await planRows(f.planId);
    expect(rows.find((r) => r.id === f.ids[2])).toMatchObject({ status: "bekliyor", amount: 14495 });
    const { data: ev } = await admin.from("events").select("payload")
      .eq("event_type", "odeme_geri_alindi").eq("entity_id", f.studentId).single();
    expect(ev!.payload).toMatchObject({ installmentId: f.ids[2], amountTl: 14495, method: "diger", source: "ice_aktarma" });
  });

  it("danışman kendi ödemesini 15 dk içinde geri alabilir, başkasınınkini alamaz", async () => {
    const f = await fixture();
    const own = await pay(dan, f.studentId, [{ id: f.ids[0], amount: 14495, parts: [{ amount: 14495, method: "nakit" }] }]);
    const other = await pay(dan2, f.studentId, [{ id: f.ids[1], amount: 14495, parts: [{ amount: 14495, method: "nakit" }] }]);
    expect((await dan.rpc("undo_payment", { p_event_id: (other.data as { eventId: string }).eventId })).error?.message)
      .toContain("yalnız yönetici");
    expect((await dan.rpc("undo_payment", { p_event_id: (own.data as { eventId: string }).eventId })).error).toBeNull();
    // İkinci kez geri alınamaz.
    expect((await dan.rpc("undo_payment", { p_event_id: (own.data as { eventId: string }).eventId })).error?.message)
      .toContain("zaten geri alındı");
  });
});

describe("reschedule_installments", () => {
  it("kalan taksitlendirilince ödemenin geri alınması yeni satırları siler, plan şişmez", async () => {
    const f = await fixture();
    const first = await pay(dan, f.studentId, [
      { id: f.ids[0], amount: 14495, parts: [{ amount: 10000, method: "nakit" }], remainders: [{ dueDate: "2026-10-05", amount: 4495 }] },
    ]);
    const { eventId, createdIds } = first.data as { eventId: string; createdIds: string[] };
    const { data, error } = await dan.rpc("reschedule_installments", {
      p_ids: createdIds,
      p_drafts: [{ dueDate: "2026-11-05", amount: 2247.5 }, { dueDate: "2026-12-05", amount: 2247.5 }],
    });
    expect(error).toBeNull();
    const newIds = (data as { createdIds: string[] }).createdIds;
    expect((await event(eventId)).createdIds).toEqual(newIds);

    expect((await yon.rpc("revert_installment_payment", { p_installment_id: f.ids[0] })).error).toBeNull();
    const rows = await planRows(f.planId);
    expect(rows.map((r) => [r.amount, r.status])).toEqual([
      [14495, "bekliyor"], [14495, "bekliyor"], [14495, "bekliyor"],
    ]);
  });

  it("kalan başka taksitlerle birleştirilirse ödemenin geri alınması kilitlenir", async () => {
    const f = await fixture();
    const first = await pay(dan, f.studentId, [
      { id: f.ids[0], amount: 14495, parts: [{ amount: 10000, method: "nakit" }], remainders: [{ dueDate: "2026-10-05", amount: 4495 }] },
    ]);
    const { eventId, createdIds } = first.data as { eventId: string; createdIds: string[] };
    const { error } = await yon.rpc("reschedule_installments", {
      p_ids: [createdIds[0], f.ids[1]],
      p_drafts: [{ dueDate: "2026-11-05", amount: 9495 }, { dueDate: "2026-12-05", amount: 9495 }],
    });
    expect(error).toBeNull();
    expect((await event(eventId)).undoBlocked).toBeTruthy();
    const res = await yon.rpc("revert_installment_payment", { p_installment_id: f.ids[0] });
    expect(res.error?.message).toContain("yeniden düzenlendi");
  });

  it("ödenmiş taksit taksitlendirilemez; toplam tutmazsa hiçbir şey değişmez", async () => {
    const f = await fixture();
    await pay(dan, f.studentId, [{ id: f.ids[0], amount: 14495, parts: [{ amount: 14495, method: "nakit" }] }]);
    const paid = await dan.rpc("reschedule_installments", {
      p_ids: [f.ids[0]], p_drafts: [{ dueDate: "2026-12-05", amount: 14495 }],
    });
    expect(paid.error).not.toBeNull();
    const wrong = await dan.rpc("reschedule_installments", {
      p_ids: [f.ids[1]], p_drafts: [{ dueDate: "2026-12-05", amount: 100 }],
    });
    expect(wrong.error).not.toBeNull();
    expect((await planRows(f.planId)).map((r) => r.amount)).toEqual([14495, 14495, 14495]);
  });
});

describe("installments tetikleyicileri", () => {
  it("danışman doğrudan update ile tutar küçültüp ödendi yapamaz", async () => {
    const f = await fixture();
    const { data, error } = await dan.from("installments").update({
      amount: 1, status: "odendi", paid_at: paidAt(), paid_amount: 1, payment_method: "nakit", marked_by: DAN_ID,
    }).eq("id", f.ids[0]).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    expect((await planRows(f.planId))[0]).toMatchObject({ amount: 14495, status: "bekliyor" });
  });

  it("danışman doğrudan update ile eksik paid_amount yazamaz", async () => {
    const f = await fixture();
    const { data, error } = await dan.from("installments").update({
      status: "odendi", paid_at: paidAt(), paid_amount: 1, payment_method: "nakit", marked_by: DAN_ID,
    }).eq("id", f.ids[0]).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("danışman tam ödemeyi doğrudan işaretleyebilir (mevcut yetki korunur)", async () => {
    const f = await fixture();
    const { error } = await dan.from("installments").update({
      status: "odendi", paid_at: paidAt(), paid_amount: 14495, payment_method: "nakit", marked_by: DAN_ID,
    }).eq("id", f.ids[0]);
    expect(error).toBeNull();
  });

  it("danışman ödenmiş satır ekleyemez, bekleyen satır ekleyebilir", async () => {
    const f = await fixture();
    const paidInsert = await dan.from("installments").insert({
      plan_id: f.planId, due_date: "2026-10-05", amount: 1, status: "odendi",
      paid_at: paidAt(), paid_amount: 1, payment_method: "nakit", marked_by: DAN_ID,
    });
    expect(paidInsert.error).not.toBeNull();
    const pending = await dan.from("installments").insert({ plan_id: f.planId, due_date: "2026-10-05", amount: 1 });
    expect(pending.error).toBeNull();
  });

  it("ödenmiş satır silinemez (service_role ve öğrenci silme cascade'i dahil)", async () => {
    const f = await fixture();
    await pay(dan, f.studentId, [{ id: f.ids[0], amount: 14495, parts: [{ amount: 14495, method: "nakit" }] }]);
    const direct = await admin.from("installments").delete().eq("id", f.ids[0]);
    expect(direct.error?.message).toContain("Ödenmiş taksit silinemez");
    const cascade = await admin.from("students").delete().eq("id", f.studentId);
    expect(cascade.error).not.toBeNull();
    expect((await planRows(f.planId)).length).toBe(3);
    // Bekleyen satır silinebilir.
    expect((await admin.from("installments").delete().eq("id", f.ids[2])).error).toBeNull();
  });

  it("anon para tablolarını okuyamaz", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    for (const table of ["installments", "payment_plans", "refunds", "events", "wa_outbox"]) {
      const { error } = await anon.from(table).select("id").limit(1);
      expect(error, table).not.toBeNull();
    }
  });
});
