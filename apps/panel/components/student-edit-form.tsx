"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStudent, updateStudent } from "@/actions/students";
import { PROGRAMS, label, type Program } from "@/lib/constants";

interface StudentEditFormProps {
  student: {
    id: string;
    full_name: string;
    parent_name: string | null;
    phone: string | null;
    program: Program | null;
    birth_month: number | null;
    birth_year: number | null;
    start_date: string | null;
    season: string;
  };
  role: "yonetici" | "danisman";
}

const programKeys = Object.keys(PROGRAMS) as Program[];

export function StudentEditForm({ student, role }: StudentEditFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(student.full_name);
  const [parentName, setParentName] = useState(student.parent_name ?? "");
  const [phone, setPhone] = useState(student.phone ?? "");
  const [program, setProgram] = useState<string>(student.program ?? "");
  const [birthMonth, setBirthMonth] = useState(student.birth_month?.toString() ?? "");
  const [birthYear, setBirthYear] = useState(student.birth_year?.toString() ?? "");
  const [startDate, setStartDate] = useState(student.start_date ?? "");
  const [season, setSeason] = useState(student.season);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateStudent(student.id, {
        fullName,
        parentName: parentName.trim() || null,
        phone: phone.trim() || null,
        program: (program || null) as Program | null,
        birthMonth: birthMonth ? Number(birthMonth) : null,
        birthYear: birthYear ? Number(birthYear) : null,
        startDate: startDate || null,
        season,
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
        `${student.full_name} kalıcı olarak silinsin mi? Öğrencinin tüm ödeme planları ve taksitleri de silinir. Bu işlem geri alınamaz.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStudent(student.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/ogrenciler");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Öğrenci Bilgileri</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Yanlış girilen ad, veli, telefon, program veya tarihleri düzeltin.
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
              Öğrenci adı
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Veli adı
              <input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Anne & Baba"
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Telefon
              <input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Program
              <select
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="">— Belirtilmedi —</option>
                {programKeys.map((key) => (
                  <option key={key} value={key}>
                    {label(PROGRAMS, key)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-foreground">
              Doğum ayı
              <input
                inputMode="numeric"
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                placeholder="1-12"
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Doğum yılı
              <input
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="Örn. 2021"
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Başlangıç tarihi
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Sezon
              <input
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="2026-2027"
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
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
                Öğrenciyi Sil
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
