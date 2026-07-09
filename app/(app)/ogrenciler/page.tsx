import Link from "next/link";
import {
  label,
  PROGRAMS,
  STUDENT_STATUSES,
  type Program,
} from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface StudentsPageProps {
  searchParams: SearchParams;
}

interface InstallmentRow {
  due_date: string;
  amount: number;
  status: "bekliyor" | "odendi";
  paid_amount: number | null;
}

interface PlanRow {
  total_amount: number;
  installments?: InstallmentRow[] | null;
}

interface StudentRow {
  id: string;
  full_name: string;
  parent_name: string;
  phone: string;
  season: string;
  program: Program;
  status: keyof typeof STUDENT_STATUSES;
  payment_plans?: PlanRow[] | null;
}

const statusKeys = Object.keys(STUDENT_STATUSES) as (keyof typeof STUDENT_STATUSES)[];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function cleanSearch(value: string) {
  return value.replace(/[%,]/g, " ").trim();
}

function summary(student: StudentRow, today: string) {
  const plans = student.payment_plans ?? [];
  const totalKurus = plans.reduce(
    (sum, plan) => sum + tlToKurus(Number(plan.total_amount)),
    0,
  );
  const paidKurus = plans.reduce(
    (planSum, plan) =>
      planSum +
      (plan.installments ?? []).reduce((sum, installment) => {
        if (installment.status !== "odendi") return sum;
        return sum + tlToKurus(Number(installment.paid_amount ?? installment.amount));
      }, 0),
    0,
  );
  const overdue = plans.some((plan) =>
    (plan.installments ?? []).some(
      (installment) =>
        installment.status === "bekliyor" && installment.due_date < today,
    ),
  );

  return { totalKurus, paidKurus, overdue };
}

function hrefWith(
  params: { q?: string; durum?: string },
  updates: Record<string, string | undefined>,
) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) next.set(key, value);
  });
  Object.entries(updates).forEach(([key, value]) => {
    if (value) next.set(key, value);
    else next.delete(key);
  });
  const query = next.toString();
  return query ? `/ogrenciler?${query}` : "/ogrenciler";
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams;
  const q = cleanSearch(first(params.q) ?? "");
  const durumParam = first(params.durum) ?? "";
  const durum = statusKeys.includes(durumParam as keyof typeof STUDENT_STATUSES)
    ? (durumParam as keyof typeof STUDENT_STATUSES)
    : "";
  const supabase = await createServerSupabase();
  const today = todayInIstanbul();

  let query = supabase
    .from("students")
    .select(
      "id, full_name, parent_name, phone, season, program, status, payment_plans(total_amount, installments(due_date, amount, status, paid_amount))",
    )
    .order("full_name", { ascending: true });

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,parent_name.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  if (durum) query = query.eq("status", durum);

  const { data, error } = await query;
  const students = (data ?? []) as unknown as StudentRow[];
  const currentParams = { q: q || undefined, durum: durum || undefined };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-500">Öğrenci takip</p>
        <h1 className="mt-1 text-3xl font-semibold">Öğrenciler</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Kayıtları, programları ve ödeme durumlarını buradan takip edin.
        </p>
      </div>

      <form
        action="/ogrenciler"
        className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
      >
        <label className="block text-sm font-medium text-zinc-700">
          Arama
          <input
            name="q"
            defaultValue={q}
            placeholder="Öğrenci, veli veya telefon"
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Durum
          <select
            name="durum"
            defaultValue={durum}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="">Tüm durumlar</option>
            {statusKeys.map((status) => (
              <option key={status} value={status}>
                {label(STUDENT_STATUSES, status)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Filtrele
        </button>
      </form>

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Öğrenciler yüklenemedi.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Öğrenci</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Sezon</th>
              <th className="px-4 py-3">Ödeme</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {students.map((student) => {
              const payment = summary(student, today);

              return (
                <tr key={student.id} className="transition hover:bg-zinc-50">
                  <td className="px-4 py-4">
                    <Link
                      href={`/ogrenciler/${student.id}`}
                      className="font-semibold text-zinc-950 hover:underline"
                    >
                      {student.full_name}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {student.parent_name} - {student.phone}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-zinc-700">
                    {label(PROGRAMS, student.program)}
                  </td>
                  <td className="px-4 py-4 text-zinc-700">{student.season}</td>
                  <td className="px-4 py-4">
                    <span className="font-semibold text-zinc-950">
                      {formatTRY(payment.paidKurus)} / {formatTRY(payment.totalKurus)}
                    </span>
                    {payment.overdue ? (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Geciken
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      {label(STUDENT_STATUSES, student.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-500">
                  Öğrenci bulunamadı.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {(q || durum) && students.length > 0 ? (
        <Link
          href={hrefWith(currentParams, { q: undefined, durum: undefined })}
          className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
        >
          Filtreleri temizle
        </Link>
      ) : null}
    </div>
  );
}
