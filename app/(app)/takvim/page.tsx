import Link from "next/link";
import {
  APPOINTMENT_OUTCOMES,
  APPOINTMENT_TYPES,
  label,
  type AppointmentOutcome,
  type AppointmentType,
} from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface CalendarPageProps {
  searchParams: SearchParams;
}

interface LeadJoin {
  id: string;
  parent_name: string;
}

interface CalendarAppointment {
  id: string;
  lead_id: string;
  scheduled_at: string;
  type: AppointmentType;
  outcome: AppointmentOutcome;
  lead?: LeadJoin | LeadJoin[] | null;
}

const dayFormatter = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Istanbul",
});

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoWeek(date: Date) {
  const day = date.getUTCDay() || 7;
  const thursday = addDays(date, 4 - day);
  const year = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return { year, week };
}

function weeksInIsoYear(year: number) {
  return isoWeek(new Date(Date.UTC(year, 11, 28))).week;
}

function mondayForIsoWeek(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  return addDays(jan4, 1 - jan4Day + (week - 1) * 7);
}

function weekKey(date: Date) {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function parseWeekParam(value: string | undefined) {
  const match = value?.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > weeksInIsoYear(year)) return null;
  return mondayForIsoWeek(year, week);
}

function istanbulTodayAsUtcDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

function istanbulDayStartIso(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), -3),
  ).toISOString();
}

function ymd(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function outcomeClass(outcome: AppointmentOutcome) {
  switch (outcome) {
    case "geldi":
      return "bg-green-50 text-green-700 ring-green-200";
    case "gelmedi":
      return "bg-red-50 text-red-700 ring-red-200";
    case "ertelendi":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "iptal":
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
    default:
      return "bg-blue-50 text-blue-700 ring-blue-200";
  }
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const selectedMonday =
    parseWeekParam(first(params.hafta)) ?? mondayForIsoWeek(
      isoWeek(istanbulTodayAsUtcDate()).year,
      isoWeek(istanbulTodayAsUtcDate()).week,
    );
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(selectedMonday, index));
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, lead_id, scheduled_at, type, outcome, lead:leads(id, parent_name)")
    .gte("scheduled_at", istanbulDayStartIso(selectedMonday))
    .lt("scheduled_at", istanbulDayStartIso(addDays(selectedMonday, 7)))
    .order("scheduled_at", { ascending: true });

  const appointments = (data ?? []) as unknown as CalendarAppointment[];
  const byDay = new Map(weekDays.map((day) => [ymd(day), [] as CalendarAppointment[]]));

  for (const appointment of appointments) {
    const date = new Date(appointment.scheduled_at);
    const localParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) =>
      localParts.find((part) => part.type === type)?.value ?? "";
    const key = `${get("year")}-${get("month")}-${get("day")}`;
    byDay.get(key)?.push(appointment);
  }

  // Hafta içi her zaman görünür; cumartesi/pazar yalnızca randevu varsa
  // gösterilir ki hafta sonu randevuları takvimde asla kaybolmasın.
  const days = weekDays.filter(
    (day, index) => index < 5 || (byDay.get(ymd(day))?.length ?? 0) > 0,
  );
  const gridClass =
    days.length === 7
      ? "grid gap-4 lg:grid-cols-7"
      : days.length === 6
        ? "grid gap-4 lg:grid-cols-6"
        : "grid gap-4 lg:grid-cols-5";

  const currentWeek = weekKey(selectedMonday);
  const prevWeek = weekKey(addDays(selectedMonday, -7));
  const nextWeek = weekKey(addDays(selectedMonday, 7));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Randevu takvimi</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Takvim</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Haftalık okul ziyareti ve telefon randevularını takip edin.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/takvim?hafta=${prevWeek}`}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
          >
            Önceki hafta
          </Link>
          <Link
            href={`/takvim?hafta=${nextWeek}`}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
          >
            Sonraki hafta
          </Link>
        </div>
      </div>

      <form
        action="/takvim"
        className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end"
      >
        <div>
          <label htmlFor="hafta" className="text-sm font-medium text-zinc-700">
            Hafta seç
          </label>
          <input
            id="hafta"
            name="hafta"
            type="week"
            defaultValue={currentWeek}
            className="mt-2 block rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Haftayı Göster
        </button>
      </form>

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Randevular yüklenemedi.
        </p>
      ) : null}

      <section className={gridClass}>
        {days.map((day) => {
          const dayAppointments = byDay.get(ymd(day)) ?? [];

          return (
            <div
              key={ymd(day)}
              className="min-h-48 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-semibold capitalize text-zinc-950">
                  {dayFormatter.format(day)}
                </h2>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                  {dayAppointments.length}
                </span>
              </div>

              {dayAppointments.length > 0 ? (
                <ul className="space-y-3">
                  {dayAppointments.map((appointment) => {
                    const lead = one(appointment.lead);

                    return (
                      <li
                        key={appointment.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <time
                            dateTime={appointment.scheduled_at}
                            className="text-sm font-semibold text-zinc-950"
                          >
                            {timeFormatter.format(new Date(appointment.scheduled_at))}
                          </time>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${outcomeClass(
                              appointment.outcome,
                            )}`}
                          >
                            {label(APPOINTMENT_OUTCOMES, appointment.outcome)}
                          </span>
                        </div>

                        <Link
                          href={`/leads/${lead?.id ?? appointment.lead_id}`}
                          className="mt-2 block text-sm font-semibold text-zinc-800 transition hover:text-zinc-950"
                        >
                          {lead?.parent_name ?? "Lead detayına git"}
                        </Link>
                        <p className="mt-1 text-xs font-medium text-zinc-500">
                          {label(APPOINTMENT_TYPES, appointment.type)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
                  Bu gün randevu yok.
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
