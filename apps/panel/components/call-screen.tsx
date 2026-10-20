"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, MessageCircle, Phone } from "lucide-react";
import { recordCall, type CallResult, type NotFitReason } from "@/actions/lead-flow";
import { queueSourceLabel } from "@/components/call-queue-card";
import { START_WINDOWS, label } from "@/lib/constants";
import { formatTurkishPhone, normalizeTurkishPhone, telHref } from "@/lib/phone";
import {
  type BusinessHours,
  businessMsBetween,
  nextBusinessMoment,
  parseIstanbulDateTime,
  timerTone,
} from "@/lib/lead-flow/business-hours";
import { slotLabel } from "@/lib/lead-flow/script";

export type CallScreenLead = {
  id: string;
  parentName: string;
  /** Aranacak numara (E.164). Ekranda büyük yazılır, "Ara" düğmesi tel: ile açar. */
  phone: string;
  source: string;
  channel: string | null;
  /** İçerik kodu ya da kaynak ayrıntısı (ör. reklam anahtar kelimesi). */
  sourceDetail: string | null;
  childAge: number | null;
  district: string | null;
  startWindow: string | null;
  /** Formdan bu yana sayacın başladığı an; ilk temas yapıldıysa null. */
  startedAt: string | null;
};

type Quals = { age: boolean; area: boolean; timing: boolean; reached: boolean };

const QUALS: { key: keyof Quals; label: string }[] = [
  { key: "age", label: "Yaş uygun (2–6)" },
  { key: "area", label: "Servis alanında" },
  { key: "timing", label: "6 ay içinde başlar" },
  { key: "reached", label: "Konuştuk" },
];

const OUTCOMES: { key: CallResult; label: string; doneTitle: string }[] = [
  { key: "randevu", label: "Randevu verildi", doneTitle: "Randevu kaydedildi" },
  { key: "geri_ara", label: "Geri aranacak", doneTitle: "Geri arama kuruldu" },
  { key: "ulasilamadi", label: "Ulaşılamadı", doneTitle: "Takip sırası başladı" },
  { key: "uygun_degil", label: "Uygun değil", doneTitle: "Kayıt kapatıldı" },
];

const NOT_FIT: { key: NotFitReason; label: string }[] = [
  { key: "yas_uymuyor", label: "yaş uymuyor" },
  { key: "uzaklik", label: "çok uzak" },
  { key: "gelecek_yil", label: "gelecek yıl" },
  { key: "baska_okul", label: "başka okul" },
];

const OTHER_SLOT = "diger";
const TIMER_TONE = { ok: "text-accent", warn: "text-warning", late: "text-destructive" } as const;
const ISTANBUL_OFFSET_MS = 3 * 3_600_000;
const QUARTER_MS = 15 * 60_000;

const fieldClass =
  "block min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-base outline-none transition-colors placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/30";

/** Date → datetime-local değeri ("YYYY-MM-DDTHH:MM", İstanbul). */
function toLocalInput(at: Date): string {
  return new Date(at.getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 16);
}

/** Geri arama için varsayılan: 1 saat sonrası (çeyreğe yuvarlanır), mesai dışındaysa sonraki mesai başı. */
function defaultCallback(now: number, hours: BusinessHours): string {
  const inHour = Math.ceil((now + 3_600_000) / QUARTER_MS) * QUARTER_MS;
  return toLocalInput(nextBusinessMoment(new Date(inHour), hours));
}

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  if (min >= 60) return `${Math.floor(min / 60)} sa ${min % 60} dk`;
  return `${String(min).padStart(2, "0")}:${String(totalSec % 60).padStart(2, "0")}`;
}

function toggleClass(on: boolean) {
  return `rounded-xl border-[1.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    on ? "border-accent bg-accent-soft" : "border-border bg-surface"
  }`;
}

function pickClass(on: boolean) {
  return `rounded-xl border-[1.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    on ? "border-primary bg-primary-soft" : "border-border bg-surface"
  }`;
}

