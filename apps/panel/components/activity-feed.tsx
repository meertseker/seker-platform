import {
  EVENT_LABELS,
  label,
  LEAD_STATUSES,
  type LeadStatus,
} from "@/lib/constants";

type JsonPayload = Record<string, unknown> | null;

interface BaseFeedItem {
  id: string;
  createdAt: string;
  actorName: string | null;
}

export interface NoteFeedItem extends BaseFeedItem {
  type: "note";
  body: string;
}

export interface EventFeedItem extends BaseFeedItem {
  type: "event";
  eventType: string;
  payload: JsonPayload;
}

export type ActivityFeedItem = NoteFeedItem | EventFeedItem;

interface ActivityFeedProps {
  items: ActivityFeedItem[];
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function payloadString(payload: JsonPayload, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function formatEvent(item: EventFeedItem) {
  const title = label(EVENT_LABELS, item.eventType);

  if (item.eventType === "durum_degisti") {
    const from = payloadString(item.payload, "from");
    const to = payloadString(item.payload, "to");

    if (from && to) {
      return `${title}: ${label(LEAD_STATUSES, from as LeadStatus)} → ${label(
        LEAD_STATUSES,
        to as LeadStatus,
      )}`;
    }
  }

  return title;
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        Henüz aktivite yok. İlk notu ekleyin.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const actor = item.actorName ?? "Sistem";
        const timestamp = formatDate(item.createdAt);

        if (item.type === "event") {
          return (
            <li
              key={item.id}
              className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground"
            >
              <span className="font-medium text-foreground">
                {formatEvent(item)}
              </span>{" "}
              — {actor}, {timestamp}
            </li>
          );
        }

        return (
          <li
            key={item.id}
            className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{actor}</span>
              <time dateTime={item.createdAt}>{timestamp}</time>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
              {item.body}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
