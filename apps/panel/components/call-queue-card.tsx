"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { claimLead } from "@/actions/lead-flow";
import { START_WINDOWS, label } from "@/lib/constants";
import { type BusinessHours, businessMinutesBetween, timerTone } from "@/lib/lead-flow/business-hours";
import { type QueueLead, queueSourceLabel } from "@/lib/queries/call-queue";
import { waMeUrl } from "@/lib/whatsapp";

const TICK_MS = 30_000;

const PILL_TONE = {
  ok: "bg-accent-soft text-accent",
  warn: "bg-warning-soft text-warning",
  late: "bg-destructive text-on-primary",
} as const;

export { queueSourceLabel };

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

function CallQueueCard({
  lead,
  now,
  hours,
  waMessage,
}: {
  lead: QueueLead;
  now: number;
  hours: BusinessHours;
  waMessage?: string;
}) {
  const router = useRouter();
  // Hata, o anki üstlenme bilgisine bağlanır; yenilenen props (heldBy/claimUntil) kararı devralır.
  const [claimError, setClaimError] = useState<{ message: string; claimUntil: string | null; at: number } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const started = new Date(lead.startedAt);
  const notStarted = started.getTime() > now;
  // R14: yalnız mesai içindeki dakikalar sayılır (18:00'de durur, ertesi sabah devam eder).
  const minutes = businessMinutesBetween(started, new Date(now), hours);
  const tone = timerTone(minutes);
  const late = tone === "late";
  // Üstlenme 15 dk içinde ilk temasa dönmezse sayfa yenilenmeden de "Ara" yeniden açılır.
  const heldBy = lead.claimUntil && Date.parse(lead.claimUntil) > now ? lead.claimedByName : null;
  // Yenileme gelene kadar (en çok 1 dk) hata durur; sonra üstlenen kişi varsa onun süresi kadar.
  const errorActive =
    !!claimError &&
    (claimError.claimUntil === lead.claimUntil ? now - claimError.at < 2 * TICK_MS : !!heldBy);
  const disabled = isPending || !!heldBy || errorActive;
  const waHref = waMeUrl(lead.phone, waMessage);

  const sourceChip = [queueSourceLabel(lead.source, lead.channel, lead.adPlatform), lead.contentCode].filter(Boolean).join(" · ");
  const ageChip = [lead.childAge !== null ? `${lead.childAge} yaş` : null, lead.district].filter(Boolean).join(" · ");
  const windowChip = lead.startWindow
    ? label(START_WINDOWS, lead.startWindow as keyof typeof START_WINDOWS)
    : null;

  function onCall() {
    setClaimError(null);
    startTransition(async () => {
      const res = await claimLead(lead.id);
      if (!res.ok) {
        setClaimError({ message: `${res.claimedBy} bu veliyi arıyor`, claimUntil: lead.claimUntil, at: Date.now() });
        router.refresh();
        return;
      }
      router.push(`/leads/${lead.id}/ara`);
    });
  }

  return (
    <li
      className={`flex flex-col gap-2.5 rounded-2xl bg-surface p-3.5 ${
        late ? "border-2 border-destructive" : "border border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="min-w-0 truncate text-[17px] font-bold text-foreground hover:text-primary-strong">
          {lead.parentName}
        </Link>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums ${PILL_TONE[tone]}`}
          title={notStarted ? "Sayaç mesai başında başlar" : undefined}
        >
          {notStarted ? "mesai dışı" : `${minutes} dk`}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[12.5px]">
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 font-semibold text-primary-strong">{sourceChip}</span>
        {ageChip ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">{ageChip}</span> : null}
        {windowChip ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">{windowChip}</span> : null}
      </div>

      {late ? (
        <p className="text-[13px] text-destructive-strong">15 dakikayı geçti. Yöneticiye bildirim gidiyor.</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCall}
          disabled={disabled}
          className="inline-flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          <Phone aria-hidden className="size-[18px]" />
          {heldBy ? `${firstName(heldBy)} arıyor` : isPending ? "Açılıyor…" : "Ara"}
        </button>
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp'tan yaz"
            title="WhatsApp'tan yaz"
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-accent transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageCircle aria-hidden className="size-5" />
          </a>
        ) : null}
      </div>

      {errorActive ? (
        <p role="alert" className="text-[13px] font-medium text-destructive-strong">
          {claimError.message}
        </p>
      ) : null}
    </li>
  );
}

/** "Şimdi ara" kartları; sayaç her 30 saniyede yeniden hesaplanır. */
export function CallQueueList({
  leads,
  serverNow,
  hours,
  waMessages,
}: {
  leads: QueueLead[];
  serverNow: number;
  hours: BusinessHours;
  waMessages: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      // Yeni gelen veliler ve başkasının üstlenmesi listeye düşsün; arka plandaki sekme sunucuyu yormasın.
      // Kartlar lead.id ile anahtarlı olduğundan kart içi durum (hata, bekleyen işlem) korunur.
      if (document.visibilityState === "visible") router.refresh();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <ul className="flex flex-col gap-2.5">
      {leads.map((lead) => (
        <CallQueueCard key={lead.id} lead={lead} now={now} hours={hours} waMessage={waMessages[lead.id]} />
      ))}
    </ul>
  );
}
