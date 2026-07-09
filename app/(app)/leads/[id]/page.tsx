import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityFeed, type ActivityFeedItem } from "@/components/activity-feed";
import { AppointmentForm } from "@/components/appointment-form";
import {
  AppointmentList,
  type AppointmentListItem,
} from "@/components/appointment-list";
import { LeadConversionForm } from "@/components/lead-conversion-form";
import { NoteForm } from "@/components/note-form";
import { OfferForm, type ActivePriceItem } from "@/components/offer-form";
import { OfferList, type OfferListItem } from "@/components/offer-list";
import { StatusSelect } from "@/components/status-select";
import {
  label,
  type AppointmentOutcome,
  type AppointmentType,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOST_REASONS,
  type LeadSource,
  type LeadStatus,
  type LostReason,
  type OfferStatus,
  type Program,
} from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatTRY, tlToKurus } from "@/lib/money";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

interface LeadDetailPageProps {
  params: Params;
}

interface ProfileJoin {
  id: string;
  full_name: string;
}

interface LeadRow {
  id: string;
  parent_name: string;
  phone: string;
  child_name: string | null;
  child_birth_month: number | null;
  child_birth_year: number | null;
  source: LeadSource;
  source_detail: string | null;
  status: LeadStatus;
  lost_reason: LostReason | null;
  assigned_to: string | null;
  converted_student_id: string | null;
  last_activity_at: string;
  created_at: string;
  assigned?: ProfileJoin | ProfileJoin[] | null;
}

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  author?: ProfileJoin | ProfileJoin[] | null;
}

interface EventRow {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
  actor?: ProfileJoin | ProfileJoin[] | null;
}

interface AppointmentRow {
  id: string;
  scheduled_at: string;
  type: AppointmentType;
  outcome: AppointmentOutcome;
  outcome_note: string | null;
}

interface OfferRow {
  id: string;
  program: Program;
  list_price: number;
  offered_price: number;
  installment_count: number;
  note: string | null;
  status: OfferStatus;
  counter_price: number | null;
  superseded_by_offer_id: string | null;
  created_at: string;
  creator?: ProfileJoin | ProfileJoin[] | null;
}

interface PriceItemRow {
  program: Program;
  monthly_fee: number;
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function payloadObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatChild(lead: LeadRow) {
  const month = lead.child_birth_month?.toString().padStart(2, "0");
  const birth = [month, lead.child_birth_year].filter(Boolean).join("/");

  if (lead.child_name && birth) return `${lead.child_name} (${birth})`;
  if (lead.child_name) return lead.child_name;
  if (birth) return `Doğum: ${birth}`;
  return "Çocuk bilgisi yok";
}

const offerDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

function discountPercent(listPrice: number, offeredPrice: number) {
  if (listPrice <= 0 || offeredPrice >= listPrice) return 0;
  return Math.round(((listPrice - offeredPrice) / listPrice) * 100);
}

function normalizeFeed(notes: NoteRow[], events: EventRow[]): ActivityFeedItem[] {
  const noteItems: ActivityFeedItem[] = notes.map((note) => ({
    type: "note",
    id: `note-${note.id}`,
    body: note.body,
    createdAt: note.created_at,
    actorName: one(note.author)?.full_name ?? null,
  }));

  const eventItems: ActivityFeedItem[] = events.map((event) => ({
    type: "event",
    id: `event-${event.id}`,
    eventType: event.event_type,
    payload: payloadObject(event.payload),
    createdAt: event.created_at,
    actorName: one(event.actor)?.full_name ?? null,
  }));

  return [...noteItems, ...eventItems].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

function LeadAppointmentsSection({
  leadId,
  appointments,
  hasError,
}: {
  leadId: string;
  appointments: AppointmentListItem[];
  hasError: boolean;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Randevular</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Geçmiş ve gelecek randevuları takip edin, sonuçlarını işaretleyin.
        </p>
      </div>
      <AppointmentForm leadId={leadId} />
      {hasError ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Randevular yüklenirken bir sorun oluştu.
        </p>
      ) : (
        <AppointmentList appointments={appointments} />
      )}
    </section>
  );
}

function normalizeOffers(offers: OfferRow[]): OfferListItem[] {
  const acceptedCounterPrices = new Set(
    offers
      .filter((offer) => offer.status === "onaylandi")
      .map((offer) => Number(offer.offered_price).toFixed(2)),
  );

  return offers.map((offer) => {
    const listPrice = Number(offer.list_price);
    const offeredPrice = Number(offer.offered_price);
    const counterPrice =
      offer.counter_price === null ? null : Number(offer.counter_price);

    return {
      id: offer.id,
      program: offer.program,
      list_price: listPrice,
      offered_price: offeredPrice,
      installment_count: offer.installment_count,
      note: offer.note,
      status: offer.status,
      counter_price: counterPrice,
      superseded_by_offer_id: offer.superseded_by_offer_id,
      created_at: offer.created_at,
      creatorName: one(offer.creator)?.full_name ?? null,
      listPriceText: formatTRY(tlToKurus(listPrice)),
      offeredPriceText: formatTRY(tlToKurus(offeredPrice)),
      counterPriceText:
        counterPrice === null ? null : formatTRY(tlToKurus(counterPrice)),
      createdAtText: offerDateFormatter.format(new Date(offer.created_at)),
      discountText: `%${discountPercent(listPrice, offeredPrice)}`,
      counterAccepted:
        offer.status === "revize_edildi" &&
        counterPrice !== null &&
        acceptedCounterPrices.has(counterPrice.toFixed(2)),
    };
  });
}

function normalizePriceItems(items: PriceItemRow[]): ActivePriceItem[] {
  return items.map((item) => ({
    program: item.program,
    monthly_fee: Number(item.monthly_fee),
    monthly_fee_text: formatTRY(tlToKurus(Number(item.monthly_fee))),
  }));
}

function LeadOffersSection({
  leadId,
  offers,
  priceItems,
  hasError,
}: {
  leadId: string;
  offers: OfferListItem[];
  priceItems: ActivePriceItem[];
  hasError: boolean;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Teklifler</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Liste fiyatı, indirim ve yönetici onay sürecini buradan takip edin.
        </p>
      </div>
      <OfferForm leadId={leadId} priceItems={priceItems} />
      {hasError ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Teklifler yüklenirken bir sorun oluştu.
        </p>
      ) : (
        <OfferList offers={offers} />
      )}
    </section>
  );
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [
    leadResult,
    notesResult,
    eventsResult,
    appointmentsResult,
    offersResult,
    priceItemsResult,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, parent_name, phone, child_name, child_birth_month, child_birth_year, source, source_detail, status, lost_reason, assigned_to, converted_student_id, last_activity_at, created_at, assigned:profiles!leads_assigned_to_fkey(id, full_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("lead_notes")
      .select("id, body, created_at, author:profiles!lead_notes_author_id_fkey(id, full_name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, event_type, payload, created_at, actor:profiles!events_actor_id_fkey(id, full_name)")
      .eq("entity_type", "lead")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id, scheduled_at, type, outcome, outcome_note")
      .eq("lead_id", id)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("offers")
      .select(
        "id, program, list_price, offered_price, installment_count, note, status, counter_price, superseded_by_offer_id, created_at, creator:profiles!offers_created_by_fkey(id, full_name)",
      )
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("price_list_items")
      .select("program, monthly_fee, price_list:price_lists!inner(is_active)")
      .eq("price_list.is_active", true)
      .order("program", { ascending: true }),
  ]);

