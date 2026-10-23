import type { Metadata } from "next";
import { GorevimTabs } from "@/components/gorevim-tabs";
import { requireRole } from "@/lib/auth";
import {
  archiveSummary,
  buildTimeline,
  loadMyContent,
  statusPill,
  type MyContentItem,
  type TimelineEvent,
} from "@/lib/queries/my-content";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "İçeriğim" };
export const dynamic = "force-dynamic";

const PILL_CLASS = {
  ok: "bg-accent-soft text-accent",
  warn: "bg-warning-soft text-warning",
  muted: "bg-muted text-muted-foreground",
} as const;

const DOT_CLASS = {
  done: "bg-accent",
  now: "bg-primary",
  todo: "bg-input",
} as const;

export default async function IcerigimPage() {
  const profile = await requireRole("ogretmen");
  const supabase = await createServerSupabase();
  const now = new Date();
  const items = await loadMyContent(supabase, profile.id);

  return (
    <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-4 pb-8">
      <GorevimTabs active="icerigim" />
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Görevim</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Teslim ettiklerin ne oldu. Para ve reklam bütçesi burada görünmez; veli sayıları panelde gerçek arananlardır.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-[15px] text-foreground">
          Henüz teslim ettiğin içerik yok.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <ContentCard item={item} now={now} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-[13px] text-muted-foreground">Bir sorun olursa yöneticine yaz; panelde sana düşen başka iş yok.</p>
    </div>
  );
}

function ContentCard({ item, now }: { item: MyContentItem; now: Date }) {
  const pill = statusPill(item);
  const archived = item.stage === "arsiv";
  return (
    <article className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12.5px] font-bold text-muted-foreground">
          {item.code} · {item.kind === "reels" ? "Reels" : "Sayfa"}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${PILL_CLASS[pill.tone]}`}>
          {pill.text}
        </span>
      </div>
      <h2 className="text-[17px] font-bold text-foreground">{item.topic}</h2>
      {archived ? (
        <div className="flex flex-col gap-1 text-sm text-foreground">
          <p>{archiveSummary(item)}</p>
          {item.learnedNote ? <p className="text-muted-foreground">Öğrenilen not: &ldquo;{item.learnedNote}&rdquo;</p> : null}
        </div>
      ) : (
        <Timeline events={buildTimeline(item, now)} />
      )}
    </article>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;
  return (
    <ol className="flex flex-col">
      {events.map((e, i) => (
        <li key={`${e.title}-${i}`} className="flex gap-3">
          <div className="flex flex-col items-center" aria-hidden="true">
            <span className={`mt-1.5 size-3 shrink-0 rounded-full ${DOT_CLASS[e.tone]}`} />
            {i < events.length - 1 ? <span className="w-0.5 flex-1 bg-border" /> : null}
          </div>
          <div className={`flex flex-col pb-3 ${i === events.length - 1 ? "pb-0" : ""}`}>
            <span className={`text-sm ${e.tone === "now" ? "font-bold" : "font-semibold"} text-foreground`}>{e.title}</span>
            {e.detail ? <span className="text-[12.5px] text-muted-foreground">{e.detail}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
