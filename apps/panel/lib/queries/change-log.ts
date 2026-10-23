// Reklam kayıt defteri okuması (ad_change_log) ve kayıt satırındaki kişi adları (profiles.full_name).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChangeLogEntry } from "@/lib/ads/change-log";
import { IN_CHUNK, chunk } from "@/lib/content/board";

type LogDbRow = {
  id: string;
  created_at: string;
  platform: string;
  level: string;
  object_id: string;
  object_name: string | null;
  action: ChangeLogEntry["action"];
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  status: ChangeLogEntry["status"];
  source: ChangeLogEntry["source"];
  recommendation_id: string | null;
  actor_id: string;
};

const LOG_COLUMNS =
  "id, created_at, platform, level, object_id, object_name, action, old_value, new_value, reason, status, source, recommendation_id, actor_id";

/** [fromIso, toIso) aralığındaki kayıtlar, en yeni önce. */
export async function loadChangeLog(
  supabase: SupabaseClient,
  fromIso: string,
  toIso: string,
  limit = 500,
): Promise<ChangeLogEntry[]> {
  const { data, error } = await supabase
    .from("ad_change_log")
    .select(LOG_COLUMNS)
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Reklam kayıt defteri okunamadı");
  return ((data ?? []) as LogDbRow[]).map(toEntry);
}

/** Verilen önerilerden gelen kayıtlar (M1 "kim, ne zaman" satırı), en yeni önce. Boş listede sorgu yapılmaz. */
export async function loadChangeLogForRecommendations(supabase: SupabaseClient, ids: string[]): Promise<ChangeLogEntry[]> {
  const out: ChangeLogEntry[] = [];
  for (const part of chunk([...new Set(ids.filter(Boolean))], IN_CHUNK)) {
    const { data, error } = await supabase
      .from("ad_change_log")
      .select(LOG_COLUMNS)
      .in("recommendation_id", part)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Reklam kayıt defteri okunamadı");
    out.push(...((data ?? []) as LogDbRow[]).map(toEntry));
  }
  return out;
}

function toEntry(r: LogDbRow): ChangeLogEntry {
  return {
    id: r.id,
    createdAt: r.created_at,
    platform: r.platform,
    level: r.level,
    objectId: r.object_id,
    objectName: r.object_name,
    action: r.action,
    oldValue: r.old_value,
    newValue: r.new_value,
    reason: r.reason,
    status: r.status,
    source: r.source,
    recommendationId: r.recommendation_id,
    actorId: r.actor_id,
  };
}

/** Kimlik → ad soyad (profiles.full_name). Boş listede sorgu yapılmaz. */
export async function loadProfileNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, string>();
  for (const part of chunk(unique, IN_CHUNK)) {
    const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", part);
    if (error) throw new Error("Kişi adları okunamadı");
    for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) out.set(p.id, p.full_name);
    }
  }
  return out;
}
