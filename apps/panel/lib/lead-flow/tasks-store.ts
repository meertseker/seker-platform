// Otomatik görevlerin DB yazımı. rule_key açık görevlerde tekildir
// (one_open_auto_task_per_rule); aynı kural ikinci kez açılmaz.
import type { SupabaseClient } from "@supabase/supabase-js";
import { istanbulDateString } from "./business-hours";
import { CALL_TASK_KINDS, LEAD_TASK_KINDS, type LeadTaskKind, type PlannedTask, VISIT_CALL_STEPS } from "./followups";

/** LIKE desenindeki özel karakterleri kaçırır. */
function likePrefix(prefix: string): string {
  return `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Planlanan görevleri açar; aynı rule_key ile açık görev varsa (23505) atlanır.
 * Dönüş: şimdi açık olan rule_key'ler (yeni yazılan ya da zaten açık olan). Diğer hatalar fırlatılır.
 */
export async function upsertPlannedTasks(
  supabase: SupabaseClient,
  leadId: string | null,
  assignedTo: string,
  tasks: PlannedTask[],
): Promise<{ inserted: string[]; alreadyOpen: string[] }> {
  const inserted: string[] = [];
  const alreadyOpen: string[] = [];
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
    // 23505 yalnız açık görevlerdeki tekil indeksten gelir: aynı kural zaten açıktır.
    (error ? alreadyOpen : inserted).push(t.ruleKey);
  }
  return { inserted, alreadyOpen };
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

/** Velinin rule_key'i `<tür>:` ile başlayan açık görevlerini tamamlar; tek güncelleme. */
async function closeLeadTasksLike(supabase: SupabaseClient, leadId: string, pattern: string): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "tamamlandi" })
    .eq("status", "acik")
    .eq("lead_id", leadId)
    .like("rule_key", pattern);
  if (error) throw new Error(`Görevler kapatılamadı: ${error.message}`);
}

/**
 * Velinin verilen türlerdeki açık görevlerini kapatır. lead_id ile seçilir: randevu anahtarlı görevler
 * (hatirlat:<randevu>, noshow:<randevu>, ziyaret:<randevu>:n) de kapsanır.
 */
export async function closeLeadTasks(
  supabase: SupabaseClient,
  leadId: string,
  kinds: readonly LeadTaskKind[],
): Promise<void> {
  for (const kind of kinds) await closeLeadTasksLike(supabase, leadId, likePrefix(`${kind}:`));
}

/**
 * Arama kaydı: veli arandı, bekleyen arama görevleri (takip:, geri:, noshow:, ziyaret:n arama adımları)
 * karşılandı. Mesaj adımları (teşekkür, hatırlatma, kontenjan) arama değildir, kalır.
 */
export async function closeCallTasks(supabase: SupabaseClient, leadId: string): Promise<void> {
  await closeLeadTasks(supabase, leadId, CALL_TASK_KINDS);
  for (const step of VISIT_CALL_STEPS) await closeLeadTasksLike(supabase, leadId, `ziyaret:%:${step}`);
}

/**
 * R27: veli kapandı (kazanıldı/kaybedildi) ya da öğrenciye döndü; verilen türlerdeki görevler geçersizdir
 * (varsayılan hepsi). Hata yutulur ve loglanır: çağıran asıl yazısını yapmıştır, açık kalan satırı
 * Bugün ekranı zaten göstermez (dropClosedLeadFollowups).
 */
export async function closeLeadTasksQuietly(
  supabase: SupabaseClient,
  leadId: string,
  context: string,
  kinds: readonly LeadTaskKind[] = LEAD_TASK_KINDS,
): Promise<void> {
  try {
    await closeLeadTasks(supabase, leadId, kinds);
  } catch (e) {
    console.error(`${context} görev kapatma:`, e);
  }
}

/** rule_key'i `prefix` ile başlayan tüm görevler (durumdan bağımsız), oluşturulma sırasıyla. */
export async function tasksByPrefix(
  supabase: SupabaseClient,
  prefix: string,
): Promise<{ ruleKey: string; createdAt: string }[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("rule_key, created_at")
    .like("rule_key", likePrefix(prefix))
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Görevler okunamadı: ${error.message}`);
  return ((data ?? []) as { rule_key: string | null; created_at: string }[])
    .filter((r) => !!r.rule_key)
    .map((r) => ({ ruleKey: r.rule_key!, createdAt: r.created_at }));
}
