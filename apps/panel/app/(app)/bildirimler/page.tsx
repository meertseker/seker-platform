import { NotificationsPageClient } from "@/components/notifications-page-client";
import { getSessionProfile } from "@/lib/auth";
import { parseFilter } from "@/lib/notifications/filter";
import { countUnread, loadNotifications } from "@/lib/queries/notifications";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bildirimler" };

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string | string[] }>;
}) {
  const { filtre } = await searchParams;
  const filter = parseFilter(filtre);
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();

  const [items, unreadCount] = await Promise.all([
    loadNotifications(supabase, profile.id, { limit: 100, unreadOnly: filter === "okunmamis" }),
    countUnread(supabase, profile.id),
  ]);

  return (
    <NotificationsPageClient
      items={items}
      unreadCount={unreadCount}
      filter={filter}
      nowIso={new Date().toISOString()}
    />
  );
}
