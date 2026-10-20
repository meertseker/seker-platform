"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveAdSettings } from "@/actions/ad-settings";
import type { AdSettings } from "@/lib/ads/ad-settings";

const field =
  "w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const hint = "mt-1 text-xs text-muted-foreground";
const card = "space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6";

type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  help?: string;
  decimal?: boolean;
  invalid?: boolean;
};

function NumberField({ id, label, value, onChange, unit, help, decimal, invalid }: NumberFieldProps) {
  const helpId = help ? `${id}-yardim` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={decimal ? "any" : 1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={[helpId, invalid ? "ad-ayar-hata" : undefined].filter(Boolean).join(" ") || undefined}
          className={`${field} min-h-11 ${invalid ? "border-destructive" : ""}`}
        />
        {unit && <span className="shrink-0 text-sm text-muted-foreground">{unit}</span>}
      </div>
      {help && (
        <p id={helpId} className={hint}>
          {help}
        </p>
      )}
    </div>
  );
}

export function AdSettingsForm({ settings }: { settings: AdSettings }) {
  const s = settings;
  const [f, setF] = useState({
    targetTl: String(s.targetTl),
    stopMultiple: String(s.stopMultiple),
    winMin: String(s.winMin),
    noResultWeeks: String(s.noResultWeeks),
    scaleMaxPct: String(s.scaleMaxPct),
    fatigueFrequency: String(s.fatigueFrequency),
    fatigueCtrDropPct: String(s.fatigueCtrDropPct),
    firstCallMin: String(s.gates.firstCallMin),
    reachPct: String(s.gates.reachPct),
    apptPct: String(s.gates.apptPct),
    showPct: String(s.gates.showPct),
    googleTl: String(s.monthlyBudget.googleTl),
    metaTl: String(s.monthlyBudget.metaTl),
    reelsCaption: String(s.limits.reelsCaption),
    pageTitle: String(s.limits.pageTitle),
    min: String(s.limits.min),
  });
  const [banned, setBanned] = useState(s.banned.join("\n"));
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const bad = (k: string) => message?.kind === "error" && message.field === k;
  const bind = (k: keyof typeof f) => ({ id: `ad-${k}`, invalid: bad(k), value: f[k], onChange: (v: string) => setF((all) => ({ ...all, [k]: v })) });

  // Boş ya da sayı olmayan alan NaN olur; sunucu doğrulaması reddeder.
  const n = (k: keyof typeof f) => (f[k].trim() === "" ? Number.NaN : Number(f[k].replace(",", ".")));

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveAdSettings({
        targetTl: n("targetTl"),
        stopMultiple: n("stopMultiple"),
        winMin: n("winMin"),
        noResultWeeks: n("noResultWeeks"),
        scaleMaxPct: n("scaleMaxPct"),
        fatigueFrequency: n("fatigueFrequency"),
        fatigueCtrDropPct: n("fatigueCtrDropPct"),
        gates: { firstCallMin: n("firstCallMin"), reachPct: n("reachPct"), apptPct: n("apptPct"), showPct: n("showPct") },
        monthlyBudget: { googleTl: n("googleTl"), metaTl: n("metaTl") },
        banned: banned.split("\n"),
        limits: { reelsCaption: n("reelsCaption"), pageTitle: n("pageTitle"), min: n("min") },
      });
      setMessage("error" in result ? { kind: "error", text: result.error, field: result.field } : { kind: "ok", text: "Kaydedildi" });
    });
  }

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-xl font-semibold text-foreground">Hedef ve kurallar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Hedef nitelikli veli maliyeti" unit="TL" {...bind("targetTl")} />
          <NumberField label="Durdurma katı" unit="kat" help="Hedefin bu katı harcanıp hiç nitelikli veli gelmediyse durdurma önerilir (1–10)." decimal {...bind("stopMultiple")} />
          <NumberField label="Kazandı için en az nitelikli veli" unit="veli" {...bind("winMin")} />
          <NumberField label="Sonuçsuz sayılma süresi" unit="hafta" {...bind("noResultWeeks")} />
          <NumberField label="Haftalık büyütme sınırı" unit="%" decimal {...bind("scaleMaxPct")} />
          <NumberField label="Yorgunluk: sıklık eşiği" help="Bundan yüksek sıklık yorgunluk sinyalidir." decimal {...bind("fatigueFrequency")} />
          <NumberField label="Yorgunluk: tıklama oranı düşüşü" unit="%" help="İlk haftaya göre." decimal {...bind("fatigueCtrDropPct")} />
        </div>
      </section>

      <section className={card}>
        <h2 className="text-xl font-semibold text-foreground">Bütçe kapıları</h2>
        <p className={hint}>Bir kapı kırmızıysa panel bütçe artışı önermez.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="İlk arama süresi (ortanca)" unit="dk" help="Yalnız mesai dakikası sayılır (1–240)." {...bind("firstCallMin")} />
          <NumberField label="7 günde ulaşma" unit="%" decimal {...bind("reachPct")} />
          <NumberField label="Nitelikliden randevu" unit="%" decimal {...bind("apptPct")} />
          <NumberField label="Randevuya gelme" unit="%" decimal {...bind("showPct")} />
        </div>
      </section>

      <section className={card}>
        <h2 className="text-xl font-semibold text-foreground">Aylık bütçe</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Google" unit="TL" {...bind("googleTl")} />
          <NumberField label="Meta" unit="TL" {...bind("metaTl")} />
        </div>
      </section>

      <section className={card}>
        <h2 className="text-xl font-semibold text-foreground">İçerik kontrolleri</h2>
        <div>
          <label htmlFor="ad-banned" className="block text-sm font-semibold text-foreground">
            Yasaklı ifadeler
          </label>
          <textarea
            id="ad-banned"
            value={banned}
            onChange={(e) => setBanned(e.target.value)}
            rows={6}
            aria-invalid={bad("banned") || undefined}
            aria-describedby={bad("banned") ? "ad-banned-yardim ad-ayar-hata" : "ad-banned-yardim"}
            className={`${field} mt-2 ${bad("banned") ? "border-destructive" : ""}`}
          />
          <p id="ad-banned-yardim" className={hint}>
            Her satıra bir ifade yazın (2–40 karakter, en fazla 50).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Reels açıklaması" unit="karakter" help="En fazla." {...bind("reelsCaption")} />
          <NumberField label="Sayfa başlığı" unit="karakter" help="En fazla." {...bind("pageTitle")} />
          <NumberField label="Metin alt sınırı" unit="karakter" help="En az." {...bind("min")} />
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Mesai, servis semtleri ve WhatsApp şablonları →{" "}
        <Link href="/ayarlar#aday-hatti" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">
          Ayarlar · Aday hattı
        </Link>
      </p>

      <div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="min-h-14 w-full cursor-pointer rounded-xl bg-primary px-6 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {message?.kind === "ok" && (
          <p role="status" className="mt-2 text-sm font-semibold text-accent">
            {message.text}
          </p>
        )}
        {message?.kind === "error" && (
          <p id="ad-ayar-hata" role="alert" className="mt-2 text-sm font-semibold text-destructive">
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
