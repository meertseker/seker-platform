"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveAdSettings } from "@/actions/ad-settings";
import type { AdSettings } from "@/lib/ads/ad-settings";

const field =
  "w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const hint = "mt-1 text-xs text-muted-foreground";
const card = "space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6";

type NumberFieldProps = { label: string; value: string; onChange: (v: string) => void; unit?: string; help?: string };

function NumberField({ label, value, onChange, unit, help }: NumberFieldProps) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${field} min-h-11 font-normal`}
        />
        {unit && <span className="shrink-0 text-sm font-normal text-muted-foreground">{unit}</span>}
      </span>
      {help && <span className={`${hint} block font-normal`}>{help}</span>}
    </label>
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
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (v: string) => setF((all) => ({ ...all, [k]: v })) });

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
      setMessage("error" in result ? { kind: "error", text: result.error } : { kind: "ok", text: "Kaydedildi" });
    });
  }

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-xl font-semibold text-foreground">Hedef ve kurallar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Hedef nitelikli veli maliyeti" unit="TL" {...bind("targetTl")} />
          <NumberField label="Durdurma katı" unit="kat" help="Hedefin bu katı harcanıp hiç nitelikli veli gelmediyse durdurma önerilir (1–10)." {...bind("stopMultiple")} />
          <NumberField label="Kazandı için en az nitelikli veli" unit="veli" {...bind("winMin")} />
          <NumberField label="Sonuçsuz sayılma süresi" unit="hafta" {...bind("noResultWeeks")} />
          <NumberField label="Haftalık büyütme sınırı" unit="%" {...bind("scaleMaxPct")} />
          <NumberField label="Yorgunluk: sıklık eşiği" help="Bundan yüksek sıklık yorgunluk sinyalidir." {...bind("fatigueFrequency")} />
          <NumberField label="Yorgunluk: tıklama oranı düşüşü" unit="%" help="İlk haftaya göre." {...bind("fatigueCtrDropPct")} />
        </div>
      </section>

      <section className={card}>
        <h2 className="text-xl font-semibold text-foreground">Bütçe kapıları</h2>
        <p className={hint}>Bir kapı kırmızıysa panel bütçe artışı önermez.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="İlk arama süresi (ortanca)" unit="dk" help="Yalnız mesai dakikası sayılır (1–240)." {...bind("firstCallMin")} />
          <NumberField label="7 günde ulaşma" unit="%" {...bind("reachPct")} />
          <NumberField label="Nitelikliden randevu" unit="%" {...bind("apptPct")} />
          <NumberField label="Randevuya gelme" unit="%" {...bind("showPct")} />
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
        <label className="block text-sm font-semibold text-foreground">
          Yasaklı ifadeler
          <textarea value={banned} onChange={(e) => setBanned(e.target.value)} rows={6} className={`${field} mt-2 font-normal`} />
          <span className={`${hint} block font-normal`}>Her satıra bir ifade yazın (2–40 karakter, en fazla 50).</span>
        </label>
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
        {message && (
          <p role="status" className={`mt-2 text-sm font-semibold ${message.kind === "ok" ? "text-accent" : "text-destructive"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
