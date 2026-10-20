import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { LeadCard, WAITING_DAYS_THRESHOLD, type LeadCardData } from "@/components/lead-card";
import { getSessionProfile } from "@/lib/auth";
import {
  label,
  LEAD_SOURCES,
  LEAD_STATUSES,
  type AppointmentOutcome,
  type LeadSource,
  type LeadStatus,
  type OfferStatus,
} from "@/lib/constants";
import {
  daysSince,
  nextStep,
  WEB_APPLICATION_SOURCES,
  type NextStepAppointment,
  type NextStepOffer,
} from "@/lib/next-step";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Veliler" };

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface PipelinePageProps {
  searchParams: SearchParams;
}

interface ProfileOption {
  id: string;
  full_name: string;
}

const QUICK_FILTERS = {
  tumu: "Tümü",
  benim: "Benim velilerim",
  bekleyen: "Bekleyenler",
  randevulu: "Randevulu",
} as const;
type QuickFilter = keyof typeof QUICK_FILTERS | "basvuru";

const statusKeys = Object.keys(LEAD_STATUSES) as LeadStatus[];
const openStatuses = statusKeys.filter(
  (status) => status !== "kazanildi" && status !== "kaybedildi",
);
const sourceKeys = Object.keys(LEAD_SOURCES) as LeadSource[];
const pageSize = 50;

const STATUS_DOTS: Record<LeadStatus, string> = {
  yeni: "bg-blue-500",
  ulasildi: "bg-sky-500",
  randevu: "bg-violet-500",
  gorusme_yapildi: "bg-amber-500",
  teklif: "bg-orange-500",
  beklemede: "bg-slate-500",
  kazanildi: "bg-emerald-500",
  kaybedildi: "bg-red-500",
};

const OUTLINE_CLASS =
  "inline-flex min-h-12 cursor-pointer items-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizeSource(value: string | undefined): LeadSource | "" {
  return value && sourceKeys.includes(value as LeadSource)
    ? (value as LeadSource)
    : "";
}

function normalizeFilter(value: string | undefined): QuickFilter {
  if (value === "basvuru") return "basvuru";
  return value && Object.hasOwn(QUICK_FILTERS, value) ? (value as QuickFilter) : "tumu";
}

type RawLead = Omit<LeadCardData, "assigned"> & {
  assigned?: LeadCardData["assigned"] | LeadCardData["assigned"][] | null;
};

function normalizeLead(lead: RawLead) {
  const assigned = Array.isArray(lead.assigned)
    ? (lead.assigned[0] ?? null)
    : (lead.assigned ?? null);

  return { ...lead, assigned } as LeadCardData;
}

interface PipelineParams {
  danisman?: string;
  kaynak?: string;
  arsiv?: string;
  sayfa?: string;
  filtre?: string;
}

function hrefWith(params: PipelineParams, updates: Record<string, string | undefined>) {
  const next = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) next.set(key, value);
  });
  Object.entries(updates).forEach(([key, value]) => {
    if (value) next.set(key, value);
    else next.delete(key);
  });

  const query = next.toString();
  return query ? `/pipeline?${query}` : "/pipeline";
}