  if (leadResult.error || !leadResult.data) notFound();

  const lead = leadResult.data as unknown as LeadRow;
  const assigned = one(lead.assigned);
  const feedItems = normalizeFeed(
    (notesResult.data ?? []) as unknown as NoteRow[],
    (eventsResult.data ?? []) as unknown as EventRow[],
  );
  const appointments = (appointmentsResult.data ?? []) as unknown as AppointmentRow[];
  const offers = normalizeOffers((offersResult.data ?? []) as unknown as OfferRow[]);
  const priceItems = normalizePriceItems(
    (priceItemsResult.data ?? []) as unknown as PriceItemRow[],
  );
  const whatsappNumber = lead.phone.replace(/\D/g, "");
  const converted = lead.converted_student_id !== null;
  const hasApprovedOffer = offers.some((offer) => offer.status === "onaylandi");
  const canConvert = !converted && (lead.status === "kazanildi" || hasApprovedOffer);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/pipeline"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
          >
            Pipeline ekranına dön
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">{lead.parent_name}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Lead detayını, notları ve sistem aktivitelerini takip edin.
          </p>
        </div>
        <Link
          href="/leads/new"
          className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          Yeni Lead
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Veli</p>
                <h2 className="mt-1 text-2xl font-semibold text-zinc-950">
                  {lead.parent_name}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`tel:${lead.phone}`}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
                  >
                    Ara
                  </a>
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 transition hover:border-green-300"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
              <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                {label(LEAD_SOURCES, lead.source)}
              </span>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-zinc-500">Telefon</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">
                  {lead.phone}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Çocuk</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">
                  {formatChild(lead)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Danışman</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">
                  {assigned?.full_name ?? "Atanmamış"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Kaynak</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">
                  {label(LEAD_SOURCES, lead.source)}
                </dd>
              </div>
              {lead.source_detail ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-zinc-500">
                    Kaynak detayı
                  </dt>
                  <dd className="mt-1 rounded-2xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    {lead.source_detail}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <LeadAppointmentsSection
            leadId={lead.id}
            appointments={appointments}
            hasError={Boolean(appointmentsResult.error)}
          />
          <LeadOffersSection
            leadId={lead.id}
            offers={offers}
            priceItems={priceItems}
            hasError={Boolean(offersResult.error || priceItemsResult.error)}
          />

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-950">
                Aktivite Akışı
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Sistem aktiviteleri ve ekip notları en yeniden eskiye sıralanır.
              </p>
            </div>
            {notesResult.error || eventsResult.error ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                Aktivite akışı yüklenirken bir sorun oluştu.
              </p>
            ) : (
              <ActivityFeed items={feedItems} />
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">Durum</h2>
            <div className="mt-4">
              {converted ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700">
                    {label(LEAD_STATUSES, lead.status)}
                    {lead.lost_reason
                      ? ` - ${label(LOST_REASONS, lead.lost_reason)}`
                      : ""}
                  </div>
                  <p className="text-sm text-zinc-600">
                    Bu lead öğrenciye dönüştürüldüğü için durum kilitli.
                  </p>
                  <Link
                    href={`/ogrenciler/${lead.converted_student_id}`}
                    className="inline-flex rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
                  >
                    Öğrenci kaydına git
                  </Link>
                </div>
              ) : (
                <StatusSelect
                  leadId={lead.id}
                  status={lead.status}
                  converted={converted}
                />
              )}
            </div>
          </section>

          {canConvert ? (
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-950">
                Kayıt işlemi
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Onaylı teklif ile öğrenci kaydı ve ödeme planı hazırlayın.
              </p>
              <div className="mt-4">
                <LeadConversionForm leadId={lead.id} canConvert={canConvert} />
              </div>
            </section>
          ) : null}

          <NoteForm leadId={lead.id} />
        </aside>
      </div>
    </div>
  );
}
