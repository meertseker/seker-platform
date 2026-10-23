"use client";

// Z6 "Reklam şablonu · bir kez doldurulur" (K19): kitle merkezi, yarıçap, yaş, günlük bütçeler, haftalık sınır.
// Doğrulama sunucuda (`saveAdTemplate` → `validateAdTemplate`); istemci yalnız metni sayıya çevirir.

import { useState, useTransition } from "react";
import { saveAdTemplate } from "@/actions/ad-setup";
import type { AdTemplateInput } from "@/lib/ads/ad-template";
import { formToTemplateInput } from "@/lib/ads/ad-template-form";

const field =
  "min-h-11 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const label = "block text-sm font-semibold text-foreground";
const hint = "mt-1 text-xs text-muted-foreground";
const card = "space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6";
const ERROR_ID = "ad-sablon-hata";

type Key = "okulAdres" | "lat" | "lng" | "yaricapKm" | "yasMin" | "yasMax" | "testGunlukTl" | "buyutmeGunlukTl" | "haftalikYeniReklam";

function describedBy(...ids: (string | undefined | false)[]): string | undefined {
  const s = ids.filter(Boolean).join(" ");
  return s || undefined;
}

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  help?: string;
  decimal?: boolean;
  placeholder?: string;
  hasError: boolean;
};

function TextField({ id, label: text, value, onChange, unit, help, decimal, placeholder, hasError }: TextFieldProps) {
  const helpId = help ? `${id}-yardim` : undefined;
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy(helpId, hasError && ERROR_ID)}
          className={field}
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

function FixedRow({ title, value, help }: { title: string; value: string; help?: string }) {
  return (
    <div>
      <p className={label}>{title}</p>
      <p className="mt-1 flex min-h-11 items-center rounded-xl bg-muted px-3 text-sm text-foreground">{value}</p>
      {help && <p className={hint}>{help}</p>}
    </div>
  );
}

