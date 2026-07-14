import Link from "next/link";
import { notFound } from "next/navigation";
import {
  InstallmentTable,
  type InstallmentTableItem,
} from "@/components/installment-table";
import { PlanWizard } from "@/components/plan-wizard";
import {
  ITEM_TYPES,
  label,
  PROGRAMS,
  STUDENT_STATUSES,
  type ItemType,
  type PaymentMethod,
  type Program,
} from "@/lib/constants";
import { getSessionProfile } from "@/lib/auth";
import { formatTRY, tlToKurus } from "@/lib/money";
import { badgeClass, STUDENT_STATUS_STYLES } from "@/lib/status-styles";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface StudentDetailPageProps {
  params: Params;
  searchParams: SearchParams;
}

interface InstallmentRow {
  id: string;
  due_date: string;
  amount: number;
  status: "bekliyor" | "odendi";
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: PaymentMethod | null;
}

interface PlanRow {
  id: string;
  season: string;
  item_type: ItemType;
  total_amount: number;
  installment_count: number;
  source_offer_id: string | null;
  created_at: string;
  installments?: InstallmentRow[] | null;
}

interface StudentRow {
  id: string;
  full_name: string;
  birth_month: number | null;
  birth_year: number | null;
  parent_name: string;
  phone: string;
  season: string;
  program: Program;
  start_date: string | null;
  status: keyof typeof STUDENT_STATUSES;
  payment_plans?: PlanRow[] | null;
}

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

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function formatDate(date: string | null) {
  if (!date) return "Belirtilmedi";
  return dateFormatter.format(new Date(`${date}T12:00:00+03:00`));
}

function formatBirth(month: number | null, year: number | null) {
  const paddedMonth = month?.toString().padStart(2, "0");
  const value = [paddedMonth, year].filter(Boolean).join("/");
  return value || "Belirtilmedi";
}

function paidSummary(installments: InstallmentRow[] | null | undefined) {
  return (installments ?? []).reduce((sum, installment) => {
    if (installment.status !== "odendi") return sum;
    return sum + tlToKurus(Number(installment.paid_amount ?? installment.amount));
  }, 0);
}

function toInstallmentItems(rows: InstallmentRow[] | null | undefined): InstallmentTableItem[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    due_date: row.due_date,
    amount: Number(row.amount),
    status: row.status,
    paid_at: row.paid_at,
    paid_amount: row.paid_amount === null ? null : Number(row.paid_amount),
    payment_method: row.payment_method,
  }));
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: StudentDetailPageProps) {
  const [{ id }, queryParams, profile] = await Promise.all([
    params,
    searchParams,
    getSessionProfile(),
  ]);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, full_name, birth_month, birth_year, parent_name, phone, season, program, start_date, status, payment_plans(id, season, item_type, total_amount, installment_count, source_offer_id, created_at, installments(id, due_date, amount, status, paid_at, paid_amount, payment_method))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const student = data as unknown as StudentRow;
  const plans = [...(student.payment_plans ?? [])].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const today = todayInIstanbul();
  const totalKurus = plans.reduce(
    (sum, plan) => sum + tlToKurus(Number(plan.total_amount)),
    0,
  );
  const paidKurus = plans.reduce(
    (sum, plan) => sum + paidSummary(plan.installments),
    0,
  );
  const initialTotal = Number(first(queryParams.total));
  const initialCount = Number(first(queryParams.count));
  const initialOpen = first(queryParams.plan) === "1";
  const sourceOfferId = first(queryParams.offer);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/ogrenciler"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Öğrenci listesine dön
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">{student.full_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Öğrenci bilgileri, ödeme planları ve taksit hareketleri.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Öğrenci</p>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">
              {student.full_name}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {label(PROGRAMS, student.program)} - {student.season}
            </p>
          </div>
          <span className={`w-fit ${badgeClass(STUDENT_STATUS_STYLES[student.status])}`}>
            {label(STUDENT_STATUSES, student.status)}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Veli</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {student.parent_name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Telefon</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {student.phone}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Doğum</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {formatBirth(student.birth_month, student.birth_year)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Başlangıç</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {formatDate(student.start_date)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Ödenen</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {formatTRY(paidKurus)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Plan toplamı</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {formatTRY(totalKurus)}
            </dd>
          </div>
        </dl>
      </section>

      <PlanWizard
        studentId={student.id}
        initialOpen={initialOpen}
        initialTotalTl={Number.isFinite(initialTotal) ? initialTotal : undefined}
        initialInstallmentCount={
          Number.isInteger(initialCount) && initialCount >= 1 && initialCount <= 12
            ? initialCount
            : undefined
        }
        sourceOfferId={sourceOfferId}
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Planlar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Her plan kendi taksitleriyle birlikte takip edilir.
          </p>
        </div>

        {plans.length > 0 ? (
          <div className="space-y-4">
            {plans.map((plan) => {
              const planPaid = paidSummary(plan.installments);
              const planTotal = tlToKurus(Number(plan.total_amount));

              return (
                <article
                  key={plan.id}
                  className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {label(ITEM_TYPES, plan.item_type)}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {plan.season} - {plan.installment_count} taksit
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatTRY(planPaid)} / {formatTRY(planTotal)}
                      </p>
                      {plan.source_offer_id ? (
                        <p className="mt-1 text-xs text-muted-foreground">Onaylı tekliften oluşturuldu</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5">
                    <InstallmentTable
                      installments={toInstallmentItems(plan.installments)}
                      role={profile.role}
                      today={today}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            Henüz ödeme planı yok.
          </p>
        )}
      </section>
    </div>
  );
}
