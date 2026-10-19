// Otomatik görevlerin DB yazımı. rule_key açık görevlerde tekildir
// (one_open_auto_task_per_rule); aynı kural ikinci kez açılmaz.
import type { SupabaseClient } from "@supabase/supabase-js";
import { istanbulDateString } from "./business-hours";
import type { PlannedTask } from "./followups";

/** LIKE desenindeki özel karakterleri kaçırır. */
function likePrefix(prefix: string): string {
  return `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Planlanan görevleri açar; aynı rule_key ile açık görev varsa (23505) atlanır. */
export async function upsertPlannedTasks(
  supabase: SupabaseClient,
  leadId: string | null,
  assignedTo: string,
  tasks: PlannedTask[],
): Promise<void> {
  // Tek tek yazılır: toplu insert'te bir çakışma diğerlerini de düşürürdü.
  for (const t of tasks) {
    const { error } = await supabase.from("tasks").insert({
      lead_id: leadId,
      assigned_to: assignedTo,
      title: t.title,
      due_at: t.dueAt.toISOString(),
      due_date: istanbulDateString(t.dueAt),
      auto_generated: true,
      rule_key: t.ruleKey,
    });
    if (error && error.code !== "23505") throw new Error(`Görev açılamadı: ${error.message}`);
  }
}

/** rule_key'i `prefix` ile başlayan açık görevleri tamamlar. */
export async function closeTasksByPrefix(supabase: SupabaseClient, prefix: string): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "tamamlandi" })
    .eq("status", "acik")
    .like("rule_key", likePrefix(prefix));
  if (error) throw new Error(`Görevler kapatılamadı: ${error.message}`);
}

/** rule_key'i `prefix` ile başlayan açık görevlerin anahtarları. */
export async function openRuleKeys(supabase: SupabaseClient, prefix: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("rule_key")
    .eq("status", "acik")
    .like("rule_key", likePrefix(prefix));
  if (error) throw new Error(`Görevler okunamadı: ${error.message}`);
  return ((data ?? []) as { rule_key: string | null }[]).map((r) => r.rule_key).filter((k): k is string => !!k);
}
