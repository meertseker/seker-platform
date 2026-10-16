import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  CalendarClock,
  Phone,
  Users,
  Wallet,
} from "lucide-react";
import { AppointmentList, type AppointmentListItem } from "@/components/appointment-list";
import { TaskCompleteButton } from "@/components/task-complete-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { getSessionProfile } from "@/lib/auth";
import {
  ITEM_TYPES,
  LEAD_STATUSES,
  label,
  type AppointmentOutcome,
  type AppointmentType,
  type ItemType,
  type LeadStatus,
  type Program,
} from "@/lib/constants";
import {
  STALE_LEAD_STATUSES,
  staleCutoffIso,
  istanbulDateString,
  overdueTotalKurus,
} from "@/lib/cron-rules";
import { reminderMessage } from "@/lib/overdue";
import { formatTRY, tlToKurus } from "@/lib/money";
import { getFunnel, getPaymentSummary } from "@/lib/queries/dashboard";
import { badgeClass, LEAD_STATUS_STYLES } from "@/lib/status-styles";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CALL_COMPACT_CLASS =
  "inline-flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface LeadJoin {
  id: string;
  parent_name: string;
  phone: string;
}

interface TodayAppointmentRow {
  id: string;
  lead_id: string;
  scheduled_at: string;
  type: AppointmentType;
  outcome: AppointmentOutcome;
  outcome_note: string | null;
  lead?: LeadJoin | LeadJoin[] | null;
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string;
  lead_id: string | null;
  lead?: LeadJoin | LeadJoin[] | null;
}

interface StaleLeadRow {
  id: string;
  parent_name: string;
  phone: string;
  status: LeadStatus;
  last_activity_at: string;
}

interface FamilyJoin {
  phone: string | null;
}

interface StudentJoin {
  id: string;
  full_name: string;
  phone: string | null;
  family?: FamilyJoin | FamilyJoin[] | null;
}

interface DuePlanJoin {
  item_type: ItemType;
  student?: StudentJoin | StudentJoin[] | null;
}

interface DueInstallmentRow {
  id: string;
  due_date: string;
  amount: number;
  plan?: DuePlanJoin | DuePlanJoin[] | null;
}

interface OfferLeadJoin {
  id: string;
  parent_name: string;
  child_name: string | null;
}

interface PendingOfferRow {
  id: string;
  offered_price: number;
  list_price: number;
  program: Program;
  lead?: OfferLeadJoin | OfferLeadJoin[] | null;
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Istanbul",
});

