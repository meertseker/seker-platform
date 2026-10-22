import { initialMonthlyFromQuery } from "@/lib/offer-plan";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  InstallmentTable,
  type InstallmentTableItem,
} from "@/components/installment-table";
import { EnrollmentPlanButton } from "@/components/enrollment-plan-form";
import { PaymentDayControl } from "@/components/payment-day-control";
import { PaymentHistory } from "@/components/payment-history";
import { PaymentMatrixCell, PaymentPanelButton, PaymentPanelHost } from "@/components/payment-matrix-cell";
import { PlanWizard } from "@/components/plan-wizard";
import { ReminderButton } from "@/components/reminder-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { StudentEditForm } from "@/components/student-edit-form";
import { RefundPanel, type RefundItem } from "@/components/refund-panel";
import { StudentLeaveForm } from "@/components/student-leave-form";
import { PromiseBadge, VeliGorusmeleriList } from "@/components/veli-gorusmeleri";
import { VeliGorusmesiForm } from "@/components/veli-gorusmesi-form";
import { fetchGorusmeler } from "@/lib/queries/veli-gorusmeleri";
import { openPromises } from "@/lib/veli-gorusmesi";
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
import { formatTRY } from "@/lib/money";
import { buildPaymentHistory } from "@/lib/payment-history";
import { collectedKurus, overdueKurus, receivableKurus, sumKurus } from "@/lib/queries/money";
import { fetchPaymentEvents } from "@/lib/queries/payment-history";
import { requestClock } from "@/lib/time";
import { seasonLastMonth } from "@/lib/enrollment-plan";
import { inferPaymentDay } from "@/lib/payment-day";
import { isTentative } from "@/lib/price-increase";
import { paymentContextForCells } from "@/lib/payment-context";
import { buildPaymentMatrix, SIDE_COLUMNS, sideCellOf } from "@/lib/payment-matrix";
import { defaultPanelKey, longMonthLabel, SIDE_LABELS, studentPanelColumns } from "@/lib/student-payment-panel";
import { fetchPaymentTraces } from "@/lib/queries/payment-traces";
import { badgeClass, STUDENT_STATUS_STYLES } from "@/lib/status-styles";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Öğrenci" };

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
  marker?: { full_name: string } | { full_name: string }[] | null;
}

interface PlanRow {
  id: string;
  season: string;
  item_type: ItemType;
  total_amount: number;
  installment_count: number;
  tentative_from: string | null;
  source_offer_id: string | null;
  created_at: string;
  installments?: InstallmentRow[] | null;
}

interface StudentRow {
  id: string;
  created_at: string;
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

function toInstallmentItems(
  rows: InstallmentRow[] | null | undefined,
  tentativeFrom: string | null,
): InstallmentTableItem[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    due_date: row.due_date,
    amount: Number(row.amount),
    status: row.status,
    paid_at: row.paid_at,
    paid_amount: row.paid_amount === null ? null : Number(row.paid_amount),
    payment_method: row.payment_method,
    tentative: isTentative(tentativeFrom, row.due_date, row.status),
  }));
}

const monthNameFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "Europe/Istanbul" });

/** "2026-10" → "EKİM" (Excel defterindeki başlık) */
function sheetMonthLabel(monthKey: string) {
  return monthNameFormatter.format(new Date(`${monthKey}-01T12:00:00+03:00`)).toLocaleUpperCase("tr");
}