/** Numara: büyük ve seçilebilir; masaüstünde kopyala düğmesi (masa telefonuna tuşlamak için), her cihazda tel: düğmesi. */
function PhoneBlock({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);
  const href = telHref(phone);
  const shown = formatTurkishPhone(phone);
  const digits = normalizeTurkishPhone(phone)?.replace("+90", "0") ?? phone;

  async function copy() {
    try {
      await navigator.clipboard.writeText(digits);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano kapalıysa numara zaten ekranda seçilebilir.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="select-all text-[1.5rem] font-bold tabular-nums tracking-wide" aria-label="Velinin telefonu">
          {shown}
        </p>
        <button
          type="button"
          onClick={copy}
          className="hidden min-h-11 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
        >
          <Copy className="size-4" aria-hidden />
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>
      {href ? (
        <a
          href={href}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[1.0625rem] font-bold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Phone className="size-5" aria-hidden />
          Ara · {shown}
        </a>
      ) : (
        <p className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning">
          Numara geçerli bir cep telefonu değil; veli kartından düzelt.
        </p>
      )}
    </div>
  );
}

function Timer({ startedAt, serverNow, hours }: { startedAt: string; serverNow: number; hours: BusinessHours }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  // Bugün listesindeki sayaçla aynı: yalnız mesai içindeki süre sayılır.
  const ms = businessMsBetween(new Date(startedAt), new Date(now), hours);
  const tone = timerTone(Math.floor(ms / 60000));
  return (
    <span className={`shrink-0 text-[1.625rem] font-bold tabular-nums ${TIMER_TONE[tone]}`} aria-label="Formdan bu yana geçen süre">
      {formatTimer(ms)}
    </span>
  );
}

export function CallScreen({
  lead,
  serverNow,
  hours,
  initialQuals,
  slots,
  waLinks,
}: {
  lead: CallScreenLead;
  serverNow: number;
  hours: BusinessHours;
  initialQuals: Quals;
  /** Önerilen ziyaret saatleri, "YYYY-MM-DDTHH:MM" İstanbul. */
  slots: string[];
  waLinks: Partial<Record<CallResult, string>>;
}) {
  const router = useRouter();
  const [quals, setQuals] = useState<Quals>(initialQuals);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<CallResult | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [otherAt, setOtherAt] = useState("");
  const [callbackAt, setCallbackAt] = useState(() => defaultCallback(serverNow, hours));
  const [reason, setReason] = useState<NotFitReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ result: CallResult; items: string[]; closed: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const saving = useRef(false);
  // Tarih alanlarında geçmiş saat seçilemesin (sunucu da reddeder).
  const minInput = toLocalInput(new Date(serverNow));

  // Yenilemeden sonra öneri listesinden düşen saat seçili kalmaz.
  const selectedSlot = slot === OTHER_SLOT || (slot && slots.includes(slot)) ? slot : null;
  const qualified = quals.age && quals.area && quals.timing && quals.reached;

  const sourceChip = [queueSourceLabel(lead.source, lead.channel), lead.sourceDetail].filter(Boolean).join(" · ");
  const formAnswers = [
    lead.childAge !== null ? `${lead.childAge} yaş` : null,
    lead.district,
    lead.startWindow ? label(START_WINDOWS, lead.startWindow as keyof typeof START_WINDOWS) : null,
  ].filter(Boolean);

  function pickOutcome(next: CallResult) {
    setOutcome(next);
    setError(null);
    // Randevu ve geri arama ulaşıldı demektir; ulaşılamadı ise konuşulmadı.
    if (next === "randevu" || next === "geri_ara") setQuals((q) => ({ ...q, reached: true }));
    if (next === "ulasilamadi") setQuals((q) => ({ ...q, reached: false }));
  }

  function save() {
    // Çift dokunuş: isPending bir sonraki çizime kadar güncellenmeyebilir; ref anında kilitler.
    if (isPending || saving.current) return;
    setError(null);
    if (!outcome) return setError("Arama sonucunu seçin");
    const appointmentAt = outcome === "randevu" ? (selectedSlot === OTHER_SLOT ? otherAt : selectedSlot) : null;
    const at = outcome === "randevu" ? appointmentAt && parseIstanbulDateTime(appointmentAt) : null;
    if (outcome === "randevu" && !at) return setError("Ziyaret için tarih ve saat seçin");
    const callback = outcome === "geri_ara" ? parseIstanbulDateTime(callbackAt) : null;
    if (outcome === "geri_ara" && !callback) return setError("Geri arama için tarih ve saat seçin");
    const chosen = at || callback;
    if (chosen && chosen.getTime() <= Date.now()) return setError("Geçmiş bir saat seçilemez");
    if (outcome === "uygun_degil" && !reason) return setError("Uygun olmama nedenini seçin");

    saving.current = true;
    startTransition(async () => {
      try {
        await submit(appointmentAt);
      } finally {
        saving.current = false;
      }
    });
  }

  async function submit(appointmentAt: string | null) {
    if (!outcome) return;
    const res = await recordCall({
      leadId: lead.id,
      result: outcome,
      quals,
      note: note.trim() || undefined,
      appointmentAt: appointmentAt ?? undefined,
      callbackAt: outcome === "geri_ara" ? callbackAt : undefined,
      notFitReason: outcome === "uygun_degil" ? reason! : undefined,
    });
    if ("error" in res) {
      setError(res.error);
      // Çakışmada öneriler yeniden hesaplansın; başkası üstlendiyse sayfa bunu gösterir.
      router.refresh();
      return;
    }
    window.scrollTo({ top: 0 });
    setDone({ result: outcome, items: res.done, closed: !!res.closed });
  }

  if (done) {
    // Kapanan velide (uygun değil, 7 günde ulaşılamadı) gönderilecek mesaj yoktur.
    const title = done.closed && done.result === "ulasilamadi"
      ? "Kayıt kapatıldı"
      : OUTCOMES.find((o) => o.key === done.result)!.doneTitle;
    const waHref = done.closed ? undefined : waLinks[done.result];
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-[1.125rem] pt-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Check className="size-8" strokeWidth={2.4} aria-hidden />
        </div>
        <h1 className="text-[1.625rem] font-bold tracking-tight">{title}</h1>
        <p className="text-[0.9375rem] text-muted-foreground">
          Senin başka bir şey yapmana gerek yok. Panel şunları yaptı:
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface text-[0.9375rem]">
          {done.items.map((item) => (
            <li key={item} className="flex gap-2.5 px-3.5 py-3">
              <span className="font-bold text-accent" aria-hidden>✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-accent bg-surface text-[1.0625rem] font-bold text-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <MessageCircle className="size-5" aria-hidden />
            WhatsApp mesajını gönder
          </a>
        ) : null}
        <Link
          href="/bugun"
          className="flex min-h-14 items-center justify-center rounded-2xl bg-primary text-[1.0625rem] font-bold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Sıradaki işe geç
        </Link>
      </div>
    );
  }

  return (
    // Form değil: Enter (ör. not alanında) kaydı tetiklemez; kayıt yalnız düğmeyle.
    <div
      className="mx-auto flex w-full max-w-md flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <Link href="/bugun" className="flex min-h-11 items-center text-base font-semibold text-primary">
          ‹ Bugün
        </Link>
        <span className="text-[0.8125rem] text-muted-foreground">Arama sürüyor</span>
      </div>

      <div className="flex flex-col gap-2 rounded-[1.125rem] border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-[1.375rem] font-bold">{lead.parentName}</h1>
          {lead.startedAt ? <Timer startedAt={lead.startedAt} serverNow={serverNow} hours={hours} /> : null}
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">
          {lead.startedAt
            ? Date.parse(lead.startedAt) > serverNow
              ? "Sayaç mesai başında başlar · hedef 5 dakika"
              : "Formdan bu yana · hedef 5 dakika"
            : "Takip araması · ilk temas yapıldı"}
        </p>
        <PhoneBlock phone={lead.phone} />
        <div className="flex flex-wrap gap-1.5 text-[0.78125rem]">
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 font-semibold text-primary-strong">{sourceChip}</span>
          {formAnswers.length > 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
              Formda: {formAnswers.join(", ")}
            </span>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="adim-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="adim-1" className="text-[1.0625rem] font-bold">1 · Uygun mu?</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[0.78125rem] font-bold ${
              qualified ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning"
            }`}
          >
            {qualified ? "Nitelikli aday" : "Eksik bilgi var"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QUALS.map((q) => (
            <button
              key={q.key}
              type="button"
              aria-pressed={quals[q.key]}
              onClick={() => setQuals((s) => ({ ...s, [q.key]: !s[q.key] }))}
              className={`min-h-14 px-3 py-2 text-left text-sm ${toggleClass(quals[q.key])}`}
            >
              <span aria-hidden>{quals[q.key] ? "✓" : "○"}</span> {q.label}
            </button>
          ))}
        </div>
        <label htmlFor="not" className="text-[0.8125rem] text-muted-foreground">Velinin önem verdiği şey</label>
        <input
          id="not"
          type="text"
          autoComplete="off"
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ör. bahçe, servis, yemek"
          className={fieldClass}
        />
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="adim-2">
        <h2 id="adim-2" className="text-[1.0625rem] font-bold">2 · Sonuç</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="adim-2">
          {OUTCOMES.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={outcome === o.key}
              onClick={() => pickOutcome(o.key)}
              className={`min-h-[3.25rem] rounded-xl border-[1.5px] px-2 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                outcome === o.key ? "border-foreground bg-foreground text-surface" : "border-border bg-surface"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {outcome === "randevu" ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
            <p id="saat-baslik" className="text-sm font-semibold">Ziyaret saati (takvimdeki boş saatler)</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="saat-baslik">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selectedSlot === s}
                  onClick={() => setSlot(s)}
                  className={`min-h-11 px-3 text-sm ${pickClass(selectedSlot === s)}`}
                >
                  {slotLabel(s, new Date(serverNow))}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={selectedSlot === OTHER_SLOT}
                onClick={() => setSlot(OTHER_SLOT)}
                className={`min-h-11 px-3 text-sm ${pickClass(selectedSlot === OTHER_SLOT)}`}
              >
                Başka saat
              </button>
            </div>
            {slots.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground">Önümüzdeki günlerde boş önerilen saat yok; başka saat seç.</p>
            ) : null}
            {selectedSlot === OTHER_SLOT ? (
              <>
                <label htmlFor="baska-saat" className="text-[0.8125rem] text-muted-foreground">Ziyaret tarihi ve saati</label>
                <input
                  id="baska-saat"
                  type="datetime-local"
                  min={minInput}
                  value={otherAt}
                  onChange={(e) => setOtherAt(e.target.value)}
                  className={fieldClass}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {outcome === "geri_ara" ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
            <label htmlFor="geri-saat" className="text-sm font-semibold">Ne zaman aranacak?</label>
            <input
              id="geri-saat"
              type="datetime-local"
              min={minInput}
              value={callbackAt}
              onChange={(e) => setCallbackAt(e.target.value)}
              className={fieldClass}
            />
          </div>
        ) : null}

        {outcome === "ulasilamadi" ? (
          <p className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm">
            Sorun değil. Kaydedince panel sonraki aramayı kendisi kurar. Veliye gidecek hazır WhatsApp mesajını sonraki
            ekranda tek dokunuşla gönderirsin.
          </p>
        ) : null}

        {outcome === "uygun_degil" ? (
          <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
            <p id="neden-baslik" className="text-sm font-semibold">Nedenini seç</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="neden-baslik">
              {NOT_FIT.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={reason === r.key}
                  onClick={() => setReason(r.key)}
                  className={`min-h-11 px-3 text-sm ${pickClass(reason === r.key)}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-[0.8125rem] text-muted-foreground">Bu bilgi Pazartesi raporunda reklama göre görünür.</p>
          </div>
        ) : null}
      </section>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:bottom-0 md:mx-0 md:px-0">
        {error ? (
          <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2.5 text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="min-h-14 w-full rounded-2xl bg-primary text-[1.0625rem] font-bold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {isPending ? "Kaydediliyor…" : outcome === "randevu" ? "Randevuyu kaydet" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