const DISPLAY_LIMIT = 5;

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00+03:00`));
}

function daysSince(value: string, referenceDate: Date) {
  const elapsed = referenceDate.getTime() - new Date(value).getTime();
  return Math.max(0, Math.floor(elapsed / 86400000));
}

function daysLate(dueDate: string, today: string) {
  const diff =
    (new Date(`${today}T00:00:00Z`).getTime() -
      new Date(`${dueDate}T00:00:00Z`).getTime()) /
    86400000;
  return Math.round(diff);
}

function greetingByHour(hour: number) {
  if (hour < 6) return "İyi geceler";
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

function normalizeAppointments(rows: TodayAppointmentRow[]): AppointmentListItem[] {
  return rows.map((row) => {
    const lead = one(row.lead);

    return {
      id: row.id,
      leadId: lead?.id ?? row.lead_id,
      leadName: lead?.parent_name,
      leadPhone: lead?.phone,
      scheduled_at: row.scheduled_at,
      type: row.type,
      outcome: row.outcome,
      outcome_note: row.outcome_note,
    };
  });
}

function SectionBlock({
  title,
  description,
  count,
  seeAllHref,
  seeAllLabel = "Tümünü gör",
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  seeAllHref?: string;
  seeAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {typeof count === "number" && count > 0 ? (
          <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      {children}
      {seeAllHref ? (
        <Link
          href={seeAllHref}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl px-1 text-sm font-semibold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {seeAllLabel}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function ErrorState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
      {text}
    </p>
  );
}

function SummaryStat({
  label: statLabel,
  value,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`flex size-8 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </span>
        <p className="text-xs font-medium text-muted-foreground">{statLabel}</p>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export default async function Home() {
  const profile = await getSessionProfile();
  const isYonetici = profile.role === "yonetici";
  const supabase = await createServerSupabase();
  const now = new Date();
  const today = istanbulDateString(now);
  const month = today.slice(0, 7);
  const dayStart = `${today}T00:00:00+03:00`;
  const dayEnd = `${today}T23:59:59+03:00`;
  const istanbulHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Istanbul",
    }).format(now),
  );
  const firstName = profile.full_name.split(" ")[0] || profile.full_name;

  const settingsPromise = supabase
    .from("app_settings")
    .select("value")
    .eq("key", "takipsizlik_gun")
    .maybeSingle();
  const appointmentsPromise = supabase
    .from("appointments")
    .select("id, lead_id, scheduled_at, type, outcome, outcome_note, lead:leads(id, parent_name, phone)")
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd)
    .order("scheduled_at", { ascending: true });
  let tasksQuery = supabase
    .from("tasks")
    .select("id, title, due_date, lead_id, lead:leads(id, parent_name, phone)")
    .eq("status", "acik")
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (!isYonetici) {
    tasksQuery = tasksQuery.eq("assigned_to", profile.id);
  }

  const [settingsResult, appointmentsResult, tasksResult] = await Promise.all([
    settingsPromise,
    appointmentsPromise,
    tasksQuery,
  ]);

  const staleDays = Number(settingsResult.data?.value ?? 3);
  const cutoff = staleCutoffIso(now, staleDays);

  const [
    staleLeadsResult,
    dueInstallmentsResult,
    pendingOffersResult,
    funnel,
    paymentSummary,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, parent_name, phone, status, last_activity_at")
      .in("status", STALE_LEAD_STATUSES)
      .lt("last_activity_at", cutoff)
      .not("assigned_to", "is", null)
      .order("last_activity_at", { ascending: true }),
    supabase
      .from("installments")
      .select(
        "id, due_date, amount, plan:payment_plans(item_type, student:students(id, full_name, phone, family:families(phone)))",
      )
      .eq("status", "bekliyor")
      .lte("due_date", today)
      .order("due_date", { ascending: true }),
    isYonetici
      ? supabase
          .from("offers")
          .select(
            "id, offered_price, list_price, program, lead:leads(id, parent_name, child_name)",
            { count: "exact" },
          )
          .eq("status", "onay_bekliyor")
          .order("created_at", { ascending: false })
          .limit(DISPLAY_LIMIT)
      : supabase
          .from("offers")
          .select("id", { count: "exact", head: true })
          .eq("status", "onay_bekliyor"),
    getFunnel(month),
    getPaymentSummary(month),
  ]);

  const appointments = normalizeAppointments(
    (appointmentsResult.data ?? []) as unknown as TodayAppointmentRow[],
  );
  const tasks = (tasksResult.data ?? []) as unknown as TaskRow[];
  const staleLeads = (staleLeadsResult.data ?? []) as unknown as StaleLeadRow[];
  const dueInstallments = (dueInstallmentsResult.data ??
    []) as unknown as DueInstallmentRow[];
  const pendingOfferRows = (isYonetici
    ? (pendingOffersResult.data ?? [])
    : []) as unknown as PendingOfferRow[];
  const pendingOffersCount = pendingOffersResult.count ?? 0;

  // Randevular: geçmiş-ama-bekleyen üstte, sonra saate göre.
  const sortedAppointments = [...appointments].sort((a, b) => {
    const aOverdue =
      a.outcome === "bekliyor" && new Date(a.scheduled_at).getTime() < now.getTime();
    const bOverdue =
      b.outcome === "bekliyor" && new Date(b.scheduled_at).getTime() < now.getTime();
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return a.scheduled_at.localeCompare(b.scheduled_at);
  });
  const appointmentsToShow = sortedAppointments.slice(0, DISPLAY_LIMIT);
  const pendingAppointmentCount = appointments.filter(
    (appointment) => appointment.outcome === "bekliyor",
  ).length;

  const tahsilatTotalKurus = overdueTotalKurus(
    dueInstallments.map((row) => ({ amount: row.amount })),
  );
  const overdueOnly = dueInstallments.filter((row) => daysLate(row.due_date, today) > 0);
  const overdueOnlyKurus = overdueTotalKurus(overdueOnly.map((row) => ({ amount: row.amount })));
  const dueInstallmentsToShow = dueInstallments.slice(0, DISPLAY_LIMIT);

  const followupCount = tasks.length + staleLeads.length;
  const onayCount = isYonetici ? pendingOffersCount : 0;
  const totalJobs =
    pendingAppointmentCount + followupCount + dueInstallments.length + onayCount;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {formatDate(today)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
          {greetingByHour(istanbulHour)} {firstName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {totalJobs > 0
            ? `Bugün ${totalJobs} işin var.`
            : "Bugün bekleyen bir işin yok, harika gidiyorsun."}
        </p>
      </div>

      {/* 1 — Bugünkü randevular */}
      <SectionBlock
        title="Bugünkü randevular"
        description="Zamanı geçmiş ama sonuçlanmamış görüşmeler en üstte."
        count={pendingAppointmentCount}
        seeAllHref="/takvim"
      >
        {appointmentsResult.error ? (
          <ErrorState text="Randevular yüklenirken bir sorun oluştu." />
        ) : (
          <AppointmentList
            appointments={appointmentsToShow}
            emptyText="Bugün planlanmış randevu yok."
            compactTime
          />
        )}
      </SectionBlock>

      {/* 2 — Takip bekleyenler */}
      <SectionBlock
        title="Takip bekleyenler"
        description="Açık görevler ve uzun süredir işlem görmeyen veliler."
        count={followupCount}
        seeAllHref="/pipeline"
      >
        {staleLeadsResult.error ? (
          <ErrorState text="Takip listesi yüklenirken bir sorun oluştu." />
        ) : followupCount === 0 ? (
          <EmptyState text="Takip bekleyen görev veya veli görünmüyor." />
        ) : (
          <ul className="space-y-3">
            {tasks.slice(0, DISPLAY_LIMIT).map((task) => {
              const lead = one(task.lead);
              const isDue = task.due_date <= today;

              return (
                <li
                  key={`task-${task.id}`}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    isDue ? "border-amber-200 bg-warning-soft" : "border-border bg-surface"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{task.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {lead ? (
                          <Link
                            href={`/leads/${lead.id}`}
                            className="font-semibold text-foreground hover:underline"
                          >
                            {lead.parent_name}
                          </Link>
                        ) : (
                          <span>Genel görev</span>
                        )}
                        <span>Vade: {formatDate(task.due_date)}</span>
                        {isDue ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Bugün/gecikmiş
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {lead?.phone ? (
                        <>
                          <a
                            href={`tel:${lead.phone}`}
                            aria-label="Telefonla ara"
                            title="Ara"
                            className={CALL_COMPACT_CLASS}
                          >
                            <Phone aria-hidden className="size-4" />
                          </a>
                          <WhatsAppButton phone={lead.phone} compact />
                        </>
                      ) : null}
                      <TaskCompleteButton id={task.id} />
                    </div>
                  </div>
                </li>
              );
            })}
            {staleLeads
              .slice(0, Math.max(0, DISPLAY_LIMIT - tasks.length))
              .map((lead) => (
                <li
                  key={`stale-${lead.id}`}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {lead.parent_name}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className={badgeClass(LEAD_STATUS_STYLES[lead.status])}>
                          {label(LEAD_STATUSES, lead.status)}
                        </span>
                        <span>
                          Son işlem: {daysSince(lead.last_activity_at, now)} gün önce
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${lead.phone}`}
                        aria-label="Telefonla ara"
                        title="Ara"
                        className={CALL_COMPACT_CLASS}
                      >
                        <Phone aria-hidden className="size-4" />
                      </a>
                      <WhatsAppButton phone={lead.phone} compact />
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </SectionBlock>

      {/* 3 — Bugünkü / geciken tahsilat */}
      <SectionBlock
        title="Bugünkü / geciken tahsilat"
        description="Vadesi bugün veya geçmiş, hâlâ bekleyen taksitler."
        count={dueInstallments.length}
        seeAllHref="/odemeler/gecikenler"
      >
        {dueInstallmentsResult.error ? (
          <ErrorState text="Tahsilat bilgisi yüklenirken bir sorun oluştu." />
        ) : dueInstallments.length === 0 ? (
          <EmptyState text="Bugün vadesi gelen veya geciken taksit yok." />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">
                Toplam bekleyen
              </span>
              <span className="text-base font-semibold tabular-nums text-foreground">
                {formatTRY(tahsilatTotalKurus)}
              </span>
            </div>
            {overdueOnly.length > 0 ? (
              <Link
                href="/odemeler/gecikenler"
                className="flex items-center justify-between rounded-2xl border border-red-200 bg-destructive-soft px-4 py-3 text-sm font-semibold text-red-700 hover:border-red-300"
              >
                <span>Geciken: {overdueOnly.length} taksit</span>
                <span className="tabular-nums">{formatTRY(overdueOnlyKurus)} →</span>
              </Link>
            ) : null}
            <ul className="space-y-3">
              {dueInstallmentsToShow.map((row) => {
                const plan = one(row.plan);
                const student = one(plan?.student);
                const late = daysLate(row.due_date, today);

                return (
                  <li
                    key={row.id}
                    className={`flex flex-col gap-2 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                      late > 0 ? "border-red-200 bg-destructive-soft" : "border-border bg-surface"
                    }`}
                  >
                    <div className="min-w-0">
                      {student ? (
                        <Link
                          href={`/ogrenciler/${student.id}`}
                          className="font-semibold text-foreground hover:underline"
                        >
                          {student.full_name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-muted-foreground">
                          Öğrenci bulunamadı
                        </span>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">
                        {label(ITEM_TYPES, plan?.item_type ?? "diger")}
                        {late > 0 ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                            {late} gün gecikmiş
                          </span>
                        ) : (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                            Bugün vadeli
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold tabular-nums text-foreground">
                        {formatTRY(tlToKurus(Number(row.amount)))}
                      </span>
                      {late > 0 && student ? (() => {
                        const family = one(student.family);
                        const phone = student.phone || family?.phone || null;
                        return phone ? (
                          <WhatsAppButton
                            phone={phone}
                            compact
                            message={reminderMessage({
                              studentName: student.full_name,
                              totalKurus: tlToKurus(Number(row.amount)),
                              items: [{ dueDate: row.due_date, itemType: plan?.item_type ?? "diger" }],
                            })}
                          />
                        ) : null;
                      })() : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SectionBlock>

      {/* 4 — Bekleyen onaylar (yalnız yönetici) */}
      {isYonetici ? (
        <SectionBlock
          title="Bekleyen onaylar"
          description="Yönetici onayı gereken teklifler."
          count={pendingOffersCount}
          seeAllHref="/teklifler"
          seeAllLabel="Tüm teklifler"
        >
          {pendingOffersResult.error ? (
            <ErrorState text="Teklifler yüklenirken bir sorun oluştu." />
          ) : pendingOfferRows.length === 0 ? (
            <EmptyState text="Onay bekleyen teklif yok." />
          ) : (
            <ul className="space-y-3">
              {pendingOfferRows.map((offer) => {
                const lead = one(offer.lead);

                return (
                  <li
                    key={offer.id}
                    className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {lead?.parent_name ?? "Veli bilgisi yok"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {lead?.child_name ?? "Çocuk bilgisi yok"} · Teklif:{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatTRY(tlToKurus(Number(offer.offered_price)))}
                        </span>{" "}
                        / Liste:{" "}
                        <span className="tabular-nums">
                          {formatTRY(tlToKurus(Number(offer.list_price)))}
                        </span>
                      </p>
                    </div>
                    <Link
                      href="/teklifler"
                      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Detayı aç
                      <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionBlock>
      ) : null}

      {/* Bu ay özeti */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Bu ay
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryStat
            label="Yeni veli"
            value={String(funnel.leads)}
            icon={<Users aria-hidden className="size-4" />}
            iconClass="bg-primary-soft text-primary"
          />
          <SummaryStat
            label="Kayıt (kazanılan)"
            value={String(funnel.kayit)}
            icon={<CalendarClock aria-hidden className="size-4" />}
            iconClass="bg-accent-soft text-emerald-700"
          />
          <SummaryStat
            label="Bu ay tahsilat"
            value={formatTRY(paymentSummary.paidThisMonthKurus)}
            icon={<Wallet aria-hidden className="size-4" />}
            iconClass="bg-accent-soft text-emerald-700"
          />
          <SummaryStat
            label="Bekleyen teklif"
            value={String(pendingOffersCount)}
            icon={<BadgePercent aria-hidden className="size-4" />}
            iconClass="bg-warning-soft text-warning"
          />
        </div>
      </section>
    </div>
  );
}
