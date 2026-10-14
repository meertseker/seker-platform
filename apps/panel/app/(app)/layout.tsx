import { getSessionProfile } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { createServerSupabase } from "@/lib/supabase/server";
import type { NotificationItem } from "@/components/notification-bell";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const [notificationsResult, unreadResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, payload, read_at, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null),
  ]);
  const notifications = (notificationsResult.data ?? []).map((notification) => ({
    id: notification.id,
    type: notification.type,
    payload:
      notification.payload &&
      typeof notification.payload === "object" &&
      !Array.isArray(notification.payload)
        ? (notification.payload as Record<string, unknown>)
        : {},
    read_at: notification.read_at,
    created_at: notification.created_at,
  })) satisfies NotificationItem[];
  const unreadCount = unreadResult.count ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav
        fullName={profile.full_name}
        role={profile.role}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <div className="md:pl-64">
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-28 pt-4 sm:px-6 md:pb-8 md:pt-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
