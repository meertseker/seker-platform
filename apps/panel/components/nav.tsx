"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  BadgePercent,
  Banknote,
  BarChart3,
  GraduationCap,
  LogOut,
  Plus,
  Settings,
  User,
  Users,
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

const HOME_HREF = "/pipeline";

const mainItems = [
  { href: "/pipeline", label: "Veliler", icon: Users },
  { href: "/ogrenciler", label: "Öğrenciler", icon: GraduationCap },
  { href: "/odemeler", label: "Ödemeler", icon: Banknote },
] as const;

const NEW_LEAD_HREF = "/leads/new";

const profileLinks = [
  { href: "/ayarlar", label: "Ayarlar", icon: Settings, roles: ["yonetici"] },
  { href: "/teklifler", label: "Teklifler", icon: BadgePercent, roles: ["yonetici"] },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
] as const;

function canSee(item: (typeof profileLinks)[number], role: Role) {
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

type ProfileLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function ProfileMenuContents({
  fullName,
  roleLabel,
  links,
  pathname,
  onNavigate,
}: {
  fullName: string;
  roleLabel: string;
  links: readonly ProfileLink[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="border-b border-border px-3 pb-3">
        <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{roleLabel}</p>
      </div>
      <div className="flex flex-col gap-1 py-2">
        {links.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            pathname={pathname}
            onClick={onNavigate}
          />
        ))}
      </div>
      <form action={signOut} className="border-t border-border pt-2">
        <button
          type="submit"
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut aria-hidden className="size-5 shrink-0" />
          Çıkış
        </button>
      </form>
    </>
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
  const profileMenuOpen = openMenuPathname === pathname;
  const visibleProfileLinks = profileLinks.filter((item) => canSee(item, role));
  const roleLabel = role === "yonetici" ? "Yönetici" : "Danışman";

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface px-4 py-5 md:flex md:flex-col">
        <Link
          href={HOME_HREF}
          className="flex items-center gap-2.5 rounded-xl px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="size-9 object-contain" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Şeker CRM
          </span>
        </Link>
        <nav aria-label="Ana navigasyon" className="mt-8 flex flex-1 flex-col gap-1">
          {mainItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              pathname={pathname}
            />
          ))}
          <Link
            href={NEW_LEAD_HREF}
            className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus aria-hidden className="size-5 shrink-0" />
            Yeni Veli
          </Link>
        </nav>
        <div className="rounded-2xl border border-border bg-muted/60 p-3">
          <ProfileMenuContents
            fullName={fullName}
            roleLabel={roleLabel}
            links={visibleProfileLinks}
            pathname={pathname}
          />
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur md:ml-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link
            href={HOME_HREF}
            className="flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-8 object-contain" />
            <span className="text-base font-bold tracking-tight">Şeker CRM</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
            />
            <div className="relative md:hidden">
              <button
                type="button"
                aria-label="Profil ve menü"
                aria-expanded={profileMenuOpen}
                onClick={() =>
                  setOpenMenuPathname(profileMenuOpen ? null : pathname)
                }
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <User aria-hidden className="size-4" />
                </span>
                <span className="hidden max-w-28 truncate sm:inline">{fullName}</span>
              </button>
              {profileMenuOpen ? (
                <div className="absolute right-0 top-14 z-50 min-w-56 rounded-2xl border border-border bg-surface p-2 shadow-lg">
                  <ProfileMenuContents
                    fullName={fullName}
                    roleLabel={roleLabel}
                    links={visibleProfileLinks}
                    pathname={pathname}
                    onNavigate={() => setOpenMenuPathname(null)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <nav
        aria-label="Alt navigasyon"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-2 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] md:hidden"
      >
        <div className="grid grid-cols-4 gap-1">
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
          <Link
            href={NEW_LEAD_HREF}
            aria-label="Yeni veli ekle"
            className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl bg-primary px-1 py-1.5 text-center text-[11px] font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <Plus aria-hidden className="size-5" />
            <span className="leading-tight">Yeni Veli</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