/** Planın ilk vadesi: başlangıç ayının son günü (okulun kuralı: aidat ay sonuna kadar ödenir). */
function defaultFirstDue(startDate: string | null, today: string) {
  const base = startDate && startDate > today ? startDate : today;
  const [year, month] = base.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${base.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
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
      "id, created_at, full_name, birth_month, birth_year, parent_name, phone, season, program, start_date, status, left_date, leave_reason, payment_plans(id, season, item_type, total_amount, installment_count, tentative_from, source_offer_id, created_at, installments(id, due_date, amount, status, paid_at, paid_amount, payment_method, marker:profiles!installments_marked_by_fkey(full_name)))",
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

  const { today } = await requestClock();
  // Tek tanımlar (lib/queries/money): alacak iptal hariç taksit tutarı, tahsilat ödenen tutar,
  // geciken yalnız aktif öğrencide. Plan toplamı (total_amount) ekranda kullanılmaz.
  const allInstallments = plans.flatMap((plan) => plan.installments ?? []);
  const totalKurus = sumKurus(allInstallments, receivableKurus);
  const paidKurus = sumKurus(allInstallments, collectedKurus);

  // Tüm planların taksitlerini TEK takvimde topla (kalem etiketiyle) — aya göre gruplanır.
  const scheduleItems = plans.flatMap((plan) =>
    toInstallmentItems(plan.installments, plan.tentative_from).map((item) => ({
      ...item,
      itemLabel: label(ITEM_TYPES, plan.item_type),
    })),
  );

  // Okulun ilk baktığı rakamlar: geciken ve kalan.
  const currentMonthPrefix = today.slice(0, 7);
  const kalanKurus = sumKurus(
    allInstallments.filter((inst) => inst.status === "bekliyor"),
    receivableKurus,
  );
  const gecikenKurus = sumKurus(allInstallments, (inst) => overdueKurus(inst, today, student.status));

  const initialOpen = first(queryParams.plan) === "1";
  const sourceOfferId = first(queryParams.offer);
  // Teklif tutarı aylıktır (bölünmez).
  const initialMonthlyTl = initialMonthlyFromQuery({
    monthly: first(queryParams.monthly),
    total: first(queryParams.total),
  });

  // Öğrencinin aidat listesindeki satırı: Ödemeler tablosuyla aynı hesap ve boya.
  const matrixInput = { ...student, payment_plans: student.payment_plans ?? [] };
  const matrix = buildPaymentMatrix([matrixInput], today, student.season);
  const row = matrix.rows[0];
  const [traces, paymentEvents, gorusmeler] = await Promise.all([
    fetchPaymentTraces(supabase, [student.id]),
    fetchPaymentEvents(supabase, student.id),
    fetchGorusmeler(supabase, [student.id]),
  ]);
  const openPromise = openPromises(gorusmeler)[0] ?? null;
  const history = buildPaymentHistory(
    plans.flatMap((plan) =>
      (plan.installments ?? []).map((inst) => ({
        id: inst.id,
        itemType: plan.item_type,
        dueDate: inst.due_date,
        amount: inst.amount,
        status: inst.status,
        paidAmount: inst.paid_amount,
        paidAt: inst.paid_at,
        method: inst.payment_method,
        markedByName: one(inst.marker)?.full_name ?? null,
      })),
    ),
    paymentEvents,
  );
  // Sayfadaki bütün ödeme girişleri Ödemeler ekranının hücre panelini açar (bütün sezonlar).
  const panelColumns = studentPanelColumns(matrixInput, today);
  const payment = paymentContextForCells(
    panelColumns.map((column) => column.cell),
    { id: student.id, phone: student.phone, fullName: student.full_name },
    traces,
  );
  const payKey = defaultPanelKey(panelColumns);
  const openItems = payment.openItems;
  const overdueItems = openItems.filter((item) => item.overdue);
  const nextItem = openItems[0];
  const hasAidatPlan = plans.some((plan) => plan.item_type === "aidat" && plan.season === student.season);
  const lastMonth = seasonLastMonth(student.season) ?? `${Number(today.slice(0, 4)) + 1}-06`;
  const isActive = student.status === "aktif";
  // Ödeme günü: bekleyen aylık aidat vadelerinden (yoksa bütün aylık aidat vadelerinden) okunur.
  const monthlyAidat = plans.filter(
    (plan) => plan.item_type === "aidat" && plan.season === student.season && Number(plan.installment_count) > 1,
  );
  const pendingAidatDues = monthlyAidat.flatMap((plan) =>
    (plan.installments ?? []).filter((item) => item.status === "bekliyor").map((item) => item.due_date),
  );
  const paymentDay = inferPaymentDay(
    pendingAidatDues.length
      ? pendingAidatDues
      : monthlyAidat.flatMap((plan) => (plan.installments ?? []).map((item) => item.due_date)),
  );
  const hasKitapPlan = plans.some((plan) => plan.item_type === "kitap" && plan.season === student.season);
  const hasRow = Boolean(row && (row.kitapCell || row.aidatCell || row.servisCell || matrix.months.length > 0));

  let statusTitle: string;
  let statusTone: "danger" | "primary" | "ok";
  if (isActive && !hasAidatPlan) {
    statusTitle = "Ödeme planı henüz kurulmadı";
    statusTone = "primary";
  } else if (overdueItems.length > 0) {
    const firstOverdue = overdueItems[0];
    statusTitle =
      overdueItems.length === 1
        ? `${firstOverdue.label} ${formatTRY(firstOverdue.amountKurus)} alınmadı`
        : `${overdueItems.length} ödeme alınmadı · toplam ${formatTRY(gecikenKurus)}`;
    statusTone = "danger";
  } else if (nextItem) {
    statusTitle = `Sıradaki ödeme: ${nextItem.label} ${formatTRY(nextItem.amountKurus)}`;
    statusTone = "primary";
  } else {
    statusTitle = "Bütün ödemeler alındı";
    statusTone = "ok";
  }

  const toneClass = {
    danger: "border-red-200 bg-destructive-soft",
    primary: "border-primary/20 bg-primary-soft",
    ok: "border-emerald-200 bg-accent-soft",
  }[statusTone];

  return (
    <PaymentPanelHost columns={panelColumns} payment={payment} studentName={student.full_name} role={profile.role}>
      <div className="space-y-6">
        <div>
          <Link
            href="/ogrenciler"
            className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Öğrenciler
          </Link>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">{student.full_name}</h1>
              <p className="mt-1 text-base text-muted-foreground">
                {student.program ? label(PROGRAMS, student.program) : "Program eklenmedi"} · {student.season}
                {student.parent_name ? ` · Veli: ${student.parent_name}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`w-fit ${badgeClass(STUDENT_STATUS_STYLES[student.status])}`}>
                {label(STUDENT_STATUSES, student.status)}
              </span>
              {student.phone ? <WhatsAppButton phone={student.phone} /> : null}
            </div>
          </div>
        </div>

        <section className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${toneClass}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Durum</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{statusTitle}</p>
          {hasAidatPlan ? (
            <p className="mt-1 text-base text-muted-foreground">
              Bu yıl kalan {formatTRY(kalanKurus)} · alınan {formatTRY(paidKurus)} / {formatTRY(totalKurus)}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {isActive && !hasAidatPlan ? (
              <EnrollmentPlanButton
                studentId={student.id}
                studentName={student.full_name}
                lastMonth={lastMonth}
                initialFirstDue={defaultFirstDue(student.start_date, today)}
                initialMonthlyTl={initialMonthlyTl}
                sourceOfferId={sourceOfferId}
                initialOpen={initialOpen}
              />
            ) : null}
            {payKey ? <PaymentPanelButton columnKey={payKey} /> : null}
            {overdueItems.length > 0 ? (
              <ReminderButton
                studentId={student.id}
                installmentIds={overdueItems.map((item) => item.id)}
                phone={student.phone}
                message={payment.reminderMessage}
                big
              />
            ) : null}
          </div>
        </section>

        {row && hasRow ? (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Aidat listesindeki satırı</h2>
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {SIDE_COLUMNS.filter((column) => sideCellOf(row, column)).map((column) => (
                      <th key={column} scope="col" className="whitespace-nowrap border-l border-border px-2 py-3 text-right">
                        {SIDE_LABELS[column]}
                      </th>
                    ))}
                    {matrix.months.map((monthKey) => (
                      <th
                        key={monthKey}
                        scope="col"
                        className={`whitespace-nowrap border-l border-border px-2 py-3 text-right ${
                          monthKey === currentMonthPrefix ? "text-primary-strong" : ""
                        }`}
                      >
                        {sheetMonthLabel(monthKey)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                      {SIDE_COLUMNS.map((column) => {
                        const cell = sideCellOf(row, column);
                        return cell ? (
                          <PaymentMatrixCell
                            key={column}
                            cell={cell}
                            studentName={student.full_name}
                            monthLabel={SIDE_LABELS[column]}
                            role={profile.role}
                          />
                        ) : null;
                      })}
                      {matrix.months.map((monthKey) => (
                        <PaymentMatrixCell
                          key={monthKey}
                          cell={row.cells[monthKey]}
                          studentName={student.full_name}
                          monthLabel={longMonthLabel(monthKey)}
                          role={profile.role}
                        />
                      ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              Bir hücreye dokunarak ayrıntısını, notunu ve hatırlatmasını görebilirsiniz.
            </p>
          </section>
        ) : null}

        {history.length > 0 || hasRow ? (
          <PaymentHistory entries={history} role={profile.role} studentName={student.full_name} />
        ) : null}

        <section id="gorusmeler" className="scroll-mt-20 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Veli görüşmeleri</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ödeme için veliyle yapılan görüşmeler ve verilen sözler.
            </p>
            {openPromise ? (
              <div className="mt-2">
                <PromiseBadge row={openPromise} today={today} />
              </div>
            ) : null}
          </div>
          {profile.role === "yonetici" || profile.role === "danisman" ? (
            <div className="mt-4">
              <VeliGorusmesiForm studentId={student.id} />
            </div>
          ) : null}
          <div className="mt-5">
            <VeliGorusmeleriList rows={gorusmeler} />
          </div>
        </section>

        {student.status === "ayrildi" ? (
          <RefundPanel studentId={student.id} canManage={profile.role === "yonetici"} refunds={refunds} />
        ) : null}

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Veli</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">{student.parent_name ?? "Eklenmedi"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Telefon</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">{student.phone ?? "Eklenmedi"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Doğum</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">
                {formatBirth(student.birth_month, student.birth_year)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Başlangıç</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">{formatDate(student.start_date)}</dd>
            </div>
            {isActive && monthlyAidat.length > 0 ? (
              <PaymentDayControl
                studentId={student.id}
                studentName={student.full_name}
                current={paymentDay}
                hasKitap={hasKitapPlan}
              />
            ) : null}
            {student.status === "ayrildi" ? (
              <>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Ayrılış tarihi</dt>
                  <dd className="mt-1 text-base font-semibold text-foreground">{formatDate(student.left_date)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Ayrılış nedeni</dt>
                  <dd className="mt-1 text-base font-semibold text-foreground">{student.leave_reason || "Belirtilmedi"}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </section>

        {scheduleItems.length > 0 ? (
          <details className="group rounded-2xl border border-border bg-surface shadow-sm">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-base font-semibold text-foreground">
              Bütün taksitler ({scheduleItems.length})
              <span className="text-sm font-medium text-muted-foreground group-open:hidden">Göster</span>
              <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">Gizle</span>
            </summary>
            <div className="border-t border-border p-3 sm:p-4">
              <InstallmentTable
                installments={scheduleItems}
                today={today}
                showItemColumn
              />
            </div>
          </details>
        ) : null}

        <details id="diger" className="group rounded-2xl border border-border bg-surface shadow-sm">
          <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 px-5 py-2 text-base font-semibold text-foreground">
            Diğer işlemler
            <span className="text-sm font-medium text-muted-foreground">
              Bilgileri düzenle · başka kalem ekle
              {isActive && profile.role === "yonetici" ? " · ayrıldı olarak işaretle" : ""}
            </span>
          </summary>
          <div className="space-y-4 border-t border-border p-3 sm:p-4">
            <StudentEditForm
              student={{
                id: student.id,
                full_name: student.full_name,
                parent_name: student.parent_name,
                phone: student.phone,
                program: student.program,
                birth_month: student.birth_month,
                birth_year: student.birth_year,
                start_date: student.start_date,
                season: student.season,
              }}
              role={profile.role}
            />
            <PlanWizard studentId={student.id} />
            {isActive && profile.role === "yonetici" ? <StudentLeaveForm studentId={student.id} /> : null}
          </div>
        </details>
      </div>
    </PaymentPanelHost>
  );
}
