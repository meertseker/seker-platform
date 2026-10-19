import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  CalendarClock,
  MessageCirclePlus,
  Users,
  Wallet,
} from "lucide-react";
import { CallButton } from "@/components/call-outcome";
import { CallQueueList } from "@/components/call-queue-card";
import { OfferApprovalCard } from "@/components/offer-approval-list";
import { TaskCompleteButton } from "@/components/task-complete-button";
import { TodayHeader } from "@/components/today-help";
import { TodayVisits, type TodayVisit } from "@/components/today-visits";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { getSessionProfile } from "@/lib/auth";
import {
  APPOINTMENT_TYPES,
  ITEM_TYPES,
  LEAD_STATUSES,
  label,
  type AppointmentOutcome,
  type AppointmentType,
  type ItemType,
  type LeadStatus,
} from "@/lib/constants";
import {
  STALE_LEAD_STATUSES,
  staleCutoffIso,
  istanbulDateString,
  overdueTotalKurus,
} from "@/lib/cron-rules";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { fillTemplate } from "@/lib/lead-flow/template";
import { reminderMessage } from "@/lib/overdue";
import { formatTRY, tlToKurus } from "@/lib/money";
import { loadCallQueue, loadFollowupTasks, type FollowupItem, type QueueLead } from "@/lib/queries/call-queue";
import { getFunnel, getPaymentSummary } from "@/lib/queries/dashboard";
import { loadPendingOffers } from "@/lib/queries/pending-offers";
import { daysSince } from "@/lib/next-step";
import { badgeClass, LEAD_STATUS_STYLES } from "@/lib/status-styles";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bugün" };

export const dynamic = "force-dynamic";

interface LeadJoin {
  id: string;
  parent_name: string;
  phone: string;
}

interface AppointmentRow {
  id: string;
  lead_id: string;
  scheduled_at: string;
  type: AppointmentType;
  outcome: AppointmentOutcome;
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

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Istanbul",
});

const weekdayFormatter = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long",
  timeZone: "Europe/Istanbul",
});

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Istanbul",
});

