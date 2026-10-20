"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCirclePlus } from "lucide-react";
import { createLead, findLeadByPhone } from "@/actions/leads";
import { MESSAGE_LEAD_HREF } from "@/lib/lead-routes";
import {
  label,
  LEAD_SOURCES,
  type LeadSource,
} from "@/lib/constants";

const sourceKeys = Object.keys(LEAD_SOURCES) as LeadSource[];
const birthYears = Array.from({ length: 26 }, (_, index) => 2010 + index);
const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  timeZone: "Europe/Istanbul",
});

type DuplicateWarning =
  | { type: "lead"; id: string }
  | { type: "student"; id: string }
  | null;

function monthName(month: number) {
  return monthFormatter.format(new Date(Date.UTC(2026, month - 1, 1)));
}

function optionalNumber(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}

export default function NewLeadPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateWarning>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [ozelDurumChecked, setOzelDurumChecked] = useState(false);
  const [source, setSource] = useState<LeadSource | "">("");

  async function checkPhone(phone: string) {
    setDuplicate(null);
    if (!phone.trim()) return;

    setCheckingPhone(true);
    const result = await findLeadByPhone(phone);
    setCheckingPhone(false);

    if (result.leadId) {
      setDuplicate({ type: "lead", id: result.leadId });
      return;
    }
    if (result.studentId) {
      setDuplicate({ type: "student", id: result.studentId });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const parentName = String(formData.get("parentName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    const ozelDurum = formData.get("ozelDurum") === "on";

    if (!parentName || !phone || !source) {
      setError("Veli adı, telefon ve nereden geldiği zorunlu.");
      return;
    }

    startTransition(async () => {
      const result = await createLead({
        parentName,
        phone,
        source,
        sourceDetail: String(formData.get("sourceDetail") ?? "").trim(),
        childName: String(formData.get("childName") ?? "").trim(),
        childBirthMonth: optionalNumber(formData.get("childBirthMonth")),
        childBirthYear: optionalNumber(formData.get("childBirthYear")),
        ingilizceGerekli: formData.get("ingilizceGerekli") === "on",
        ozelDurum,
        ozelDurumNote: ozelDurum
          ? String(formData.get("ozelDurumNote") ?? "").trim()
          : undefined,
        wantsSummer: formData.get("wantsSummer") === "on",
      });

      if (result.error || !result.id) {
        setError(result.error ?? "Veli kaydedilemedi, lütfen tekrar deneyin.");
        return;
      }

      router.push(`/leads/${result.id}`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <Link
          href="/pipeline"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Veliler
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Yeni veli</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Ad, telefon ve nereden geldiği yeterli. Gerisini sonra ekleyebilirsin.
        </p>
      </div>

      <Link
        href={MESSAGE_LEAD_HREF}
        className="flex min-h-14 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-input/60 bg-surface px-4 text-[15px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageCirclePlus aria-hidden className="size-5" />
        {"Instagram / WhatsApp'tan mı yazdı? Hızlı ekle"}
      </Link>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
      >
        <div>
          <label
            htmlFor="parentName"
            className="block text-sm font-medium text-foreground"
          >
            Veli adı *
          </label>
          <input
            id="parentName"
            name="parentName"
            required
            autoComplete="name"
            className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/30"
            placeholder="Ayşe Yılmaz"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-foreground"
          >
            Telefon *
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            onBlur={(event) => checkPhone(event.currentTarget.value)}
            className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/30"
            placeholder="05XX XXX XX XX"
          />
          {checkingPhone ? (
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Numara kontrol ediliyor...
            </p>
          ) : null}
          {duplicate ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-warning-soft px-4 py-3 text-sm font-medium text-amber-900">
              Bu numara kayıtlı:{" "}
              <Link
                href={
                  duplicate.type === "lead"
                    ? `/leads/${duplicate.id}`
                    : `/ogrenciler/${duplicate.id}`
                }
                className="underline"
              >
                {duplicate.type === "lead" ? "veli kaydı" : "öğrenci kaydı"}
              </Link>
            </div>
          ) : null}
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-foreground">
            Nereden geldi? *
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {sourceKeys.map((key) => {
              const selected = source === key;
              return (
                <label
                  key={key}
                  className={`inline-flex min-h-12 cursor-pointer items-center rounded-full border px-4 text-base font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                    selected
                      ? "border-primary bg-primary text-on-primary"
                      : "border-border bg-surface text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="source"
                    value={key}
                    checked={selected}
                    onChange={() => setSource(key)}
                    className="sr-only"
                  />
                  {label(LEAD_SOURCES, key)}
                </label>
              );
            })}
          </div>
        </fieldset>

        <details className="group rounded-xl border border-border">
          <summary className="flex min-h-12 cursor-pointer list-none items-center rounded-xl px-4 py-3 text-base font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">＋ Çocuk bilgisi ve notlar ekle</span>
            <span className="hidden group-open:inline">Çocuk bilgisi ve notlar</span>
          </summary>
          <div className="space-y-5 px-4 pb-4">
            <div>
              <label
                htmlFor="sourceDetail"
                className="block text-sm font-medium text-foreground"
              >
                Kaynak detayı
              </label>
              <input
                id="sourceDetail"
                name="sourceDetail"
                className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/30"
                placeholder="Örn. veli referansı"
              />
            </div>

            <div>
              <label
                htmlFor="childName"
                className="block text-sm font-medium text-foreground"
              >
                Çocuk adı
              </label>
              <input
                id="childName"
                name="childName"
                className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/30"
                placeholder="Deniz"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="childBirthMonth"
                  className="block text-sm font-medium text-foreground"
                >
                  Doğum ayı
                </label>
                <select
                  id="childBirthMonth"
                  name="childBirthMonth"
                  defaultValue=""
                  className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Ay seçin</option>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (month) => (
                      <option key={month} value={month}>
                        {monthName(month)}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="childBirthYear"
                  className="block text-sm font-medium text-foreground"
                >
                  Doğum yılı
                </label>
                <select
                  id="childBirthYear"
                  name="childBirthYear"
                  defaultValue=""
                  className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Yıl seçin</option>
                  {birthYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
              <label className="flex min-h-12 items-center gap-3 text-base font-medium text-foreground">
                <input
                  type="checkbox"
                  name="ingilizceGerekli"
                  className="size-5 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                İngilizce gerekli
              </label>

              <label className="flex min-h-12 items-center gap-3 text-base font-medium text-foreground">
                <input
                  type="checkbox"
                  name="wantsSummer"
                  className="size-5 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                Yaz okulu ile ilgileniyor
              </label>

              <div>
                <label className="flex min-h-12 items-center gap-3 text-base font-medium text-foreground">
                  <input
                    type="checkbox"
                    name="ozelDurum"
                    checked={ozelDurumChecked}
                    onChange={(event) => setOzelDurumChecked(event.currentTarget.checked)}
                    className="size-5 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  Özel durum
                </label>
                {ozelDurumChecked ? (
                  <input
                    id="ozelDurumNote"
                    name="ozelDurumNote"
                    className="mt-2 block min-h-12 w-full rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/30"
                    placeholder="Özel durum notu"
                  />
                ) : null}
              </div>
            </div>

          </div>
        </details>

        {error ? (
          <p className="rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="min-h-14 w-full cursor-pointer rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Kaydediliyor..." : "Veliyi kaydet"}
        </button>
      </form>
    </div>
  );
}
