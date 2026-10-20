import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "./types";

export interface NotificationRow {
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
}

// notifications tablosuna yazmanın tek yolu: tip kayıtla sınırlı kalır
// (tests/unit/notification-producers.test.ts ham insert'i yasaklar).
// Atmaz, loglamaz; hatayı çağıran yönetir.
export async function insertNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: Pick<SupabaseClient<any, any, any>, "from">,
  rows: NotificationRow[],
): Promise<{ error: { message: string } | null }> {
  const { error } = await db.from("notifications").insert(rows);
  return { error };
}
