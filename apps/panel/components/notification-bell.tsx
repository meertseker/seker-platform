"use client";

import { Bell } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markNotificationsRead,
  type NotificationType,
} from "@/actions/notifications";
import { notificationText } from "@/lib/notification-text";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface NotificationBellProps {
  notifications: NotificationItem[];
  unreadCount: number;
}

const relativeFormatter = new Intl.RelativeTimeFormat("tr-TR", {
  numeric: "auto",
});

function relativeTime(value: string) {
  const diffSeconds = Math.round((Date.parse(value) - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) return "şimdi";
  if (absSeconds < 3600) {
    return relativeFormatter.format(Math.round(diffSeconds / 60), "minute");
  }
  if (absSeconds < 86400) {
    return relativeFormatter.format(Math.round(diffSeconds / 3600), "hour");
  }
  return relativeFormatter.format(Math.round(diffSeconds / 86400), "day");
}

function notificationHref(notification: NotificationItem) {
  if (notification.type === "ads_senkron_hata") return "/pazarlama";
  if (notification.type === "geri_bildirim") return "/geri-bildirim";
  const leadId = notification.payload.leadId;

  if (notification.type === "teklif_onay_bekliyor") return "/teklifler";
  return typeof leadId === "string" ? `/leads/${leadId}` : "/";
}

export function NotificationBell({
  notifications,
  unreadCount,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [readUnreadKey, setReadUnreadKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const unreadKey =
    notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id)
      .join(",") || String(unreadCount);
  const displayUnreadCount = readUnreadKey === unreadKey ? 0 : unreadCount;

  useEffect(() => {
    // Sekme arkadayken yenileme yapılmaz: her yenileme sayfanın tüm sorgularını yeniden çalıştırır.
    const interval = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [router]);

  function markRead() {
    setReadUnreadKey(unreadKey);
    startTransition(async () => {
      await markNotificationsRead();
      router.refresh();
    });
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && displayUnreadCount > 0) markRead();
  }

  function openNotification(notification: NotificationItem) {
    setOpen(false);
    if (displayUnreadCount > 0) markRead();
    router.push(notificationHref(notification));
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={displayUnreadCount > 0 ? `Bildirimler, ${displayUnreadCount} okunmamış` : "Bildirimler"}
        aria-expanded={open}
        onClick={toggleOpen}
        className="glass relative flex size-11 cursor-pointer items-center justify-center rounded-full text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell aria-hidden className="size-5" />
        {displayUnreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-xs font-bold text-white tabular-nums">
            {displayUnreadCount > 99 ? "99+" : displayUnreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="glass-thick absolute right-0 top-14 z-50 w-80 max-w-[calc(100vw-2rem)] origin-top-right animate-pop-in overflow-hidden rounded-3xl">
          <div className="border-b border-black/[0.06] px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Bildirimler</p>
            <p className="mt-1 text-xs text-muted-foreground">Son 20 bildirim</p>
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Henüz bildirim yok.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={`block w-full cursor-pointer px-4 py-3 text-left hover:bg-black/[0.04] ${
                      notification.read_at ? "" : "bg-primary/[0.07]"
                    }`}
                  >
                    <span className="block text-sm font-medium text-foreground tabular-nums">
                      {notificationText(notification)}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {relativeTime(notification.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
