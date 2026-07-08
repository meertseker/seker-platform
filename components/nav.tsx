"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { signOut } from "@/actions/auth";

type Role = "yonetici" | "danisman";

interface NavProps {
  fullName: string;
  role: Role;
}

const mainItems = [
  { href: "/", label: "Bugün" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/takvim", label: "Takvim" },
  { href: "/ogrenciler", label: "Öğrenciler" },
  { href: "/odemeler", label: "Ödemeler" },
] as const;

const secondaryItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/teklifler", label: "Teklifler", roles: ["yonetici"] },
  { href: "/ayarlar", label: "Ayarlar", roles: ["yonetici"] },
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
  pathname,
  compact = false,
  onClick,
}: {
  href: string;
  label: string;
  pathname: string;
  compact?: boolean;
  onClick?: () => void;
}) {
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        compact
          ? `rounded-2xl px-3 py-2 text-center text-xs font-semibold transition ${
              active
                ? "bg-zinc-950 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            }`
          : `rounded-xl px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-zinc-950 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            }`
      }
    >
      {label}
    </Link>
  );
}

export function Nav({ fullName, role }: NavProps) {
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-200 bg-white px-4 py-5 md:flex md:flex-col">
        <Link href="/" className="px-3 text-lg font-semibold">
          AnaOkulCRM
        </Link>
        <nav aria-label="Ana navigasyon" className="mt-8 flex flex-1 flex-col gap-1">
          {allDesktopItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              pathname={pathname}
            />
          ))}
        </nav>
        <div className="rounded-2xl bg-zinc-50 p-3">
          <p className="truncate text-sm font-semibold text-zinc-900">
            {fullName}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {role === "yonetici" ? "Yönetici" : "Danışman"}
          </p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
            >
              Çıkış
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:ml-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/" className="text-base font-semibold md:hidden">
            AnaOkulCRM
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="max-w-36 truncate text-sm font-medium text-zinc-700 sm:max-w-none">
              {fullName}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
              >
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav
        aria-label="Alt navigasyon"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] md:hidden"
      >
        <div className="grid grid-cols-6 gap-1">
          {mainItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
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
              className="w-full rounded-2xl px-3 py-2 text-center text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
            >
              …
            </button>
            {moreMenuOpen ? (
              <div className="absolute bottom-12 right-0 min-w-40 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg">
                {visibleSecondary.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
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
