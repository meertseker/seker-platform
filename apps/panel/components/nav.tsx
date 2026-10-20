"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BadgePercent,
  Banknote,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileVideo,
  GraduationCap,
  LogOut,
  Megaphone,
  MessageSquarePlus,
  PencilLine,
  Plus,
  Settings,
  Sun,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { NEW_LEAD_HREF } from "@/lib/lead-routes";
import type { Role } from "@/lib/role-access";
import {
  NotificationBell,
  type NotificationItem,
} from "@/components/notification-bell";


interface NavProps {
  fullName: string;
  role: Role;
  notifications: NotificationItem[];
  unreadCount: number;
  siteEditUrl: string | null;
}

const HOME_HREF = "/bugun";

const mainItems = [
  { href: "/bugun", label: "Bugün", icon: Sun },
  { href: "/pipeline", label: "Veliler", icon: Users },
  { href: "/ogrenciler", label: "Öğrenciler", icon: GraduationCap },
  { href: "/odemeler", label: "Ödemeler", icon: Banknote },
] as const;

// Takvim kenar çubuğunda ana menüde; telefonda alt çubuk dolu olduğundan Menü'nün başında.
const teacherItem = { href: "/gorevim", label: "Görevim", icon: ClipboardList } as const;

// Yönetici için "Reklam" grubu (Aşama 4 buraya Bu hafta, Kampanyalar, Ayarlar ve hedefler ekler).
const adItems = [{ href: "/reklam/icerik", label: "İçerik panosu", icon: FileVideo }] as const;

const calendarItem = { href: "/takvim", label: "Takvim", icon: CalendarDays } as const;


const profileLinks = [
  { href: "/ayarlar", label: "Ayarlar", icon: Settings, roles: ["yonetici"] },
  { href: "/teklifler", label: "Teklifler", icon: BadgePercent, roles: ["yonetici"] },
  { href: "/pazarlama", label: "Pazarlama", icon: Megaphone, roles: ["yonetici"] },
  { href: "/dashboard", label: "Rapor", icon: BarChart3 },
  { href: "/geri-bildirim", label: "Geri bildirim", icon: MessageSquarePlus },
] as const;

