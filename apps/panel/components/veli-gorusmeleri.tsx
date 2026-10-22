import { formatTRY, tlToKurus } from "@/lib/money";
import { BADGE_BASE } from "@/lib/status-styles";
import type { GorusmeWithAuthor } from "@/lib/queries/veli-gorusmeleri";
import {
  CALL_OUTCOMES,
  CONTACT_WITH,
  promiseDayLabel,
  promiseState,
  type CallOutcome,
  type GorusmeRow,
} from "@/lib/veli-gorusmesi";

export const CALL_OUTCOME_STYLES: Record<CallOutcome, string> = {
  ulasilamadi: "bg-slate-100 text-slate-700 ring-slate-200",
  ulasildi: "bg-sky-50 text-sky-700 ring-sky-200",
  soz_verdi: "bg-amber-50 text-amber-800 ring-amber-200",
  odeme_yapti: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Istanbul",
});

const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

export function OutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  return <span className={`${BADGE_BASE} ${CALL_OUTCOME_STYLES[outcome]}`}>{CALL_OUTCOMES[outcome]}</span>;
}

function promiseText(row: Pick<GorusmeRow, "promise_date" | "promise_amount">) {
  if (!row.promise_date) return null;
  const amount = row.promise_amount === null ? null : Number(row.promise_amount);
  return `${promiseDayLabel(row.promise_date)}${amount ? ` · ${formatTRY(tlToKurus(amount))}` : ""}`;
}

/** Açık sözün rozeti: söz günü geçti / bugün / ileride. */
export function PromiseBadge({ row, today }: { row: Pick<GorusmeRow, "promise_date" | "promise_amount">; today: string }) {
  if (!row.promise_date) return null;
  const state = promiseState(row.promise_date, today);
  const tone =
    state === "gecti"
      ? "bg-red-700 text-white ring-red-700"
      : state === "bugun"
        ? "bg-amber-50 text-amber-800 ring-amber-300"
        : "bg-surface text-foreground ring-border";
  const prefix = state === "gecti" ? "Söz günü geçti" : state === "bugun" ? "Söz bugün" : "Ödeme sözü";
  return <span className={`${BADGE_BASE} ${tone}`}>{`${prefix}: ${promiseText(row)}`}</span>;
}

/** Gecikenler kartındaki tek satır: "Son görüşme 21 Eki · Baba · Söz verdi". */
export function LastGorusmeLine({ row }: { row: GorusmeWithAuthor }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span>
        Son görüşme {shortDateFormatter.format(new Date(row.contacted_at))} · {CONTACT_WITH[row.contact_with]}
        {row.authorName ? ` · ${row.authorName}` : ""}
      </span>
      <OutcomeBadge outcome={row.outcome} />
    </span>
  );
}

/** Öğrenci sayfası: görüşme geçmişi (kim, ne zaman, kiminle, sonuç, söz, not). */
export function VeliGorusmeleriList({ rows }: { rows: GorusmeWithAuthor[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz görüşme kaydı yok.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{dateTimeFormatter.format(new Date(row.contacted_at))}</span>
            <span className="text-muted-foreground">· {CONTACT_WITH[row.contact_with]}</span>
            <OutcomeBadge outcome={row.outcome} />
            {row.promise_date ? <span className="text-foreground">Söz: {promiseText(row)}</span> : null}
          </div>
          {row.note ? <p className="whitespace-pre-wrap break-words text-base text-foreground">{row.note}</p> : null}
          <p className="text-xs text-muted-foreground">{row.authorName ?? "Panel"} kaydetti</p>
        </li>
      ))}
    </ul>
  );
}
