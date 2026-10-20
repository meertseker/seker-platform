"use client";

import Link from "next/link";
import { BellOff, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { markNotificationRead, markNotificationsRead } from "@/actions/notifications";
import { NotificationList } from "@/components/notification-list";
import { visibleUnreadCount } from "@/lib/notifications/bell-state";
import type { NotificationFilter } from "@/lib/notifications/filter";
import type { NotificationItem } from "@/lib/queries/notifications";

interface NotificationsPageClientProps {
  items: NotificationItem[];
  unreadCount: number;
  filter: NotificationFilter;
  /** Sunucuda bir kez hesaplanan "şimdi" (ISO): sunucu ve istemci aynı etiketleri üretir. */
  nowIso: string;
}

const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "okunmamis", label: "Okunmamış" },
];

export function NotificationsPageClient({
  items,
  unreadCount,
  filter,
  nowIso,
}: NotificationsPageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // İyimser okundu durumu (zildekiyle aynı desen); sunucudan yeni veri gelince sıfırlanır.
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [allRead, setAllRead] = useState(false);
  const [seed, setSeed] = useState({ items, unreadCount });
  if (seed.items !== items || seed.unreadCount !== unreadCount) {
    setSeed({ items, unreadCount });
    setReadIds(new Set());
    setAllRead(false);
  }

  const count = visibleUnreadCount({ unreadCount, items, readIds, allRead });
  const now = new Date(nowIso);

  function openItem(item: NotificationItem) {
    if (item.read_at || allRead || readIds.has(item.id)) return;
    setReadIds((current) => new Set(current).add(item.id));
    markNotificationRead(item.id)
      .then((result) => {
        if (result && "error" in result && result.error) {
          setReadIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        }
      })
      .catch(() => {});
  }

  function markAllRead() {
    setAllRead(true);
    // Düğme devre dışı kalınca odak body'ye düşmesin.
    headingRef.current?.focus({ preventScroll: true });
    startTransition(async () => {
      try {
        const result = await markNotificationsRead();
        if ("error" in result && result.error) setAllRead(false);
      } catch {
        setAllRead(false);
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-semibold text-foreground focus:outline-none"
          >Bildirimler</h1>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {count > 0 ? `${count} okunmamış` : "Hepsi okundu"}
          </p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={count === 0}
          className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground disabled:opacity-60 disabled:hover:bg-transparent"
        >
          <CheckCheck aria-hidden className="size-4" />
          Tümünü okundu say
        </button>
      </div>

      <nav aria-label="Bildirim süzgeci" className="inline-flex rounded-full bg-muted p-1">
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <Link
              key={f.value}
              href={f.value === "tumu" ? "/bildirimler" : `/bildirimler?filtre=${f.value}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <BellOff className="size-6" />
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {filter === "okunmamis" ? "Okunmamış bildirim yok" : "Henüz bildirim yok"}
          </p>
          {filter === "okunmamis" ? (
            <Link
              href="/bildirimler"
              className="mt-1 flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Tümünü göster
            </Link>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Yeni bir gelişme olduğunda burada görünür.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-2 shadow-sm">
          <NotificationList
            items={items}
            onOpen={openItem}
            readIds={readIds}
            allRead={allRead}
            now={now}
          />
        </div>
      )}
    </div>
  );
}