function canSee(item: (typeof profileLinks)[number], role: Role) {
  return !("roles" in item) || (item.roles as readonly Role[]).includes(role);
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
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
          ? `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] px-1 py-1.5 text-center text-[0.6875rem] font-semibold tracking-[0.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-white/85 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`
          : `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-white/85 font-semibold text-primary shadow-sm"
                : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
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
  siteEditUrl,
}: {
  fullName: string;
  roleLabel: string;
  links: readonly ProfileLink[];
  pathname: string;
  onNavigate?: () => void;
  siteEditUrl?: string | null;
}) {
  return (
    <>
      <div className="border-b border-black/[0.06] px-3 pb-3">
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
        {siteEditUrl ? (
          <a
            href={siteEditUrl}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-black/[0.04]"
          >
            <PencilLine className="size-5 shrink-0" aria-hidden="true" />
            Siteyi düzenle
          </a>
        ) : null}
      </div>
      <form action={signOut} className="border-t border-black/[0.06] pt-2">
        <button
          type="submit"
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-black/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut aria-hidden className="size-5 shrink-0" />
          Çıkış
        </button>
      </form>
    </>
  );
}

export function Nav({ fullName, role, notifications, unreadCount, siteEditUrl }: NavProps) {
  const pathname = usePathname();
  const [openMenuPathname, setOpenMenuPathname] = useState<string | null>(null);
  const profileMenuOpen = openMenuPathname === pathname;
  const visibleProfileLinks = role === "ogretmen" ? [] : profileLinks.filter((item) => canSee(item, role));
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Menü Escape ile ya da dışına dokununca kapanır; Escape'te odak düğmeye döner.
  useEffect(() => {
    if (!profileMenuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenMenuPathname(null);
      menuButtonRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpenMenuPathname(null);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [profileMenuOpen]);
  const isTeacher = role === "ogretmen";
  const roleLabel = role === "yonetici" ? "Yönetici" : isTeacher ? "Öğretmen" : "Danışman";
  const homeHref = isTeacher ? teacherItem.href : HOME_HREF;
  const sideItems: readonly { href: string; label: string; icon: LucideIcon }[] = isTeacher
    ? [teacherItem]
    : [...mainItems, calendarItem];
  const phoneMenuLinks: readonly ProfileLink[] = isTeacher
    ? []
    : [calendarItem, ...(role === "yonetici" ? adItems : []), ...visibleProfileLinks];

  return (
    <>
      <aside className="glass fixed bottom-3 left-3 top-3 z-30 hidden w-[15.25rem] overflow-y-auto overscroll-contain rounded-[1.75rem] px-3 py-4 md:flex md:flex-col">
        <Link
          href={homeHref}
          className="flex items-center gap-2.5 rounded-xl px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="size-9 object-contain" />
          <span className="text-lg font-semibold tracking-[-0.02em] text-foreground">
            Şeker CRM
          </span>
        </Link>
        <nav aria-label="Ana navigasyon" className="mt-6 flex flex-1 flex-col gap-1">
          {sideItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              pathname={pathname}
            />
          ))}
          {role === "yonetici" ? (
            <>
              <p className="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reklam</p>
              {adItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} />
              ))}
            </>
          ) : null}
          {siteEditUrl && !isTeacher ? (
            <a
              href={siteEditUrl}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-black/[0.04]"
            >
              <PencilLine className="size-5 shrink-0" aria-hidden="true" />
              Siteyi düzenle
            </a>
          ) : null}
          {isTeacher ? null : (
          <Link
            href={NEW_LEAD_HREF}
            className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary shadow-[0_4px_14px_rgb(225_29_72/0.3),inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus aria-hidden className="size-5 shrink-0" />
            Yeni Veli
          </Link>
          )}
        </nav>
        <div className="border-t border-black/[0.06] pt-3">
          <ProfileMenuContents
            fullName={fullName}
            roleLabel={roleLabel}
            links={visibleProfileLinks}
            pathname={pathname}
          />
        </div>
      </aside>

      {/* Bulanıklık sözde öğede: başlığın kendisinde olsaydı içindeki cam açılır menüler sayfayı kıramazdı. */}
      <header className="sticky top-0 z-20 px-4 py-3 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-background/60 before:backdrop-blur-2xl before:backdrop-saturate-150 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-gradient-to-b after:from-background/60 after:to-transparent md:ml-64 md:before:hidden md:after:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link
            href={homeHref}
            className="flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-8 object-contain" />
            <span className="text-base font-semibold tracking-[-0.02em]">Şeker CRM</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NotificationBell
              fixedHref={isTeacher ? teacherItem.href : undefined}
              notifications={notifications}
              unreadCount={unreadCount}
            />
            <div ref={menuRef} className="relative md:hidden">
              <button
                ref={menuButtonRef}
                type="button"
                aria-expanded={profileMenuOpen}
                aria-controls="mobil-menu"
                onClick={() =>
                  setOpenMenuPathname(profileMenuOpen ? null : pathname)
                }
                className="glass flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-1.5 py-1.5 pr-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary-strong">
                  <User aria-hidden className="size-4" />
                </span>
                <span>Menü</span>
              </button>
              {profileMenuOpen ? (
                <div
                  id="mobil-menu"
                  className="glass-thick absolute right-0 top-14 z-50 min-w-60 origin-top-right animate-pop-in rounded-3xl p-2"
                >
                  <ProfileMenuContents
                    fullName={fullName}
                    roleLabel={roleLabel}
                    links={phoneMenuLinks}
                    pathname={pathname}
                    onNavigate={() => setOpenMenuPathname(null)}
                    siteEditUrl={isTeacher ? null : siteEditUrl}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {isTeacher ? null : (
      <nav
        aria-label="Alt navigasyon"
        className="glass fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-30 rounded-[1.75rem] p-1.5 md:hidden"
      >
        <div className="grid grid-cols-5 gap-1">
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
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] bg-primary px-1 py-1.5 text-center text-[0.6875rem] font-semibold tracking-[0.01em] text-on-primary shadow-[0_4px_14px_rgb(225_29_72/0.3),inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <Plus aria-hidden className="size-5" />
            <span className="leading-tight">Yeni Veli</span>
          </Link>
        </div>
      </nav>
      )}
    </>
  );
}
