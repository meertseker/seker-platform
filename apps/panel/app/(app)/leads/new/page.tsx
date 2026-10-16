"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLead, findLeadByPhone } from "@/actions/leads";
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
    const source = String(formData.get("source") ?? "") as LeadSource;
    const ozelDurum = formData.get("ozelDurum") === "on";

    if (!parentName || !phone || !source) {
      setError("Veli adı, telefon ve kaynak zorunludur.");
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
        <p className="mt-2 text-sm text-muted-foreground">
          Veli iletişim bilgilerini ve çocuğa dair ilk bilgileri girin.
        </p>
      </div>

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
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
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
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
            placeholder="05XX XXX XX XX"
          />
          {checkingPhone ? (
            <p className="mt-2 text-xs font-medium text-muted-foreground">
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
                {duplicate.type === "lead" ? "lead kaydı" : "öğrenci kaydı"}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="source"
              className="block text-sm font-medium text-foreground"
            >
              Kaynak *
            </label>
            <select
              id="source"
              name="source"
              required
              defaultValue=""
              className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="" disabled>
                Kaynak seçin
              </option>
              {sourceKeys.map((source) => (
                <option key={source} value={source}>
                  {label(LEAD_SOURCES, source)}
                </option>
              ))}
            </select>
          </div>

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
              className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Örn. veli referansı"
            />
          </div>
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
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
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
              className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
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
              className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
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
          <label className="flex items-center gap-3 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              name="ingilizceGerekli"
              className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            İngilizce gerekli
          </label>

          <label className="flex items-center gap-3 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              name="wantsSummer"
              className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            Yaz okulu ile ilgileniyor
          </label>

          <div>
            <label className="flex items-center gap-3 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="ozelDurum"
                checked={ozelDurumChecked}
                onChange={(event) => setOzelDurumChecked(event.currentTarget.checked)}
                className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              Özel durum
            </label>
            {ozelDurumChecked ? (
              <input
                id="ozelDurumNote"
                name="ozelDurumNote"
                className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Özel durum notu"
              />
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 w-full cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Kaydediliyor..." : "Veliyi kaydet"}
        </button>
      </form>
    </div>
  );
}