const DISPLAY_LIMIT = 5;
const PAST_APPOINTMENT_LIMIT = 5;

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00+03:00`));
}

function daysLate(dueDate: string, today: string) {
  const diff =
    (new Date(`${today}T00:00:00Z`).getTime() -
      new Date(`${dueDate}T00:00:00Z`).getTime()) /
    86400000;
  return Math.round(diff);
}

/** "Salı, 4 Kasım · Zehra" */
function headerDateLine(now: Date, today: string, firstName: string) {
  const weekday = weekdayFormatter.format(now);
  return `${weekday.charAt(0).toLocaleUpperCase("tr-TR")}${weekday.slice(1)}, ${formatDate(today)} · ${firstName}`;
}

function toVisits(rows: AppointmentRow[], today: string, now: Date): TodayVisit[] {
  return rows.map((row) => {
    const lead = one(row.lead);
    const at = new Date(row.scheduled_at);
    const time = timeFormatter.format(at);
    const day = istanbulDateString(at);
    return {
      id: row.id,
      leadId: lead?.id ?? row.lead_id,
      leadName: lead?.parent_name ?? "Veli",
      when: day === today ? time : `${formatDate(day)} ${time}`,
      typeLabel: row.type === "okul_ziyareti" ? null : label(APPOINTMENT_TYPES, row.type),
      outcome: row.outcome,
      overdue: row.outcome === "bekliyor" && at.getTime() < now.getTime(),
    };
  });
}

/** Prototipteki sade bölüm başlığı: başlık solda, sayı sağda. */
function TodaySection({
  title,
  countText,
  children,
}: {
  title: string;
  countText?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-bold text-foreground">{title}</h2>
        {countText ? <span className="text-[13px] text-muted-foreground">{countText}</span> : null}
      </div>
      {children}
    </section>
  );
}

function FollowupRowView({ task }: { task: FollowupItem }) {
  const body = (
    <>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold text-foreground">{task.leadName ?? task.title}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {task.leadName ? task.subtitle : "Genel görev"}
        </span>
      </div>
      {task.dueNow ? (
        <span className="shrink-0 rounded-full bg-warning-soft px-2.5 py-1 text-[13px] font-semibold text-warning">
          şimdi
        </span>
      ) : task.time ? (
        <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{task.time}</span>
      ) : null}
    </>
  );
  const rowClass = "flex min-h-14 flex-1 items-center justify-between gap-2.5 py-3 pl-3.5";

  return (
    <li className="flex items-center gap-2 pr-2">
      {task.leadId ? (
        <Link href={`/leads/${task.leadId}`} className={`${rowClass} min-w-0 hover:text-primary-strong`}>
          {body}
        </Link>
      ) : (
        <div className={`${rowClass} min-w-0`}>{body}</div>
      )}
      <TaskCompleteButton id={task.id} compact />
    </li>
  );
}

function SectionBlock({
  title,
  description,
  count,
  seeAllHref,
  seeAllLabel = "Tümünü gör",
  id,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  seeAllHref?: string;
  seeAllLabel?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {typeof count === "number" && count > 0 ? (
          <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-strong tabular-nums">
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


export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ takip?: string }>;
}) {
  // ?takip=tumu: takip listesinin tamamı (ilk 5 ile sınırlı değil).
  const showAllFollowups = (await searchParams).takip === "tumu";
  const profile = await getSessionProfile();
  const isYonetici = profile.role === "yonetici";
  const supabase = await createServerSupabase();
  const now = new Date();
  const today = istanbulDateString(now);
  const month = today.slice(0, 7);
  const dayStart = `${today}T00:00:00+03:00`;
  const dayEnd = `${today}T23:59:59+03:00`;
  const firstName = profile.full_name.split(" ")[0] || profile.full_name;

  const flowSettings = await getLeadFlowSettings(supabase);

  const staleSettingPromise = supabase
    .from("app_settings")
    .select("value")
    .eq("key", "takipsizlik_gun")
    .maybeSingle();
  const appointmentSelect = "id, lead_id, scheduled_at, type, outcome, lead:leads(id, parent_name, phone)";
  // İleri tarihli açık görevler: bugünküler "Takip aramaları"nda, bunlar aşağıdaki listede.
  let laterTasksQuery = supabase
    .from("tasks")
    .select("id, title, due_date, lead_id, lead:leads(id, parent_name, phone)")
    .eq("status", "acik")
    .gt("due_date", today)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (!isYonetici) {
    laterTasksQuery = laterTasksQuery.eq("assigned_to", profile.id);
  }

  const [
    staleSettingResult,
    appointmentsResult,
    pastAppointmentsResult,
    laterTasksResult,
    queueResult,
    followupResult,
  ] = await Promise.all([
    staleSettingPromise,
    supabase
      .from("appointments")
      .select(appointmentSelect)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd)
      .order("scheduled_at", { ascending: true }),
    // Önceki günlerden sonucu girilmemiş randevular "Bugünkü ziyaretler"in başında kalır.
    supabase
      .from("appointments")
      .select(appointmentSelect)
      .eq("outcome", "bekliyor")
      .lt("scheduled_at", dayStart)
      .order("scheduled_at", { ascending: true })
      .limit(PAST_APPOINTMENT_LIMIT),
    laterTasksQuery,
    loadCallQueue(supabase, profile.id, now, flowSettings).then(
      (leads) => ({ leads, error: false }),
      (e: unknown) => {
        console.error("bugun call queue:", e);
        return { leads: [] as QueueLead[], error: true };
      },
    ),
    loadFollowupTasks(supabase, profile.id, profile.role, today, now).then(
      (tasks) => ({ tasks, error: false }),
      (e: unknown) => {
        console.error("bugun followups:", e);
        return { tasks: [] as FollowupItem[], error: true };
      },
    ),
  ]);

  const staleDays = Number(staleSettingResult.data?.value ?? 3);
  const cutoff = staleCutoffIso(now, staleDays);

  let staleLeadsQuery = supabase
    .from("leads")
    .select("id, parent_name, phone, status, last_activity_at")
    .in("status", STALE_LEAD_STATUSES)
    .lt("last_activity_at", cutoff)
    .not("assigned_to", "is", null)
    .order("last_activity_at", { ascending: true });
  // Danışman yalnız kendi velilerini görür; görevlerdeki kuralla aynı.
  if (!isYonetici) {
    staleLeadsQuery = staleLeadsQuery.eq("assigned_to", profile.id);
  }

  const [
    staleLeadsResult,
    dueInstallmentsResult,
    pendingOffersResult,
    funnel,
    paymentSummary,
  ] = await Promise.all([
    staleLeadsQuery,
    supabase
      .from("installments")
      .select(
        "id, due_date, amount, plan:payment_plans(item_type, student:students(id, full_name, phone, family:families(phone)))",
      )
      .eq("status", "bekliyor")
      .lte("due_date", today)
      .order("due_date", { ascending: true }),
    isYonetici
      ? loadPendingOffers(DISPLAY_LIMIT)
      : supabase
          .from("offers")
          .select("id", { count: "exact", head: true })
          .eq("status", "onay_bekliyor")
          .then((result) => ({ offers: [], count: result.count ?? 0, error: Boolean(result.error) })),
    getFunnel(month),
    getPaymentSummary(month),
  ]);

  const queue = queueResult.leads;
  const followups = followupResult.tasks;
  const visits = toVisits(
    [
      ...((pastAppointmentsResult.data ?? []) as unknown as AppointmentRow[]),
      ...((appointmentsResult.data ?? []) as unknown as AppointmentRow[]),
    ],
    today,
    now,
  );
  const visitsLoadFailed = Boolean(appointmentsResult.error || pastAppointmentsResult.error);
  const laterTasks = (laterTasksResult.data ?? []) as unknown as TaskRow[];
  const staleLeads = (staleLeadsResult.data ?? []) as unknown as StaleLeadRow[];
  const dueInstallments = (dueInstallmentsResult.data ??
    []) as unknown as DueInstallmentRow[];
  const pendingOfferItems = pendingOffersResult.offers;
  const pendingOffersCount = pendingOffersResult.count;

  const tahsilatTotalKurus = overdueTotalKurus(
    dueInstallments.map((row) => ({ amount: row.amount })),
  );
  const overdueOnly = dueInstallments.filter((row) => daysLate(row.due_date, today) > 0);
  const overdueOnlyKurus = overdueTotalKurus(overdueOnly.map((row) => ({ amount: row.amount })));
  const dueInstallmentsToShow = dueInstallments.slice(0, DISPLAY_LIMIT);

  const followupCount = laterTasks.length + staleLeads.length;
  const followupLimit = showAllFollowups ? Number.POSITIVE_INFINITY : DISPLAY_LIMIT;
  const nowIso = now.toISOString();
  const loadFailed = Boolean(
    queueResult.error ||
      followupResult.error ||
      visitsLoadFailed ||
      laterTasksResult.error ||
      staleLeadsResult.error ||
      dueInstallmentsResult.error,
  );

  // "Ulaşamadım" şablonu varsa WhatsApp düğmesi onu hazır yazar; yoksa boş sohbet açar.
  const unreachedTemplate = flowSettings.templates.find((t) => t.key === "ulasilamadi")?.text;
  const waMessages = Object.fromEntries(
    queue.map((lead) => [
      lead.id,
      unreachedTemplate ? fillTemplate(unreachedTemplate, { veli: lead.parentName, danisman: firstName }) : undefined,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-[18px]">
      <TodayHeader dateLine={headerDateLine(now, today, firstName)} />

      {loadFailed ? (
        <ErrorState text="Bazı listeler yüklenemedi, sayılar eksik olabilir. Sayfayı yenileyin." />
      ) : null}

      <Link
        href="/leads/mesaj"
        className="flex min-h-14 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-input/60 bg-surface text-[15px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageCirclePlus aria-hidden className="size-5" />
        Instagram / WhatsApp mesajını ekle
      </Link>

      <TodaySection title="Şimdi ara" countText={`${queue.length} yeni veli`}>
        {queueResult.error ? (
          <ErrorState text="Arama listesi yüklenirken bir sorun oluştu." />
        ) : queue.length === 0 ? (
          <EmptyState text="Şu an aranacak yeni veli yok." />
        ) : (
          <CallQueueList leads={queue} serverNow={now.getTime()} hours={flowSettings.hours} waMessages={waMessages} />
        )}
      </TodaySection>

      <TodaySection title="Takip aramaları" countText={`${followups.length} kişi`}>
        {followupResult.error ? (
          <ErrorState text="Takip listesi yüklenirken bir sorun oluştu." />
        ) : followups.length === 0 ? (
          <EmptyState text="Bugün takip araması yok." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {followups.map((task) => (
              <FollowupRowView key={task.id} task={task} />
            ))}
          </ul>
        )}
      </TodaySection>

      <TodaySection title="Bugünkü ziyaretler" countText={`${visits.length} randevu`}>
        {visitsLoadFailed ? (
          <ErrorState text="Randevular yüklenirken bir sorun oluştu." />
        ) : visits.length === 0 ? (
          <EmptyState text="Bugün planlanmış randevu yok." />
        ) : (
          <TodayVisits visits={visits} />
        )}
        <Link
          href="/takvim"
          className="inline-flex min-h-11 items-center gap-1 self-start rounded-xl px-1 text-sm font-semibold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Takvimi aç
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </TodaySection>

      {/* Takip bekleyenler: ileri tarihli görevler ve sessiz kalan veliler */}
      <SectionBlock
        title="Takip bekleyenler"
        description="İleri tarihli görevler ve uzun süredir işlem görmeyen veliler."
        count={followupCount}
        id="takip"
        seeAllHref={
          showAllFollowups
            ? "/bugun#takip"
            : followupCount > DISPLAY_LIMIT
              ? "/bugun?takip=tumu#takip"
              : undefined
        }
        seeAllLabel={showAllFollowups ? "İlk 5'i göster" : `Tümünü gör (${followupCount})`}
      >
        {staleLeadsResult.error || laterTasksResult.error ? (
          <ErrorState text="Takip listesi yüklenirken bir sorun oluştu." />
        ) : followupCount === 0 ? (
          <EmptyState text="Takip bekleyen görev veya veli görünmüyor." />
        ) : (
          <ul className="space-y-3">
            {laterTasks.slice(0, followupLimit).map((task) => {
              const lead = one(task.lead);

              return (
                <li
                  key={`task-${task.id}`}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
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
                        <span>Son gün: {formatDate(task.due_date)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {lead?.phone ? (
                        <>
                          <CallButton
                            leadId={lead.id}
                            phone={lead.phone}
                            leadName={lead.parent_name}
                          />
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
              .slice(0, Math.max(0, followupLimit - laterTasks.length))
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
                          Son işlem: {daysSince(lead.last_activity_at, nowIso)} gün önce
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CallButton
                        leadId={lead.id}
                        phone={lead.phone}
                        leadName={lead.parent_name}
                      />
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
          ) : pendingOfferItems.length === 0 ? (
            <EmptyState text="Onay bekleyen teklif yok." />
          ) : (
            <div className="space-y-3">
              {pendingOfferItems.map((offer) => (
                <OfferApprovalCard key={offer.id} offer={offer} />
              ))}
            </div>
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
            iconClass="bg-primary-soft text-primary-strong"
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
