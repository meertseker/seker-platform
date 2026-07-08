import Link from "next/link";
import { LeadCard, type LeadCardData } from "@/components/lead-card";
import {
  label,
  LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadSource,
  type LeadStatus,
} from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface PipelinePageProps {
  searchParams: SearchParams;
}

interface ProfileOption {
  id: string;
  full_name: string;
}

const statusKeys = Object.keys(LEAD_STATUSES) as LeadStatus[];
const openStatuses = statusKeys.filter(
  (status) => status !== "kazanildi" && status !== "kaybedildi",
);
const sourceKeys = Object.keys(LEAD_SOURCES) as LeadSource[];
const pageSize = 50;

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

type RawLead = Omit<LeadCardData, "assigned"> & {
  assigned?: LeadCardData["assigned"] | LeadCardData["assigned"][] | null;
};

function normalizeLead(lead: RawLead) {
  const assigned = Array.isArray(lead.assigned)
    ? (lead.assigned[0] ?? null)
    : (lead.assigned ?? null);

  return { ...lead, assigned } as LeadCardData;
}

function hrefWith(
  params: { danisman?: string; kaynak?: string; arsiv?: string; sayfa?: string },
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
  return query ? `/pipeline?${query}` : "/pipeline";
}

export default async function PipelinePage({ searchParams }: PipelinePageProps) {
  const params = await searchParams;
  const danisman = first(params.danisman) ?? "";
  const kaynak = normalizeSource(first(params.kaynak));
  const archive = first(params.arsiv) === "1";
  const page = archive ? normalizePage(first(params.sayfa)) : 1;
  const supabase = await createServerSupabase();

  const [{ data: profiles }, leadsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    (async () => {
      let query = supabase
        .from("leads")
        .select(
          "id, parent_name, phone, child_name, child_birth_month, child_birth_year, source, source_detail, status, lost_reason, assigned_to, converted_student_id, last_activity_at, assigned:profiles!leads_assigned_to_fkey(id, full_name)",
          { count: archive ? "exact" : undefined },
        )
        .order("last_activity_at", { ascending: false });

      if (archive) {
        query = query.in("status", ["kazanildi", "kaybedildi"]);
      } else {
        query = query.not("status", "in", "(kazanildi,kaybedildi)");
      }

      if (danisman) query = query.eq("assigned_to", danisman);
      if (kaynak) query = query.eq("source", kaynak);
      if (archive) {
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      return query;
    })(),
  ]);

  const leads = ((leadsResult.data ?? []) as unknown as RawLead[]).map(
    normalizeLead,
  );
  const totalCount = leadsResult.count ?? leads.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentParams = {
    danisman,
    kaynak,
    arsiv: archive ? "1" : undefined,
    sayfa: archive ? String(page) : undefined,
  };

  const leadsByStatus = new Map<LeadStatus, LeadCardData[]>(
    openStatuses.map((status) => [status, []]),
  );
  if (!archive) {
    for (const lead of leads) {
      leadsByStatus.get(lead.status)?.push(lead);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Lead takibi</p>
          <h1 className="mt-1 text-3xl font-semibold">
            {archive ? "Kazanılan/Kaybedilen Arşivi" : "Pipeline"}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Lead durumlarını takip edin, filtreleyin ve hızlıca güncelleyin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/leads/new"
            className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Yeni Lead
          </Link>
          <Link
            href={hrefWith(currentParams, {
              arsiv: archive ? undefined : "1",
              sayfa: undefined,
            })}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
          >
            {archive ? "Açık Pipeline" : "Kazanılan/Kaybedilen Arşivi"}
          </Link>
        </div>
      </div>

      <form
        action="/pipeline"
        className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        {archive ? <input type="hidden" name="arsiv" value="1" /> : null}
        <div>
          <label
            htmlFor="danisman"
            className="text-sm font-medium text-zinc-700"
          >
            Danışman
          </label>
          <select
            id="danisman"
            name="danisman"
            defaultValue={danisman}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="">Tüm danışmanlar</option>
            {(profiles ?? []).map((profile: ProfileOption) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kaynak" className="text-sm font-medium text-zinc-700">
            Kaynak
          </label>
          <select
            id="kaynak"
            name="kaynak"
            defaultValue={kaynak}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="">Tüm kaynaklar</option>
            {sourceKeys.map((source) => (
              <option key={source} value={source}>
                {label(LEAD_SOURCES, source)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Filtrele
        </button>
      </form>

      {leadsResult.error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Leadler yüklenemedi.
        </p>
      ) : null}

      {archive ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              {totalCount} kayıt, sayfa {page}/{totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                aria-disabled={page <= 1}
                href={
                  page <= 1
                    ? hrefWith(currentParams, {})
                    : hrefWith(currentParams, { sayfa: String(page - 1) })
                }
                className={`rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold ${
                  page <= 1
                    ? "pointer-events-none text-zinc-300"
                    : "text-zinc-700 hover:border-zinc-300 hover:text-zinc-950"
                }`}
              >
                Önceki
              </Link>
              <Link
                aria-disabled={page >= totalPages}
                href={
                  page >= totalPages
                    ? hrefWith(currentParams, {})
                    : hrefWith(currentParams, { sayfa: String(page + 1) })
                }
                className={`rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold ${
                  page >= totalPages
                    ? "pointer-events-none text-zinc-300"
                    : "text-zinc-700 hover:border-zinc-300 hover:text-zinc-950"
                }`}
              >
                Sonraki
              </Link>
            </div>
          </div>
          {leads.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} archived />
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              Arşivde kayıt yok.
            </p>
          )}
        </section>
      ) : (
        <section className="grid grid-flow-col auto-cols-[18rem] gap-4 overflow-x-auto pb-4 md:grid-flow-row md:grid-cols-5 md:auto-cols-auto md:overflow-visible">
          {openStatuses.map((status) => {
            const statusLeads = leadsByStatus.get(status) ?? [];

            return (
              <div
                key={status}
                className="min-h-96 rounded-3xl border border-zinc-200 bg-zinc-100/70 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <h2 className="font-semibold text-zinc-900">
                    {label(LEAD_STATUSES, status)}
                  </h2>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600">
                    {statusLeads.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {statusLeads.length > 0 ? (
                    statusLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} />
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-center text-sm text-zinc-500">
                      Bu durumda lead yok.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
