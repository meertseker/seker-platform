// /api/cron/daily: ödeme sözü görevi. Söz günü gelmiş, öğrencinin son görüşmesi olan ve tutulmamış
// her söz için görüşmeyi kaydeden kişiye bir görev açılır (rule_key 'odeme_sozu:<gorusme_id>').
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  openPromises,
  promiseKept,
  promiseRuleKey,
  promiseTaskTitle,
  type GorusmeRow,
  type PromiseInstallment,
} from "@/lib/veli-gorusmesi";

const GORUSME_COLUMNS =
  "id, student_id, author_id, contacted_at, created_at, contact_with, outcome, note, promise_date, promise_amount";

interface PlanJoin {
  student_id: string;
  installments?: PromiseInstallment[] | null;
}

/** Döner: açılan görev sayısı. Hata fırlatır; çağıran loglar. */
export async function createPromiseTasks(db: SupabaseClient, today: string): Promise<number> {
  const { data: due, error: dueError } = await db
    .from("veli_gorusmeleri")
    .select("student_id")
    .eq("outcome", "soz_verdi")
    .lte("promise_date", today);
  if (dueError) throw new Error(`Ödeme sözleri okunamadı: ${dueError.message}`);
  const studentIds = [...new Set((due ?? []).map((row) => row.student_id as string))];
  if (studentIds.length === 0) return 0;

  // Sonraki bir görüşme eski sözü kapatır: öğrencinin bütün görüşmeleri okunup en sonuncusuna bakılır.
  const { data: all, error: allError } = await db
    .from("veli_gorusmeleri")
    .select(GORUSME_COLUMNS)
    .in("student_id", studentIds);
  if (allError) throw new Error(`Görüşmeler okunamadı: ${allError.message}`);
  const candidates = openPromises((all ?? []) as GorusmeRow[]).filter((row) => row.promise_date! <= today);
  if (candidates.length === 0) return 0;

  // Görev bir kez açılır: kapatılmış (tamamlandı) görev de aynı söz için yeniden açılmaz.
  const ruleKeys = candidates.map((row) => promiseRuleKey(row.id));
  const [{ data: existing, error: taskError }, { data: plans, error: planError }, { data: students, error: studentError }] =
    await Promise.all([
      db.from("tasks").select("rule_key").in("rule_key", ruleKeys),
      db
        .from("payment_plans")
        .select("student_id, installments(status, due_date, amount, paid_amount, paid_at)")
        .in("student_id", candidates.map((row) => row.student_id)),
      db.from("students").select("id, full_name").in("id", candidates.map((row) => row.student_id)),
    ]);
  if (taskError || planError || studentError) {
    throw new Error(`Ödeme sözü denetimi okunamadı: ${(taskError ?? planError ?? studentError)!.message}`);
  }
  const done = new Set((existing ?? []).map((row) => row.rule_key as string));
  const installmentsOf = new Map<string, PromiseInstallment[]>();
  for (const plan of (plans ?? []) as PlanJoin[]) {
    installmentsOf.set(plan.student_id, [...(installmentsOf.get(plan.student_id) ?? []), ...(plan.installments ?? [])]);
  }
  const nameOf = new Map((students ?? []).map((row) => [row.id as string, row.full_name as string]));

  let created = 0;
  for (const promise of candidates) {
    const ruleKey = promiseRuleKey(promise.id);
    if (done.has(ruleKey)) continue;
    if (promiseKept(promise, installmentsOf.get(promise.student_id) ?? [])) continue;
    const { error } = await db.from("tasks").insert({
      student_id: promise.student_id,
      assigned_to: promise.author_id,
      due_date: today,
      title: promiseTaskTitle(nameOf.get(promise.student_id) ?? "Öğrenci", promise.promise_date!),
      auto_generated: true,
      rule_key: ruleKey,
    });
    // 23505: aynı söz için açık görev zaten var (eşzamanlı cron).
    if (error && error.code !== "23505") throw new Error(`Ödeme sözü görevi açılamadı: ${error.message}`);
    if (!error) created += 1;
  }
  return created;
}
