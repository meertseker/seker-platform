// Panel bildirimleri: zil ve sayfa için ortak yükleyici.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isNotificationType } from "@/lib/notifications/types";

export interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  leadName: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadNotifications(
  supabase: SupabaseClient,
  userId: string,
  opts: { limit: number; unreadOnly?: boolean },
): Promise<NotificationItem[]> {
  let query = supabase
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("user_id", userId);
  if (opts.unreadOnly) query = query.is("read_at", null);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(opts.limit);

  if (error) {
    console.error("Bildirimler okunamadı:", error.message);
    return [];
  }

  const rows = (data ?? []).map((n) => ({
    id: n.id as string,
    type: n.type as string,
    payload: plainObject(n.payload),
    read_at: (n.read_at as string | null) ?? null,
    created_at: n.created_at as string,
  }));

  const warned = new Set<string>();
  for (const row of rows) {
    if (!isNotificationType(row.type) && !warned.has(row.type)) {
      warned.add(row.type);
      console.warn("[bildirim] tanımsız tür", row.type);
    }
  }

  const leadIds = [
    ...new Set(
      rows
        .map((r) => r.payload.leadId)
        .filter((v): v is string => typeof v === "string" && UUID_RE.test(v)),
    ),
  ];

  const names = new Map<string, string>();
  if (leadIds.length > 0) {
    try {
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, parent_name")
        .in("id", leadIds);
      if (leadsError) {
        console.error("Bildirim lead adları okunamadı:", leadsError.message);
      } else {
        for (const l of leads ?? []) {
          if (l.parent_name) names.set(l.id as string, l.parent_name as string);
        }
      }
    } catch (e) {
      console.error("Bildirim lead adları okunamadı:", e);
    }
  }

  return rows.map((r) => {
    const leadId = r.payload.leadId;
    return { ...r, leadName: typeof leadId === "string" ? (names.get(leadId) ?? null) : null };
  });
}

export async function countUnread(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    console.error("Okunmamış bildirim sayısı okunamadı:", error.message);
    return 0;
  }
  return count ?? 0;
}
