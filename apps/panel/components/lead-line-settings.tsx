"use client";

import { useState, useTransition } from "react";
import { saveLeadLineSettings } from "@/actions/settings";
import type { LeadFlowSettings } from "@/lib/lead-flow/settings";

const DAYS = [
  { n: 1, label: "Pzt" },
  { n: 2, label: "Sal" },
  { n: 3, label: "Çar" },
  { n: 4, label: "Per" },
  { n: 5, label: "Cum" },
  { n: 6, label: "Cmt" },
  { n: 7, label: "Paz" },
];

const field =
  "w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const hint = "mt-1 text-xs text-muted-foreground";

// Uyarı sistemi (cron) Pzt–Cmt 07:00–19:59 çalışır.
function outsideCron(days: number[], start: string, end: string): boolean {
  return days.includes(7) || start < "07:00" || end > "20:00";
}

export function LeadLineSettings({ settings }: { settings: LeadFlowSettings }) {
  const [days, setDays] = useState<number[]>(settings.hours.days);
  const [start, setStart] = useState(settings.hours.start);
  const [end, setEnd] = useState(settings.hours.end);
  const [districts, setDistricts] = useState(settings.districts.join("\n"));
  const [script, setScript] = useState(settings.callScript.join("\n"));
  const [price, setPrice] = useState(settings.priceAnswer);
  const [templates, setTemplates] = useState(settings.templates);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleDay(n: number) {
    setDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n].sort((a, b) => a - b)));
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveLeadLineSettings({
        hours: { days, start, end },
        districts: districts.split("\n"),
        callScript: script.split("\n"),
        priceAnswer: price,
        templates,
      });
      setMessage("error" in result ? { kind: "error", text: result.error } : { kind: "ok", text: "Kaydedildi" });
    });
  }

  return (
    <section id="aday-hatti" className="scroll-mt-4 space-y-6 rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-foreground">Aday hattı</h2>

      <fieldset>
        <legend className="text-sm font-semibold text-foreground">Mesai</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <label
              key={d.n}
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-input px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-semibold"
            >
              <input type="checkbox" className="size-4 accent-primary" checked={days.includes(d.n)} onChange={() => toggleDay(d.n)} />
              {d.label}
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="text-sm">
            Başlangıç
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${field} mt-1 min-h-11`} />
          </label>
          <label className="text-sm">
            Bitiş
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${field} mt-1 min-h-11`} />
          </label>
        </div>
        <p className={hint}>Bu saatler sayaç, takip sırası ve 15 dakika uyarısı için kullanılır.</p>
        {outsideCron(days, start, end) && (
          <p className="mt-1 text-xs font-semibold text-warning">Uyarı sistemi Pazartesi–Cumartesi 07:00–20:00 arasında çalışır.</p>
        )}
      </fieldset>

      <label className="block text-sm font-semibold text-foreground">
        Servis semtleri
        <textarea value={districts} onChange={(e) => setDistricts(e.target.value)} rows={6} className={`${field} mt-2 font-normal`} />
        <span className={`${hint} block font-normal`}>Her satıra bir semt yazın (en fazla 30).</span>
      </label>

      <label className="block text-sm font-semibold text-foreground">
        Konuşma sırası
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={6}
          placeholder="Merhaba {veli}, ..."
          className={`${field} mt-2 font-normal`}
        />
        <span className={`${hint} block font-normal`}>
          Her satır bir adım (1–10 satır). Yer tutucular: {"{veli} {danisman} {cocuk_yasi} {semt}"}
        </span>
      </label>

      <label className="block text-sm font-semibold text-foreground">
        Fiyat cevabı
        <textarea value={price} onChange={(e) => setPrice(e.target.value)} rows={4} className={`${field} mt-2 font-normal`} />
        <span className={`${hint} block font-normal`}>[ARALIK] ifadesini okulun fiyat aralığıyla değiştirin.</span>
      </label>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">WhatsApp şablonları</h3>
        <p className={hint}>Yer tutucular: {"{veli} {danisman}"}</p>
        {templates.map((t, i) => (
          <div key={t.key} className="space-y-2">
            <label className="block text-sm">
              Ad
              <input
                value={t.label}
                onChange={(e) => setTemplates((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className={`${field} mt-1 min-h-11`}
              />
            </label>
            <label className="block text-sm">
              Metin
              <textarea
                value={t.text}
                onChange={(e) => setTemplates((all) => all.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                rows={3}
                className={`${field} mt-1`}
              />
            </label>
          </div>
        ))}
      </div>

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
    </section>
  );
}
