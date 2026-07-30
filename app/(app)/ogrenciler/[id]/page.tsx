import Link from "next/link";
import { notFound } from "next/navigation";
import {
  InstallmentTable,
  type InstallmentTableItem,
} from "@/components/installment-table";
import { PlanWizard } from "@/components/plan-wizard";
import { RefundPanel, type RefundItem } from "@/components/refund-panel";
import { StudentLeaveForm } from "@/components/student-leave-form";
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
  status: "bekliyor" | "odendi" | "iptal";
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
  parent_name: string | null;
  phone: string | null;
  season: string;
  program: Program | null;
  start_date: string | null;
  status: keyof typeof STUDENT_STATUSES;
  left_date: string | null;
  leave_reason: string | null;
  payment_plans?: PlanRow[] | null;
}

interface RefundRow {
  id: string;
  amount: number;
  method: PaymentMethod;
  refund_date: string;
  note: string | null;
  creator: { full_name: string } | { full_name: string }[] | null;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function toRefundItems(rows: RefundRow[] | null | undefined): RefundItem[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    method: row.method,
    refund_date: row.refund_date,
    note: row.note,
    creatorName: one(row.creator)?.full_name ?? null,
  }));
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
      "id, full_name, birth_month, birth_year, parent_name, phone, season, program, start_date, status, left_date, leave_reason, payment_plans(id, season, item_type, total_amount, installment_count, source_offer_id, created_at, installments(id, due_date, amount, status, paid_at, paid_amount, payment_method))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const student = data as unknown as StudentRow;
  const plans = [...(student.payment_plans ?? [])].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );

  const refunds =
    student.status === "ayrildi"
      ? toRefundItems(
          (
            await supabase
              .from("refunds")
              .select(
                "id, amount, method, refund_date, note, creator:profiles!refunds_created_by_fkey(full_name)",
              )
              .eq("student_id", student.id)
              .order("refund_date", { ascending: false })
          ).data as unknown as RefundRow[] | null,
        )
      : [];

  const today = todayInIstanbul();
  const totalKurus = plans.reduce(
    (sum, plan) => sum + tlToKurus(Number(plan.total_amount)),
    0,
  );
  const paidKurus = plans.reduce(
    (sum, plan) => sum + paidSummary(plan.installments),
    0,
  );

  // Tüm planların taksitlerini TEK takvimde topla (kalem etiketiyle) — aya göre gruplanır.
  const scheduleItems = plans.flatMap((plan) =>
    toInstallmentItems(plan.installments).map((item) => ({
      ...item,
      itemLabel: label(ITEM_TYPES, plan.item_type),
    })),
  );

  // Okulun ilk baktığı rakamlar: bu ay ödenecek · geciken · kalan.
  const currentMonthPrefix = today.slice(0, 7);
  let kalanKurus = 0;
  let gecikenKurus = 0;
  let buAyKurus = 0;
  for (const plan of plans) {
    for (const inst of plan.installments ?? []) {
      if (inst.status !== "bekliyor") continue;
      const kurus = tlToKurus(Number(inst.amount));
      kalanKurus += kurus;
      if (inst.due_date < today) gecikenKurus += kurus;
      if (inst.due_date.slice(0, 7) === currentMonthPrefix) buAyKurus += kurus;
    }
  }

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
          ← Öğrenci listesi
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{student.full_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {student.program ? label(PROGRAMS, student.program) : "Program eklenmedi"} · {student.season}
            </p>
          </div>
          <span className={`w-fit ${badgeClass(STUDENT_STATUS_STYLES[student.status])}`}>
            {label(STUDENT_STATUSES, student.status)}
          </span>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Veli</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {student.parent_name ?? "Eklenmedi"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Telefon</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {student.phone ?? "Eklenmedi"}
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
          {student.status === "ayrildi" ? (
            <>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Ayrılış tarihi</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {formatDate(student.left_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Ayrılış nedeni</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {student.leave_reason || "Belirtilmedi"}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      {student.status === "aktif" && profile.role === "yonetici" ? (
        <StudentLeaveForm studentId={student.id} />
      ) : null}

      {student.status === "ayrildi" ? (
        <RefundPanel
          studentId={student.id}
          canManage={profile.role === "yonetici"}
          refunds={refunds}
        />
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Ödeme Takvimi</h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted-foreground">Bu ay ödenecek</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {formatTRY(buAyKurus)}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              gecikenKurus > 0 ? "border-red-200 bg-destructive-soft" : "border-border bg-surface"
            }`}
          >
            <p className="text-xs font-medium text-muted-foreground">Geciken</p>
            <p
              className={`mt-1 text-lg font-semibold tabular-nums ${
                gecikenKurus > 0 ? "text-red-700" : "text-foreground"
              }`}
            >
              {formatTRY(gecikenKurus)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted-foreground">Kalan</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {formatTRY(kalanKurus)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted-foreground">Toplam</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {formatTRY(totalKurus)}
            </p>
          </div>
        </div>

        {scheduleItems.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Tüm ödemeler tek listede, aya göre gruplu. Her satırda “Ödendi işaretle” ile tahsilatı kaydedin.
            </p>
            <InstallmentTable
              installments={scheduleItems}
              role={profile.role}
              today={today}
              showItemColumn
            />
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            Henüz ödeme planı yok. Aşağıdan “Plan oluştur” ile ekleyebilirsiniz.
          </p>
        )}
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
    </div>
  );
}
