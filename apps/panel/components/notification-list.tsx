"use client";

import Link from "next/link";
import { useId } from "react";
import { NotificationIcon } from "@/components/notification-icon";
import { istanbulDateString } from "@/lib/cron-rules";
import { notificationHint, notificationText } from "@/lib/notification-text";
import { formatNotificationTime, groupNotificationsByDay } from "@/lib/notifications/group";
import { notificationHref } from "@/lib/notifications/link";
import type { NotificationItem } from "@/lib/queries/notifications";

interface NotificationListProps {
  items: NotificationItem[];
  onOpen?: (item: NotificationItem) => void;
  /** Bu ekranda okundu sayılanlar (iyimser); sunucu henüz bilmeyebilir. */
  readIds?: ReadonlySet<string>;
  allRead?: boolean;
  /** Gruplama/saat için "şimdi"; verilmezse render anı. */
  now?: Date;
  /** Öğretmen gibi tek ekranlı roller: her satır bu adrese açılır. */
  fixedHref?: string;
}

function NotificationRow({
  item,
  unread,
  now,
  today,
  onOpen,
  fixedHref,
}: {
  item: NotificationItem;
  unread: boolean;
  now: Date;
  today: string;
  onOpen?: (item: NotificationItem) => void;
  fixedHref?: string;
}) {
  const hint = notificationHint(item);
  const time = formatNotificationTime(item.created_at, now);

  return (
    <Link
      href={fixedHref ?? notificationHref(item, today)}
      onClick={() => onOpen?.(item)}
      data-notification-row
      className={`group flex min-h-11 items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        unread ? "bg-primary-soft hover:bg-primary/[0.09]" : "hover:bg-black/[0.04]"
      }`}
    >
      <NotificationIcon type={item.type} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm leading-snug ${
            unread ? "font-semibold text-foreground" : "font-normal text-foreground/80"
          }`}
        >
          {notificationText(item)}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        {time ? (
          <time
            dateTime={item.created_at}
            className="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
          >
            {time}
          </time>
        ) : null}
        {unread ? (
          <span className="flex items-center">
            <span aria-hidden className="size-2 rounded-full bg-primary" />
            <span className="sr-only">Okunmamış</span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** Zil ve /bildirimler sayfası için ortak liste: gün gruplu, satırın tamamı bağlantı. */
export function NotificationList({
  items,
  onOpen,
  readIds,
  allRead = false,
  now = new Date(),
  fixedHref,
}: NotificationListProps) {
  const idPrefix = useId();
  const today = istanbulDateString(now);
  const groups = groupNotificationsByDay(items, now);

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const headingId = `${idPrefix}-${group.label.replace(/\s+/g, "-")}`;
        return (
          <section key={group.label} aria-labelledby={headingId}>
            <h3
              id={headingId}
              className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
            >
              {group.label}
            </h3>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NotificationRow
                    item={item}
                    unread={!item.read_at && !allRead && !readIds?.has(item.id)}
                    now={now}
                    today={today}
                    onOpen={onOpen}
                    fixedHref={fixedHref}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
