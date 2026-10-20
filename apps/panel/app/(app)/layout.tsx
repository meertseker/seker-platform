import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { canOpen, homeFor } from "@/lib/role-access";
import { siteEditUrl } from "@/lib/site-edit-url";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { createServerSupabase } from "@/lib/supabase/server";
import { countUnread, loadNotifications } from "@/lib/queries/notifications";
import { PendingApplicationsBanner } from "@/components/pending-applications-banner";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { loadCallQueue, queueBannerSummary } from "@/lib/queries/call-queue";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getSessionProfile();
  // Yol bilgisini middleware ekler; öğretmen /gorevim dışına, danışman /reklam'a gidemez.
  const pathname = (await headers()).get("x-pathname");
  if (pathname && !canOpen(profile.role, pathname)) redirect(homeFor(profile.role));
  const isTeacher = profile.role === "ogretmen";
  const supabase = await createServerSupabase();
  const now = new Date();
  const [notifications, unreadCount, bannerSummary] = await Promise.all([
    loadNotifications(supabase, profile.id, { limit: 20 }),
    countUnread(supabase, profile.id),
    // Bant, Bugün'deki "Şimdi ara" listesiyle aynı kuralı sayar.
    isTeacher
      ? Promise.resolve(null)
      : getLeadFlowSettings(supabase)
      .then(async (settings) =>
        queueBannerSummary(await loadCallQueue(supabase, profile.id, now, settings), now, settings.hours),
      )
      .catch((e: unknown) => {
        console.error("layout call queue banner:", e);
        return null;
      }),
  ]);

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
