import Link from "next/link";
import { AppointmentList, type AppointmentListItem } from "@/components/appointment-list";
import { TaskCompleteButton } from "@/components/task-complete-button";
import { getSessionProfile } from "@/lib/auth";
import {
  LEAD_STATUSES,
  label,
  type AppointmentOutcome,
  type AppointmentType,
  type LeadStatus,
} from "@/lib/constants";
import { formatTRY, tlToKurus } from "@/lib/money";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OpenLeadStatus = "yeni" | "ulasildi" | "gorusme_yapildi" | "teklif";

interface LeadJoin {
  id: string;
  parent_name: string;
}

interface ProfileJoin {
  id: string;
  full_name: string;
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
  assigned_to: string;
  lead?: LeadJoin | LeadJoin[] | null;
  assignee?: ProfileJoin | ProfileJoin[] | null;
}

interface StaleLeadRow {
  id: string;
  parent_name: string;
  status: LeadStatus;
  last_activity_at: string;
}

const staleStatuses: OpenLeadStatus[] = [
  "yeni",
  "ulasildi",
  "gorusme_yapildi",
  "teklif",
];

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function todayInIstanbul() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00+03:00`));
}

function daysSince(value: string, referenceDate: Date) {
  const elapsed = referenceDate.getTime() - new Date(value).getTime();
  return Math.max(0, Math.floor(elapsed / 86400000));
}

function taskTone(dueDate: string, today: string) {
  return dueDate <= today
    ? "border-amber-200 bg-amber-50"
    : "border-zinc-200 bg-white";
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm text-zinc-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function normalizeAppointments(rows: TodayAppointmentRow[]): AppointmentListItem[] {
  return rows.map((row) => {
    const lead = one(row.lead);

    return {
      id: row.id,
      leadId: lead?.id ?? row.lead_id,
      leadName: lead?.parent_name,
      scheduled_at: row.scheduled_at,
      type: row.type,
      outcome: row.outcome,
      outcome_note: row.outcome_note,
    };
  });
}

function AdminCard({
  href,
  label,
  value,
  helper,
  danger = false,
}: {
  href: string;
  label: string;
  value: string;
  helper: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        danger ? "border-red-200" : "border-zinc-200"
      }`}
    >
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${danger ? "text-red-700" : "text-zinc-950"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-zinc-500">{helper}</p>
    </Link>
  );
}