export function AdTemplateForm({ template, updatedText }: { template: AdTemplateInput; updatedText: string | null }) {
  const t = template;
  const [f, setF] = useState<Record<Key, string>>({
    okulAdres: t.okulAdres,
    lat: t.lat === null ? "" : String(t.lat),
    lng: t.lng === null ? "" : String(t.lng),
    yaricapKm: String(t.yaricapKm),
    yasMin: String(t.yasMin),
    yasMax: String(t.yasMax),
    testGunlukTl: String(t.testGunlukTl),
    buyutmeGunlukTl: String(t.buyutmeGunlukTl),
    haftalikYeniReklam: String(t.haftalikYeniReklam),
  });
  const [exclude, setExclude] = useState(t.mevcutVelileriHaricTut);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const hasError = message?.kind === "error";

  const set = (k: Key) => (v: string) => setF((all) => ({ ...all, [k]: v }));
  const bind = (k: Key) => ({ id: `ad-sablon-${k}`, value: f[k], hasError, onChange: set(k) });

  function save() {
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveAdTemplate(formToTemplateInput({ ...f, mevcutVelileriHaricTut: exclude }));
        setMessage("error" in result ? { kind: "error", text: result.error } : { kind: "ok", text: result.message });
      } catch {
        setMessage({ kind: "error", text: "Şablon kaydedilemedi, tekrar deneyin." });
      }
    });
  }

  return (
    <section aria-labelledby="ad-sablon-baslik" className={card}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <h2 id="ad-sablon-baslik" className="text-xl font-semibold text-foreground">
          Reklam şablonu · bir kez doldurulur
        </h2>
        {updatedText && <p className="text-xs text-muted-foreground">{updatedText}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="ad-sablon-okulAdres" className={label}>
            Kitle merkezi (okul adresi)
          </label>
          <input
            id="ad-sablon-okulAdres"
            type="text"
            autoComplete="off"
            value={f.okulAdres}
            onChange={(e) => set("okulAdres")(e.target.value)}
            aria-describedby={describedBy("ad-sablon-okulAdres-yardim", hasError && ERROR_ID)}
            className={`${field} mt-1`}
          />
          <p id="ad-sablon-okulAdres-yardim" className={hint}>
            Reklam bu adresin çevresinde gösterilir.
          </p>
        </div>
        <TextField label="Enlem" placeholder="41,0123" decimal {...bind("lat")} />
        <TextField label="Boylam" placeholder="28,6401" decimal help="Haritada okulun üstüne sağ tıklayınca görünen iki sayı." {...bind("lng")} />
        <TextField label="Yarıçap" unit="km" help="Servis semtlerinin hepsi içinde kalır." {...bind("yaricapKm")} />
        <fieldset className="min-w-0">
          <legend className={label}>Yaş aralığı</legend>
          <div className="mt-1 flex items-center gap-2">
            <label htmlFor="ad-sablon-yasMin" className="sr-only">
              En küçük yaş
            </label>
            <input
              id="ad-sablon-yasMin"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={f.yasMin}
              onChange={(e) => set("yasMin")(e.target.value)}
              aria-describedby={describedBy("ad-sablon-yas-yardim", hasError && ERROR_ID)}
              className={`${field} min-w-0`}
            />
            <span aria-hidden="true" className="text-muted-foreground">
              –
            </span>
            <label htmlFor="ad-sablon-yasMax" className="sr-only">
              En büyük yaş
            </label>
            <input
              id="ad-sablon-yasMax"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={f.yasMax}
              onChange={(e) => set("yasMax")(e.target.value)}
              aria-describedby={describedBy("ad-sablon-yas-yardim", hasError && ERROR_ID)}
              className={`${field} min-w-0`}
            />
          </div>
          <p id="ad-sablon-yas-yardim" className={hint}>
            Kadın + erkek; ilgi alanı seçilmez (geniş hedefleme).
          </p>
        </fieldset>
        <TextField label="Test kampanyası günlük bütçe" unit="TL" help="Yeni içerikler bu bütçeyi paylaşır." {...bind("testGunlukTl")} />
        <TextField label="Büyütme kampanyası günlük bütçe" unit="TL" help="Haftada en çok %20 artar (kurallar sekmesi)." {...bind("buyutmeGunlukTl")} />
        <TextField label="Haftalık en çok yeni reklam" unit="reklam" help="Hesap güvenliği için; varsayılan 4." {...bind("haftalikYeniReklam")} />
        <FixedRow title="Kampanya hedefi" value="Lead · web formu (piksel)" help="Meta, form dolduranlara benzeyenlere gösterir." />
        <div>
          <p id="ad-sablon-dis-baslik" className={label}>
            Mevcut velileri dışla
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={exclude}
            aria-labelledby="ad-sablon-dis-baslik"
            aria-describedby="ad-sablon-dis-yardim"
            onClick={() => setExclude((v) => !v)}
            className="mt-1 flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>{exclude ? "Evet · yazılı onaylı veli listesi" : "Hayır"}</span>
            <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${exclude ? "bg-accent" : "bg-input"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-all ${exclude ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </button>
          <p id="ad-sablon-dis-yardim" className={hint}>
            Şifreli telefonlarla &quot;mevcut müşteri&quot; kitlesi; bütçe boşa gitmez.
          </p>
        </div>
        <FixedRow title="Reklam düğmesi" value="Daha fazla bilgi" />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs text-muted-foreground">
          Zehra her reklamda bunları görür, değiştirmez. Değişiklik yalnız yönetici; eski ve yeni değer kayda geçer. Reklam adı, bağlantı etiketi ve
          içerik kodu şablonda yok: panel her zaman kendi yazar.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="min-h-14 w-full shrink-0 cursor-pointer rounded-xl bg-primary px-6 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
      <div aria-live="polite">
        {message?.kind === "ok" && (
          <p role="status" className="text-sm font-semibold text-accent">
            {message.text}
          </p>
        )}
        {message?.kind === "error" && (
          <p id={ERROR_ID} role="alert" className="text-sm font-semibold text-destructive">
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
