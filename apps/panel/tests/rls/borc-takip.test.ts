import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";
import { createPromiseTasks } from "@/lib/queries/promise-tasks";
import { loadFollowupTasks } from "@/lib/queries/call-queue";
import { fetchGorusmeler } from "@/lib/queries/veli-gorusmeleri";

/**
 * 0023 borç takibi: veli_gorusmeleri RLS ve söz kısıtı, tasks.student_id, eski öğrenci alacakları
 * görünümü ve /api/cron/daily ödeme sözü görevi. events'e yazılmaz (WhatsApp kuyruğu tetiklenmez).
 */
const YON_ID = "00000000-0000-0000-0000-000000000001";
const DAN_ID = "00000000-0000-0000-0000-000000000002";
let yon: SupabaseClient;
let dan: SupabaseClient;

function istanbulYmd(offsetDays = 0) {
  const d = new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

async function student(status: "aktif" | "ayrildi" | "mezun", dues: { offset: number; amount: number }[]) {
  const { data: s, error: se } = await admin
    .from("students")
    .insert({ full_name: `Borç Takip ${status} ${Date.now()}`, season: "2025-2026", phone: null, status })
    .select("id, full_name")
    .single();
  if (se) throw se;
  const total = dues.reduce((sum, d) => sum + d.amount, 0);
  const { data: plan, error: pe } = await admin
    .from("payment_plans")
    .insert({ student_id: s!.id, season: "2025-2026", item_type: "diger", total_amount: total, installment_count: dues.length })
    .select("id")
    .single();
  if (pe) throw pe;
  const { data: rows, error: ie } = await admin
    .from("installments")
    .insert(dues.map((d) => ({ plan_id: plan!.id, due_date: istanbulYmd(d.offset), amount: d.amount })))
    .select("id");
  if (ie) throw ie;
  return { id: s!.id as string, name: s!.full_name as string, planId: plan!.id as string, installmentIds: rows!.map((r) => r.id as string) };
}

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
});

describe("veli_gorusmeleri RLS", () => {
  it("danışman kendi adına ekler ve okur; başkası adına ekleyemez; anon okuyamaz", async () => {
    const s = await student("ayrildi", [{ offset: -100, amount: 55700 }]);
    const { data: own, error } = await dan
      .from("veli_gorusmeleri")
      .insert({ student_id: s.id, author_id: DAN_ID, contact_with: "anne", outcome: "ulasilamadi" })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(own?.id).toBeTruthy();

    const { error: forged } = await dan
      .from("veli_gorusmeleri")
      .insert({ student_id: s.id, author_id: YON_ID, contact_with: "anne", outcome: "ulasilamadi" });
    expect(forged).not.toBeNull();

    const { data: seenByYon } = await yon.from("veli_gorusmeleri").select("id").eq("student_id", s.id);
    expect(seenByYon?.map((r) => r.id)).toEqual([own!.id]);
    const listed = await fetchGorusmeler(yon, [s.id]);
    expect(listed.map((r) => [r.id, r.authorName])).toEqual([[own!.id, "Danışman (Test)"]]);

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: anonRows } = await anon.from("veli_gorusmeleri").select("id").eq("student_id", s.id);
    expect(anonRows ?? []).toEqual([]);

    // Güncelleme / silme politikası yok: satır değişmez.
    await dan.from("veli_gorusmeleri").update({ note: "değişti" }).eq("id", own!.id);
    await dan.from("veli_gorusmeleri").delete().eq("id", own!.id);
    const { data: after } = await admin.from("veli_gorusmeleri").select("note").eq("id", own!.id).single();
    expect(after?.note).toBeNull();
  });

  it("söz verdi: söz tarihi zorunlu; diğer sonuçlarda söz alanı olamaz", async () => {
    const s = await student("aktif", [{ offset: -5, amount: 1000 }]);
    const { error: noDate } = await yon
      .from("veli_gorusmeleri")
      .insert({ student_id: s.id, author_id: YON_ID, contact_with: "baba", outcome: "soz_verdi" });
    expect(noDate).not.toBeNull();
    const { error: stray } = await yon
      .from("veli_gorusmeleri")
      .insert({ student_id: s.id, author_id: YON_ID, contact_with: "baba", outcome: "ulasildi", promise_date: istanbulYmd(5) });
    expect(stray).not.toBeNull();
    const { error: ok } = await yon.from("veli_gorusmeleri").insert({
      student_id: s.id, author_id: YON_ID, contact_with: "baba", outcome: "soz_verdi", promise_date: istanbulYmd(5), promise_amount: 500,
    });
    expect(ok).toBeNull();
  });
});

