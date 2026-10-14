"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLead, updateLead } from "@/actions/leads";
import { LEAD_SOURCES, label, type LeadSource } from "@/lib/constants";

interface LeadEditFormProps {
  lead: {
    id: string;
    parent_name: string;
    phone: string;
    source: LeadSource;
    source_detail: string | null;
    child_name: string | null;
    child_birth_month: number | null;
    child_birth_year: number | null;
    ingilizce_gerekli: boolean;
    ozel_durum: boolean;
    ozel_durum_note: string | null;
    wants_summer: boolean;
  };
  role: "yonetici" | "danisman";
}

const sourceKeys = Object.keys(LEAD_SOURCES) as LeadSource[];

const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15";

export function LeadEditForm({ lead, role }: LeadEditFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [parentName, setParentName] = useState(lead.parent_name);
  const [phone, setPhone] = useState(lead.phone);
  const [source, setSource] = useState<LeadSource>(lead.source);
  const [sourceDetail, setSourceDetail] = useState(lead.source_detail ?? "");
  const [childName, setChildName] = useState(lead.child_name ?? "");
  const [birthMonth, setBirthMonth] = useState(lead.child_birth_month?.toString() ?? "");
  const [birthYear, setBirthYear] = useState(lead.child_birth_year?.toString() ?? "");
  const [ingilizce, setIngilizce] = useState(lead.ingilizce_gerekli);
  const [ozelDurum, setOzelDurum] = useState(lead.ozel_durum);
  const [ozelDurumNote, setOzelDurumNote] = useState(lead.ozel_durum_note ?? "");
  const [wantsSummer, setWantsSummer] = useState(lead.wants_summer);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateLead(lead.id, {
        parentName,
        phone,
        source,
        sourceDetail: sourceDetail.trim() || null,
        childName: childName.trim() || null,
        childBirthMonth: birthMonth ? Number(birthMonth) : null,
        childBirthYear: birthYear ? Number(birthYear) : null,
        ingilizceGerekli: ingilizce,
        ozelDurum,
        ozelDurumNote: ozelDurum ? ozelDurumNote.trim() || null : null,
        wantsSummer,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (
      !window.confirm(
        `${lead.parent_name} lead'i kalıcı olarak silinsin mi? Bağlı randevu, teklif ve notlar da silinir. Bu işlem geri alınamaz.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteLead(lead.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/pipeline");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Lead Bilgileri</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Yanlış girilen veli adı, telefon, kaynak veya çocuk bilgisini düzeltin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? "Vazgeç" : "Düzenle"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-foreground">
              Veli adı
              <input value={parentName} onChange={(e) => setParentName(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Telefon
              <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XX XX" className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Kaynak
              <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} className={inputClass}>
                {sourceKeys.map((key) => (
                  <option key={key} value={key}>
                    {label(LEAD_SOURCES, key)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-foreground">
              Çocuk adı
              <input value={childName} onChange={(e) => setChildName(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Doğum ayı
              <input inputMode="numeric" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} placeholder="1-12" className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Doğum yılı
              <input inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="Örn. 2021" className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-foreground sm:col-span-2">
              Kaynak detayı / not
              <input value={sourceDetail} onChange={(e) => setSourceDetail(e.target.value)} placeholder="Örn. referans adı" className={inputClass} />
            </label>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" checked={ingilizce} onChange={(e) => setIngilizce(e.target.checked)} className="size-4" />
              İngilizce
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" checked={wantsSummer} onChange={(e) => setWantsSummer(e.target.checked)} className="size-4" />
              Yaz okulu
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" checked={ozelDurum} onChange={(e) => setOzelDurum(e.target.checked)} className="size-4" />
              Özel durum
            </label>
          </div>
          {ozelDurum ? (
            <label className="block text-sm font-medium text-foreground">
              Özel durum notu
              <input value={ozelDurumNote} onChange={(e) => setOzelDurumNote(e.target.value)} className={inputClass} />
            </label>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">{error}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </button>
            {role === "yonetici" ? (
              <button
                type="button"
                onClick={remove}
                disabled={isPending}
                className="ml-auto min-h-11 cursor-pointer rounded-xl border border-red-200 bg-destructive-soft px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-50"
              >
                Lead&apos;i Sil
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
