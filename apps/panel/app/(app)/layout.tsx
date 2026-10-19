import { getSessionProfile } from "@/lib/auth";
import { siteEditUrl } from "@/lib/site-edit-url";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { createServerSupabase } from "@/lib/supabase/server";
import type { NotificationItem } from "@/components/notification-bell";
import { PendingApplicationsBanner } from "@/components/pending-applications-banner";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { loadCallQueue, queueBannerSummary } from "@/lib/queries/call-queue";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const now = new Date();
  const [notificationsResult, unreadResult, bannerSummary] = await Promise.all([
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
    // Bant, Bugün'deki "Şimdi ara" listesiyle aynı kuralı sayar.
    getLeadFlowSettings(supabase)
      .then(async (settings) =>
        queueBannerSummary(await loadCallQueue(supabase, profile.id, now, settings), now, settings.hours),
      )
      .catch((e: unknown) => {
        console.error("layout call queue banner:", e);
        return null;
      }),
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
          <PendingApplicationsBanner summary={bannerSummary} />
          {children}
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