describe("tasks.student_id", () => {
  it("görev öğrenciye bağlanır; aynı anda veliye ve öğrenciye bağlanamaz", async () => {
    const s = await student("aktif", [{ offset: 10, amount: 1000 }]);
    const { error } = await dan
      .from("tasks")
      .insert({ student_id: s.id, assigned_to: DAN_ID, due_date: istanbulYmd(), title: "Öğrenci görevi" });
    expect(error).toBeNull();
    // Bugün ekranı: görev öğrenci adıyla gelir.
    const followups = await loadFollowupTasks(dan, DAN_ID, "danisman", istanbulYmd());
    expect(followups.find((t) => t.studentId === s.id)).toMatchObject({ studentName: s.name, leadId: null });
    const { data: lead } = await admin
      .from("leads")
      .insert({ parent_name: "Borç Veli", phone: "+905550000023", source: "diger" })
      .select("id")
      .single();
    const { error: both } = await admin
      .from("tasks")
      .insert({ lead_id: lead!.id, student_id: s.id, assigned_to: DAN_ID, due_date: istanbulYmd(), title: "İkisi birden" });
    expect(both).not.toBeNull();
  });
});

describe("v_former_overdue_installments", () => {
  it("yalnız ayrılan / mezun öğrencinin vadesi geçmiş bekleyen taksiti; aktif görünüme girmez", async () => {
    const left = await student("ayrildi", [{ offset: -30, amount: 2000 }, { offset: 30, amount: 3000 }]);
    const grad = await student("mezun", [{ offset: -3, amount: 1500 }]);
    const active = await student("aktif", [{ offset: -3, amount: 1500 }]);
    const { data, error } = await dan
      .from("v_former_overdue_installments")
      .select("student_id, amount, student_status")
      .in("student_id", [left.id, grad.id, active.id]);
    expect(error).toBeNull();
    expect(data?.map((r) => [r.student_id, Number(r.amount), r.student_status]).sort()).toEqual(
      [
        [left.id, 2000, "ayrildi"],
        [grad.id, 1500, "mezun"],
      ].sort(),
    );
    const { data: activeView } = await dan.from("v_overdue_installments").select("student_id").in("student_id", [left.id, grad.id]);
    expect(activeView).toEqual([]);
  });
});

describe("createPromiseTasks (cron/daily)", () => {
  it("söz günü gelmiş, tutulmamış söze görev açar; bir kez açar; tutulan söze açmaz", async () => {
    const today = istanbulYmd();
    const broken = await student("ayrildi", [{ offset: -100, amount: 55700 }]);
    const kept = await student("aktif", [{ offset: -10, amount: 1000 }]);
    const future = await student("aktif", [{ offset: -10, amount: 1000 }]);
    const superseded = await student("aktif", [{ offset: -10, amount: 1000 }]);
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    const insert = (studentId: string, extra: Record<string, unknown>) =>
      admin
        .from("veli_gorusmeleri")
        .insert({ student_id: studentId, author_id: DAN_ID, contact_with: "baba", contacted_at: yesterday, ...extra })
        .select("id")
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.id as string;
        });

    const brokenId = await insert(broken.id, { outcome: "soz_verdi", promise_date: today });
    const keptId = await insert(kept.id, { outcome: "soz_verdi", promise_date: today, promise_amount: 1000 });
    await admin
      .from("installments")
      .update({ status: "odendi", paid_at: new Date().toISOString(), paid_amount: 1000, payment_method: "nakit", marked_by: DAN_ID })
      .eq("id", kept.installmentIds[0]);
    const futureId = await insert(future.id, { outcome: "soz_verdi", promise_date: istanbulYmd(3) });
    const oldPromiseId = await insert(superseded.id, { outcome: "soz_verdi", promise_date: today });
    await insert(superseded.id, { outcome: "ulasilamadi", contacted_at: new Date().toISOString() });

    await createPromiseTasks(admin, today);
    await createPromiseTasks(admin, today);

    const { data: tasks } = await admin
      .from("tasks")
      .select("rule_key, student_id, lead_id, assigned_to, due_date, title, auto_generated, status")
      .in("rule_key", [brokenId, keptId, futureId, oldPromiseId].map((id) => `odeme_sozu:${id}`));
    expect(tasks).toHaveLength(1);
    expect(tasks![0]).toMatchObject({
      rule_key: `odeme_sozu:${brokenId}`,
      student_id: broken.id,
      lead_id: null,
      assigned_to: DAN_ID,
      due_date: today,
      auto_generated: true,
      status: "acik",
    });
    expect(tasks![0].title).toBe(`${broken.name}: ${new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" }).format(new Date(`${today}T12:00:00+03:00`))} ödeme sözü — ödeme geldi mi?`);

    // Tamamlanan görev aynı söz için yeniden açılmaz.
    await admin.from("tasks").update({ status: "tamamlandi" }).eq("rule_key", `odeme_sozu:${brokenId}`);
    await createPromiseTasks(admin, today);
    const { count } = await admin.from("tasks").select("id", { count: "exact", head: true }).eq("rule_key", `odeme_sozu:${brokenId}`);
    expect(count).toBe(1);
  });
});
