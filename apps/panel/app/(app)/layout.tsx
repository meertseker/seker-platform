import { getSessionProfile } from "@/lib/auth";
import { siteEditUrl } from "@/lib/site-edit-url";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { createServerSupabase } from "@/lib/supabase/server";
import type { NotificationItem } from "@/components/notification-bell";
import {
  PendingApplicationsBanner,
  type PendingApplication,
} from "@/components/pending-applications-banner";
import { WEB_APPLICATION_SOURCES } from "@/lib/next-step";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86400000).toISOString();
  const [notificationsResult, unreadResult, applicationsResult] = await Promise.all([
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
    supabase
      .from("leads")
      .select("id, parent_name, phone, created_at")
      .eq("status", "yeni")
      .in("source", WEB_APPLICATION_SOURCES)
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);
  const applications = (applicationsResult.data ?? []) as PendingApplication[];
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
    <ToastProvider>
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only z-[80] rounded-xl bg-surface px-4 py-3 font-semibold text-foreground shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        İçeriğe geç
      </a>
      <Nav
        fullName={profile.full_name}
        role={profile.role}
        notifications={notifications}
        unreadCount={unreadCount}
        siteEditUrl={profile.can_edit_site ? siteEditUrl(process.env.SITE_URL) : null}
      />
      <div className="md:pl-64">
        <main id="main" tabIndex={-1} className="mx-auto outline-none flex min-h-screen w-full max-w-7xl flex-col px-4 pb-28 pt-4 sm:px-6 md:pb-8 md:pt-6 lg:px-8">
          <PendingApplicationsBanner applications={applications} now={now.toISOString()} />
          {children}
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
