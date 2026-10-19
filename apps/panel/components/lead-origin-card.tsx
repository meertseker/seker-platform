import { MapPin } from "lucide-react";

interface LeadOriginCardProps {
  channelLabel: string;
  codeLabel: string | null;
  /** Gelişin alt satırı, ör. "Salı 3 Kasım 09:12 · /lp/beykent". */
  sub: string | null;
  answers: string[];
  /** Cevaplar sayfa formundan mı geldi; değilse "Bilinenler" yazılır. */
  fromForm: boolean;
}

/** "Nereden geldi": kanal, içerik kodu ve formdaki cevaplar. */
export function LeadOriginCard({ channelLabel, codeLabel, sub, answers, fromForm }: LeadOriginCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-muted-foreground">Nereden geldi</h2>
      <div className="mt-2.5 flex gap-3">
        <div
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
        >
          {codeLabel ? (
            <span className="text-xs font-bold">{codeLabel.slice(0, 1)}</span>
          ) : (
            <MapPin className="size-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold text-foreground">
            {channelLabel}
            {codeLabel ? <span className="text-primary-strong"> · {codeLabel}</span> : null}
          </p>
          {sub ? <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p> : null}
        </div>
      </div>
      {answers.length > 0 ? (
        <p className="mt-3 rounded-xl bg-muted px-3 py-2.5 text-sm text-foreground">
          <span className="font-semibold">{fromForm ? "Formdaki cevaplar" : "Bilinenler"}:</span>{" "}
          {answers.join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