export default async function Home() {
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const now = new Date();
  const today = todayInIstanbul();
  const dayStart = `${today}T00:00:00+03:00`;
  const dayEnd = `${today}T23:59:59+03:00`;

  const settingsPromise = supabase
    .from("app_settings")
    .select("value")
    .eq("key", "takipsizlik_gun")
    .maybeSingle();
  const appointmentsPromise = supabase
    .from("appointments")
    .select("id, lead_id, scheduled_at, type, outcome, outcome_note, lead:leads(id, parent_name)")
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd)
    .order("scheduled_at", { ascending: true });
  let tasksQuery = supabase
    .from("tasks")
    .select(
      "id, title, due_date, lead_id, assigned_to, lead:leads(id, parent_name), assignee:profiles!tasks_assigned_to_fkey(id, full_name)",
    )
    .eq("status", "acik")
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (profile.role !== "yonetici") {
    tasksQuery = tasksQuery.eq("assigned_to", profile.id);
  }

  const [settingsResult, appointmentsResult, tasksResult] = await Promise.all([
    settingsPromise,
    appointmentsPromise,
    tasksQuery,
  ]);

  const staleDays = Number(settingsResult.data?.value ?? 3);
  const cutoff = new Date(now.getTime() - staleDays * 86400000).toISOString();
  const [
    staleLeadsResult,
    pendingOffersResult,
    overdueInstallmentsResult,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, parent_name, status, last_activity_at")
      .in("status", staleStatuses)
      .lt("last_activity_at", cutoff)
      .order("last_activity_at", { ascending: true }),
    profile.role === "yonetici"
      ? supabase
          .from("offers")
          .select("id", { count: "exact", head: true })
          .eq("status", "onay_bekliyor")
      : Promise.resolve({ count: 0, error: null }),
    profile.role === "yonetici"
      ? supabase
          .from("installments")
          .select("amount")
          .eq("status", "bekliyor")
          .lt("due_date", today)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const appointments = normalizeAppointments(
    (appointmentsResult.data ?? []) as unknown as TodayAppointmentRow[],
  );
  const tasks = (tasksResult.data ?? []) as unknown as TaskRow[];
  const staleLeads = (staleLeadsResult.data ?? []) as unknown as StaleLeadRow[];
  const overdueTotal = (overdueInstallmentsResult.data ?? []).reduce(
    (sum, row) => sum + tlToKurus(Number(row.amount)),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Bugün</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            {formatDate(today)}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Randevular, görevler ve takipsiz lead&apos;ler için günlük çalışma
            alanı.
          </p>
        </div>
      </div>

      {profile.role === "yonetici" ? (
        <section className="grid gap-4 md:grid-cols-2">
          <AdminCard
            href="/teklifler"
            label="Onay bekleyen teklifler"
            value={`${pendingOffersResult.count ?? 0}`}
            helper="Yönetici onayı gereken teklif sayısı"
          />
          <AdminCard
            href="/odemeler"
            label="Toplam geciken taksit"
            value={formatTRY(overdueTotal)}
            helper="Bugünden önce vadeli bekleyen taksitler"
            danger={overdueTotal > 0}
          />
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionCard
          title="Bugünkü randevular"
          description="Bugün gerçekleşecek görüşmeleri saat sırasıyla takip edin."
        >
          {appointmentsResult.error ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Randevular yüklenirken bir sorun oluştu.
            </p>
          ) : (
            <AppointmentList
              appointments={appointments}
              emptyText="Bugün planlanmış randevu yok."
              compactTime
            />
          )}
        </SectionCard>

        <SectionCard
          title="Açık görevlerim"
          description={
            profile.role === "yonetici"
              ? "Tüm ekibin açık görevlerini ve sorumlularını görün."
              : "Size atanmış açık görevleri tamamlandıkça işaretleyin."
          }
        >
          {tasksResult.error ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              Görevler yüklenirken bir sorun oluştu.
            </p>
          ) : tasks.length > 0 ? (
            <ul className="space-y-3">
              {tasks.map((task) => {
                const lead = one(task.lead);
                const assignee = one(task.assignee);
                const isDue = task.due_date <= today;

                return (
                  <li
                    key={task.id}
                    className={`rounded-3xl border p-4 shadow-sm ${taskTone(
                      task.due_date,
                      today,
                    )}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-zinc-950">{task.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                          {lead ? (
                            <Link
                              href={`/leads/${lead.id}`}
                              className="font-semibold text-zinc-800 hover:underline"
                            >
                              {lead.parent_name}
                            </Link>
                          ) : (
                            <span>Lead bağlantısı yok</span>
                          )}
                          <span>Vade: {formatDate(task.due_date)}</span>
                          {isDue ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              Bugün/gecikmiş
                            </span>
                          ) : null}
                        </div>
                        {profile.role === "yonetici" ? (
                          <p className="mt-2 text-xs font-medium text-zinc-500">
                            Sorumlu: {assignee?.full_name ?? "Atanmamış"}
                          </p>
                        ) : null}
                      </div>
                      <TaskCompleteButton id={task.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              Açık görev görünmüyor.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Takipsiz lead'ler"
        description={`${staleDays}+ gündür işlem görmeyen açık lead'leri canlı olarak gösterir.`}
      >
        {staleLeadsResult.error ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Takipsiz lead&apos;ler yüklenirken bir sorun oluştu.
          </p>
        ) : staleLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Veli</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Son işlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {staleLeads.map((lead) => (
                  <tr key={lead.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-4">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-semibold text-zinc-950 hover:underline"
                      >
                        {lead.parent_name}
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        {label(LEAD_STATUSES, lead.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-700">
                      {daysSince(lead.last_activity_at, now)} gün önce
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Takipsiz açık lead görünmüyor.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
