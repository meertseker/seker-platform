"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { claimLead, createMessageLead, type MessageChannel } from "@/actions/lead-flow";

const CHANNELS: { key: MessageChannel; label: string }[] = [
  { key: "ig_dm", label: "Instagram mesajı" },
  { key: "ig_yorum", label: "Instagram yorumu" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "telefon", label: "Telefon" },
];

const PHONE_REQUEST = "Sizi arayıp kısaca bilgi verelim, numaranızı yazar mısınız?";

const fieldClass =
  "block min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-base outline-none transition-colors placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/30";

function choiceClass(on: boolean) {
  return `rounded-xl border-[1.5px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    on ? "border-primary bg-primary-soft" : "border-border bg-surface"
  }`;
}

function fallbackName(channel: MessageChannel) {
  if (channel === "whatsapp") return "WhatsApp velisi";
  return channel === "telefon" ? "Telefon velisi" : "Instagram velisi";
}

export function MessageLeadForm({ codes }: { codes: { code: string; count: number }[] }) {
  const router = useRouter();
  const [channel, setChannel] = useState<MessageChannel>("ig_dm");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState<string>("");
  const [messageAt, setMessageAt] = useState("");
  const [editTime, setEditTime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<{ id: string; duplicate: boolean; name: string } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const channelLabel = CHANNELS.find((c) => c.key === channel)!.label;

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(PHONE_REQUEST);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopyalanamadı, metni elle seçip kopyalayın");
    }
  }

  function save() {
    setError(null);
    if (!phone.trim()) {
      setError("Telefon numarasını girin");
      return;
    }
    startTransition(async () => {
      const res = await createMessageLead({
        channel,
        phone,
        parentName: name || undefined,
        contentCode: code || undefined,
        messageAt: editTime && messageAt ? messageAt : undefined,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone({ ...res, name: name.trim() || fallbackName(channel) });
    });
  }

  function callNow() {
    if (!done) return;
    setClaimError(null);
    startTransition(async () => {
      const res = await claimLead(done.id);
      if (!res.ok) {
        setClaimError(`${res.claimedBy} bu veliyi arıyor`);
        return;
      }
      router.push(`/leads/${done.id}/ara`);
    });
  }

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 pt-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Check className="size-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold">
          {done.duplicate ? `${done.name} zaten kayıtlı` : `${done.name} eklendi`}
        </h1>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface text-[0.9375rem]">
          <li className="flex gap-2.5 px-3.5 py-3">
            <span className="font-bold text-accent" aria-hidden>✓</span>
            <span>Kaynak: {channelLabel}{code ? ` · ${code}` : ""}</span>
          </li>
          <li className="flex gap-2.5 px-3.5 py-3">
            <span className="font-bold text-accent" aria-hidden>✓</span>
            <span>
              {done.duplicate
                ? "Açık kayıt öne çıktı, yeni mesaj not olarak eklendi"
                : "Sayaç başladı: mesaj saatinden itibaren"}
            </span>
          </li>
          <li className="flex gap-2.5 px-3.5 py-3">
            <span className="font-bold text-accent" aria-hidden>✓</span>
            <span>Bugün ekranında &quot;Şimdi ara&quot; listesinde</span>
          </li>
        </ul>
        {claimError ? (
          <p role="alert" className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning">
            {claimError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={callNow}
          disabled={isPending}
          className="min-h-14 w-full rounded-2xl bg-primary text-[1.0625rem] font-bold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {isPending ? "Açılıyor…" : "Şimdi ara"}
        </button>
        <Link
          href="/bugun"
          className="flex min-h-11 items-center justify-center text-sm font-medium text-muted-foreground"
        >
          Bugün ekranına dön
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="mx-auto flex w-full max-w-md flex-col gap-[1.125rem]"
    >
      <div className="flex items-center justify-between">
        <Link href="/bugun" className="flex min-h-11 items-center text-base font-semibold text-primary">
          ‹ Vazgeç
        </Link>
        <span className="text-[0.8125rem] text-muted-foreground">3 adım · 30 saniye</span>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-[1.625rem] font-bold tracking-tight">Mesajdan veli ekle</h1>
        <p className="text-sm leading-snug text-muted-foreground">
          Instagram ya da WhatsApp&apos;tan yazan her veli buraya girer. Girmeyen veli takip edilemez ve hangi reklamdan geldiği bilinmez.
        </p>
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="adim-1">
        <h2 id="adim-1" className="text-base font-bold">1 · Nereden yazdı?</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="adim-1">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={channel === c.key}
              onClick={() => setChannel(c.key)}
              className={`min-h-[3.25rem] px-2 text-center text-[0.9375rem] font-semibold ${choiceClass(channel === c.key)}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="adim-2">
        <h2 id="adim-2" className="text-base font-bold">2 · Telefon ve ad</h2>
        <label htmlFor="tel" className="text-[0.8125rem] text-muted-foreground">Telefon (zorunlu)</label>
        <input
          id="tel"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="05XX XXX XX XX"
          className={fieldClass}
        />
        <label htmlFor="ad" className="text-[0.8125rem] text-muted-foreground">Velinin adı (biliniyorsa)</label>
        <input
          id="ad"
          type="text"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
        />
        <p className="text-[0.8125rem] leading-snug text-muted-foreground">
          Numara vermediyse önce şu mesajı gönder: &quot;{PHONE_REQUEST}&quot;{" "}
          <button
            type="button"
            onClick={copyRequest}
            className="inline-flex min-h-11 items-center px-1 text-[0.8125rem] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>
        </p>
        <div className="text-[0.8125rem] text-muted-foreground">
          {editTime ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="saat">Mesaj saati</label>
              <input
                id="saat"
                type="datetime-local"
                value={messageAt}
                onChange={(e) => setMessageAt(e.target.value)}
                className={fieldClass}
              />
            </div>
          ) : (
            <span>
              Mesaj saati: şimdi ·{" "}
              <button
                type="button"
                onClick={() => setEditTime(true)}
                className="inline-flex min-h-11 items-center px-1 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                değiştir
              </button>
            </span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="adim-3">
        <h2 id="adim-3" className="text-base font-bold">3 · Hangi video ya da reklam?</h2>
        <p className="text-[0.8125rem] text-muted-foreground">
          Veli bir Reels&apos;e yazdıysa onu seç. Bilmiyorsan &quot;Bilmiyorum&quot; de, sorun değil.
        </p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="adim-3">
          {codes.map((c) => (
            <button
              key={c.code}
              type="button"
              role="radio"
              aria-checked={code === c.code}
              onClick={() => setCode(c.code)}
              className={`flex min-h-16 items-center gap-3 px-2.5 py-2 ${choiceClass(code === c.code)}`}
            >
              <span className="h-[3.25rem] w-10 shrink-0 rounded-lg bg-muted" aria-hidden />
              <span className="flex flex-col gap-0.5">
                <span className="text-[0.9375rem] font-semibold">{c.code}</span>
                <span className="text-xs text-muted-foreground">Son 4 haftada {c.count} veli</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={code === ""}
            onClick={() => setCode("")}
            className={`flex min-h-16 items-center gap-3 px-2.5 py-2 ${choiceClass(code === "")}`}
          >
            <span className="h-[3.25rem] w-10 shrink-0 rounded-lg bg-muted" aria-hidden />
            <span className="flex flex-col gap-0.5">
              <span className="text-[0.9375rem] font-semibold">Bilmiyorum</span>
              <span className="text-xs text-muted-foreground">Kaynak sadece kanal olarak kaydedilir</span>
            </span>
          </button>
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft px-3 py-2.5 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-14 w-full rounded-2xl bg-primary text-[1.0625rem] font-bold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {isPending ? "Ekleniyor…" : "Ekle ve aramaya geç"}
      </button>

      <Link href="/leads/new" className="flex min-h-11 items-center justify-center text-sm font-medium text-muted-foreground">
        Elle veli ekle
      </Link>
    </form>
  );
}
