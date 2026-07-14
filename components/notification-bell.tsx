"use client";

import { Bell } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markNotificationsRead,
  type NotificationType,
} from "@/actions/notifications";
import { formatTRY, tlToKurus } from "@/lib/money";

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

function moneyFromPayload(value: unknown) {
  return typeof value === "number" ? formatTRY(tlToKurus(value)) : null;
}

function notificationText(notification: NotificationItem) {
  const offered = moneyFromPayload(notification.payload.offered);
  const counterPrice = moneyFromPayload(notification.payload.counterPrice);

  switch (notification.type) {
    case "teklif_onay_bekliyor":
      return offered
        ? `Onay bekleyen yeni teklif: ${offered}`
        : "Yeni teklif onay bekliyor.";
    case "teklifiniz_onaylandi":
      return "Teklifiniz onaylandı.";
    case "teklif_revize_edildi":
      return counterPrice
        ? `Teklif için karşı rakam girildi: ${counterPrice}`
        : "Teklif için karşı rakam girildi.";
    case "teklif_reddedildi":
      return "Teklifiniz reddedildi.";
    default:
      return "Yeni bildirim var.";
  }
}

function notificationHref(notification: NotificationItem) {
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
    const interval = window.setInterval(() => router.refresh(), 30_000);
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
        aria-label="Bildirimler"
        aria-expanded={open}
        onClick={toggleOpen}
        className="relative min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell aria-hidden className="size-5" />
        {displayUnreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-xs font-bold text-white tabular-nums">
            {displayUnreadCount > 99 ? "99+" : displayUnreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-3">
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
                    className={`block w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-muted ${
                      notification.read_at ? "bg-surface" : "bg-primary-soft"
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
