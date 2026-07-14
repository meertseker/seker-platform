"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  BadgePercent,
  BarChart3,
  Calendar,
  Columns3,
  Ellipsis,
  GraduationCap,
  Home,
  LogOut,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import {
  NotificationBell,
  type NotificationItem,
} from "@/components/notification-bell";

type Role = "yonetici" | "danisman";

interface NavProps {
  fullName: string;
  role: Role;
  notifications: NotificationItem[];
  unreadCount: number;
}

const mainItems = [
  { href: "/", label: "Bugün", icon: Home },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/takvim", label: "Takvim", icon: Calendar },
  { href: "/ogrenciler", label: "Öğrenciler", icon: GraduationCap },
  { href: "/odemeler", label: "Ödemeler", icon: Wallet },
] as const;

const secondaryItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/teklifler", label: "Teklifler", icon: BadgePercent, roles: ["yonetici"] },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings, roles: ["yonetici"] },
] as const;

function canSee(item: (typeof secondaryItems)[number], role: Role) {
  return !("roles" in item) || (item.roles as readonly Role[]).includes(role);
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function subscribeClientReady() {
  return () => {};
}

function clientSnapshot() {
  return true;
}

function serverSnapshot() {
  return false;
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  compact = false,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
  compact?: boolean;
  onClick?: () => void;
}) {
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={
        compact
          ? `flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              active
                ? "bg-primary-soft text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`
          : `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              active
                ? "bg-primary-soft font-semibold text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`
      }
    >
      <Icon aria-hidden className={compact ? "size-5" : "size-5 shrink-0"} strokeWidth={active ? 2.25 : 2} />
      <span className={compact ? "leading-tight" : undefined}>{label}</span>
    </Link>
  );
}

export function Nav({ fullName, role, notifications, unreadCount }: NavProps) {
  const currentPathname = usePathname();
  const mounted = useSyncExternalStore(
    subscribeClientReady,
    clientSnapshot,
    serverSnapshot,
  );
  const pathname = mounted ? currentPathname : "";
  const [openMenuPathname, setOpenMenuPathname] = useState<string | null>(null);
  const moreMenuOpen = openMenuPathname === pathname;
  const visibleSecondary = secondaryItems.filter((item) => canSee(item, role));
  const allDesktopItems = [...mainItems, ...visibleSecondary];

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface px-4 py-5 md:flex md:flex-col">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary">
            <GraduationCap aria-hidden className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            AnaOkulCRM
          </span>
        </Link>
        <nav aria-label="Ana navigasyon" className="mt-8 flex flex-1 flex-col gap-1">
          {allDesktopItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              pathname={pathname}
            />
          ))}
        </nav>
        <div className="rounded-2xl border border-border bg-muted/60 p-3">
          <p className="truncate text-sm font-semibold text-foreground">
            {fullName}
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            {role === "yonetici" ? "Yönetici" : "Danışman"}
          </p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut aria-hidden className="size-4" />
              Çıkış
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur md:ml-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-on-primary">
              <GraduationCap aria-hidden className="size-4.5" />
            </span>
            <span className="text-base font-bold tracking-tight">AnaOkulCRM</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
            />
            <span className="max-w-36 truncate text-sm font-medium text-muted-foreground sm:max-w-none">
              {fullName}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Çıkış yap"
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut aria-hidden className="size-4" />
                <span className="hidden sm:inline">Çıkış</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav
        aria-label="Alt navigasyon"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-2 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] md:hidden"
      >
        <div className="grid grid-cols-6 gap-1">
          {mainItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              pathname={pathname}
              compact
            />
          ))}
          <div className="relative">
            <button
              type="button"
              aria-label="Diğer menü"
              aria-expanded={moreMenuOpen}
              onClick={() =>
                setOpenMenuPathname(moreMenuOpen ? null : pathname)
              }
              className={`flex min-h-11 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                moreMenuOpen || visibleSecondary.some((item) => isActive(pathname, item.href))
                  ? "bg-primary-soft text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Ellipsis aria-hidden className="size-5" />
              <span className="leading-tight">Diğer</span>
            </button>
            {moreMenuOpen ? (
              <div className="absolute bottom-14 right-0 min-w-44 rounded-2xl border border-border bg-surface p-2 shadow-lg">
                {visibleSecondary.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    pathname={pathname}
                    onClick={() => setOpenMenuPathname(null)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </nav>
    </>
  );
}