export default async function PipelinePage({ searchParams }: PipelinePageProps) {
  const params = await searchParams;
  const danisman = first(params.danisman) ?? "";
  const kaynak = normalizeSource(first(params.kaynak));
  const archive = first(params.arsiv) === "1";
  const filter = archive ? "tumu" : normalizeFilter(first(params.filtre));
  const page = archive ? normalizePage(first(params.sayfa)) : 1;
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const staleCutoff = new Date(now.getTime() - WAITING_DAYS_THRESHOLD * 86400000).toISOString();
  const dayAgo = new Date(now.getTime() - 86400000).toISOString();

  const [{ data: profiles }, leadsResult, appointmentsResult, offersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .in("role", ["yonetici", "danisman"])
      .order("full_name", { ascending: true }),
    (async () => {
      let query = supabase
        .from("leads")
        .select(
          "id, parent_name, phone, child_name, child_birth_month, child_birth_year, source, source_detail, status, lost_reason, assigned_to, converted_student_id, last_activity_at, first_contact_at, assigned:profiles!leads_assigned_to_fkey(id, full_name)",
          { count: archive ? "exact" : undefined },
        )
        .order("last_activity_at", { ascending: false });

      if (archive) {
        query = query.in("status", ["kazanildi", "kaybedildi"]);
      } else {
        query = query.not("status", "in", "(kazanildi,kaybedildi)");
      }

      if (filter === "benim") query = query.eq("assigned_to", profile.id);
      if (filter === "bekleyen") query = query.lt("last_activity_at", staleCutoff);
      if (filter === "randevulu") query = query.eq("status", "randevu");
      if (filter === "basvuru") {
        query = query.eq("status", "yeni").in("source", WEB_APPLICATION_SOURCES).gte("created_at", dayAgo);
      }
      if (danisman) query = query.eq("assigned_to", danisman);
      if (kaynak) query = query.eq("source", kaynak);
      if (archive) {
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      return query;
    })(),
    archive
      ? Promise.resolve({ data: [] })
      : supabase
          .from("appointments")
          .select("lead_id, scheduled_at, outcome")
          .eq("outcome", "bekliyor"),
    archive
      ? Promise.resolve({ data: [] })
      : supabase
          .from("offers")
          .select("lead_id, status, counter_price, superseded_by_offer_id")
          .in("status", ["onay_bekliyor", "onaylandi", "revize_edildi"]),
  ]);

  const leads = ((leadsResult.data ?? []) as unknown as RawLead[]).map(normalizeLead);
  const totalCount = leadsResult.count ?? leads.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentParams: PipelineParams = {
    danisman,
    kaynak,
    arsiv: archive ? "1" : undefined,
    sayfa: archive ? String(page) : undefined,
    filtre: filter === "tumu" ? undefined : filter,
  };

  const appointmentsByLead = new Map<string, NextStepAppointment[]>();
  for (const row of (appointmentsResult.data ?? []) as {
    lead_id: string;
    scheduled_at: string;
    outcome: AppointmentOutcome;
  }[]) {
    const list = appointmentsByLead.get(row.lead_id) ?? [];
    list.push({ scheduled_at: row.scheduled_at, outcome: row.outcome });
    appointmentsByLead.set(row.lead_id, list);
  }
  const offersByLead = new Map<string, NextStepOffer[]>();
  for (const row of (offersResult.data ?? []) as {
    lead_id: string;
    status: OfferStatus;
    counter_price: number | null;
    superseded_by_offer_id: string | null;
  }[]) {
    const list = offersByLead.get(row.lead_id) ?? [];
    list.push({
      status: row.status,
      counter_price: row.counter_price === null ? null : Number(row.counter_price),
      superseded_by_offer_id: row.superseded_by_offer_id,
    });
    offersByLead.set(row.lead_id, list);
  }

  function cardFor(lead: LeadCardData) {
    const step = nextStep({
      lead,
      appointments: appointmentsByLead.get(lead.id) ?? [],
      offers: offersByLead.get(lead.id) ?? [],
      now: nowIso,
    });
    return (
      <LeadCard
        key={lead.id}
        lead={lead}
        step={step}
        waitingDays={daysSince(lead.last_activity_at, now)}
      />
    );
  }

  const leadsByStatus = new Map<LeadStatus, LeadCardData[]>(
    openStatuses.map((status) => [status, []]),
  );
  if (!archive) {
    for (const lead of leads) {
      leadsByStatus.get(lead.status)?.push(lead);
    }
  }
  const advancedActive = Boolean(danisman || kaynak);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">
            {archive ? "Kazanılan / Kaybedilen" : "Veliler"}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {archive
              ? "Kayıt olan ve kaybedilen veliler."
              : "Her velide sıradaki adım tek butonda."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/leads/new"
            className="inline-flex min-h-12 cursor-pointer items-center rounded-xl bg-primary px-5 py-2.5 text-base font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Yeni veli
          </Link>
          <Link
            href={hrefWith(
              { danisman, kaynak },
              { arsiv: archive ? undefined : "1" },
            )}
            className={OUTLINE_CLASS}
          >
            {archive ? "Açık veliler" : "Arşiv"}
          </Link>
        </div>
      </div>

      {archive ? null : (
        <nav aria-label="Hızlı filtre" className="flex flex-wrap gap-2">
          {filter === "basvuru" ? (
            <span className="inline-flex min-h-12 items-center rounded-full bg-primary px-4 text-sm font-semibold text-on-primary">
              Aranmayı bekleyen başvurular
            </span>
          ) : null}
          {(Object.keys(QUICK_FILTERS) as (keyof typeof QUICK_FILTERS)[]).map((key) => {
            const selected = filter === key;
            return (
              <Link
                key={key}
                href={hrefWith(currentParams, { filtre: key === "tumu" ? undefined : key })}
                aria-current={selected ? "page" : undefined}
                className={`inline-flex min-h-12 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border bg-surface text-slate-700 hover:border-slate-300"
                }`}
              >
                {QUICK_FILTERS[key]}
              </Link>
            );
          })}
        </nav>
      )}

      <details open={advancedActive} className="group rounded-2xl border border-border bg-surface shadow-sm">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          Diğer filtreler{advancedActive ? " (açık)" : ""}
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <form
          action="/pipeline"
          className="grid gap-3 px-4 pb-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          {archive ? <input type="hidden" name="arsiv" value="1" /> : null}
          {currentParams.filtre ? (
            <input type="hidden" name="filtre" value={currentParams.filtre} />
          ) : null}
          <div>
            <label htmlFor="danisman" className="text-sm font-medium text-slate-700">
              Danışman
            </label>
            <select
              id="danisman"
              name="danisman"
              defaultValue={danisman}
              className="mt-2 min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Tüm danışmanlar</option>
              {(profiles ?? []).map((option: ProfileOption) => (
                <option key={option.id} value={option.id}>
                  {option.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kaynak" className="text-sm font-medium text-slate-700">
              Kaynak
            </label>
            <select
              id="kaynak"
              name="kaynak"
              defaultValue={kaynak}
              className="mt-2 min-h-12 w-full rounded-xl border border-input bg-surface px-3 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Tüm kaynaklar</option>
              {sourceKeys.map((source) => (
                <option key={source} value={source}>
                  {label(LEAD_SOURCES, source)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={`${OUTLINE_CLASS} justify-center`}>
            Uygula
          </button>
        </form>
      </details>

      {leadsResult.error ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
          Veliler yüklenemedi.
        </p>
      ) : null}

      {archive ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {totalCount} kayıt, sayfa {page}/{totalPages}
            </p>
            <div className="flex gap-2">
              {page <= 1 ? (
                <span
                  aria-disabled="true"
                  className="inline-flex min-h-12 cursor-not-allowed items-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-slate-300"
                >
                  Önceki
                </span>
              ) : (
                <Link href={hrefWith(currentParams, { sayfa: String(page - 1) })} className={OUTLINE_CLASS}>
                  Önceki
                </Link>
              )}
              {page >= totalPages ? (
                <span
                  aria-disabled="true"
                  className="inline-flex min-h-12 cursor-not-allowed items-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-slate-300"
                >
                  Sonraki
                </span>
              ) : (
                <Link href={hrefWith(currentParams, { sayfa: String(page + 1) })} className={OUTLINE_CLASS}>
                  Sonraki
                </Link>
              )}
            </div>
          </div>
          {leads.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} archived />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
              Arşivde kayıt yok.
            </p>
          )}
        </section>
      ) : (
        <>
          {/* Telefon: aşamalara göre gruplanmış tek liste */}
          <section className="space-y-6 md:hidden">
            {leads.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
                Bu filtrede veli yok.
              </p>
            ) : null}
            {openStatuses.map((status) => {
              const statusLeads = leadsByStatus.get(status) ?? [];
              if (statusLeads.length === 0) return null;
              return (
                <div key={status} className="space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <span aria-hidden="true" className={`size-2.5 rounded-full ${STATUS_DOTS[status]}`} />
                    {label(LEAD_STATUSES, status)}
                    <span className="text-sm font-medium text-muted-foreground tabular-nums">
                      ({statusLeads.length})
                    </span>
                  </h2>
                  {statusLeads.map(cardFor)}
                </div>
              );
            })}
          </section>

          {/* Geniş ekran: aşama sütunları */}
          <section className="hidden gap-4 md:grid md:grid-cols-3 2xl:grid-cols-6">
            {openStatuses.map((status) => {
              const statusLeads = leadsByStatus.get(status) ?? [];

              return (
                <div key={status} className="min-h-96 rounded-2xl border border-border bg-muted/70 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2 px-1">
                    <h2 className="flex items-center gap-2 font-semibold text-foreground">
                      <span aria-hidden="true" className={`size-2 rounded-full ${STATUS_DOTS[status]}`} />
                      {label(LEAD_STATUSES, status)}
                    </h2>
                    <span className="rounded-full bg-surface px-2.5 py-1 text-sm font-semibold text-muted-foreground tabular-nums">
                      {statusLeads.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {statusLeads.length > 0 ? (
                      statusLeads.map(cardFor)
                    ) : (
                      <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-center text-sm text-muted-foreground">
                        Bu aşamada veli yok.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
