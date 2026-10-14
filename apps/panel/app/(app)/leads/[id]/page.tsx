import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { ActivityFeed, type ActivityFeedItem } from "@/components/activity-feed";
import { AppointmentForm } from "@/components/appointment-form";
import {
  AppointmentList,
  type AppointmentListItem,
} from "@/components/appointment-list";
import { LeadConversionForm } from "@/components/lead-conversion-form";
import { LeadEditForm } from "@/components/lead-edit-form";
import { NoteForm } from "@/components/note-form";
import { OfferForm, type ActivePriceItem } from "@/components/offer-form";
import { OfferList, type OfferListItem } from "@/components/offer-list";
import { StatusSelect } from "@/components/status-select";
import { WhatsAppButton } from "@/components/whatsapp-button";
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
import { getSessionProfile } from "@/lib/auth";
import { formatTRY, tlToKurus } from "@/lib/money";
import { attributionLines, type LeadAttribution } from "@/lib/lead-attribution";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

interface LeadDetailPageProps {
  params: Params;
}

interface ProfileJoin {
  id: string;
  full_name: string;
}

interface LeadRow extends LeadAttribution {
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
  ingilizce_gerekli: boolean;
  ozel_durum: boolean;
  ozel_durum_note: string | null;
  wants_summer: boolean;
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
        <h2 className="text-xl font-semibold text-foreground">Randevular</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Geçmiş ve gelecek randevuları takip edin, sonuçlarını işaretleyin.
        </p>
      </div>
      <AppointmentForm leadId={leadId} />
      {hasError ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
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
    <section id="teklifler" className="space-y-4 scroll-mt-24">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Teklifler</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Liste fiyatı, indirim ve yönetici onay sürecini buradan takip edin.
        </p>
      </div>
      <OfferForm leadId={leadId} priceItems={priceItems} />
      {hasError ? (
        <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
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
  const profile = await getSessionProfile();

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
        "id, parent_name, phone, child_name, child_birth_month, child_birth_year, source, source_detail, gclid, utm_source, utm_medium, utm_campaign, landing_path, status, lost_reason, ingilizce_gerekli, ozel_durum, ozel_durum_note, wants_summer, assigned_to, converted_student_id, last_activity_at, created_at, assigned:profiles!leads_assigned_to_fkey(id, full_name)",
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
  const converted = lead.converted_student_id !== null;
  const hasApprovedOffer = offers.some((offer) => offer.status === "onaylandi");
  const canConvert = !converted && hasApprovedOffer;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/pipeline"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Pipeline ekranına dön
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">{lead.parent_name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lead detayını, notları ve sistem aktivitelerini takip edin.
          </p>
        </div>
        <Link
          href="/leads/new"
          className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Yeni Lead
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Veli</p>
                <h2 className="mt-1 text-2xl font-semibold text-foreground">
                  {lead.parent_name}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Phone aria-hidden="true" className="size-4" />
                    Ara
                  </a>
                  <WhatsAppButton phone={lead.phone} />
                </div>
              </div>
              <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold text-slate-700">
                {label(LEAD_SOURCES, lead.source)}
              </span>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Telefon</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {lead.phone}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Çocuk</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {formatChild(lead)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Danışman</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {assigned?.full_name ?? "Atanmamış"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Kaynak</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {label(LEAD_SOURCES, lead.source)}
                </dd>
              </div>
              {lead.source_detail ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Kaynak detayı
                  </dt>
                  <dd className="mt-1 rounded-2xl bg-muted px-3 py-2 text-sm text-slate-700">
                    {lead.source_detail}
                  </dd>
                </div>
              ) : null}
              {attributionLines(lead).length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Web kaynağı
                  </dt>
                  <dd className="mt-1 space-y-1 rounded-2xl bg-muted px-3 py-2 text-sm text-slate-700">
                    {attributionLines(lead).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>

            {lead.ingilizce_gerekli || lead.ozel_durum || lead.wants_summer ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {lead.ingilizce_gerekli ? (
                  <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold text-slate-700">
                    İngilizce
                  </span>
                ) : null}
                {lead.ozel_durum ? (
                  <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold text-slate-700">
                    Özel durum
                  </span>
                ) : null}
                {lead.wants_summer ? (
                  <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold text-slate-700">
                    Yaz okulu
                  </span>
                ) : null}
              </div>
            ) : null}

            {lead.ozel_durum && lead.ozel_durum_note ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Özel durum notu
                </p>
                <p className="mt-1 rounded-2xl bg-muted px-3 py-2 text-sm text-slate-700">
                  {lead.ozel_durum_note}
                </p>
              </div>
            ) : null}
          </section>

          {converted ? null : (
            <LeadEditForm
              lead={{
                id: lead.id,
                parent_name: lead.parent_name,
                phone: lead.phone,
                source: lead.source,
                source_detail: lead.source_detail,
                child_name: lead.child_name,
                child_birth_month: lead.child_birth_month,
                child_birth_year: lead.child_birth_year,
                ingilizce_gerekli: lead.ingilizce_gerekli,
                ozel_durum: lead.ozel_durum,
                ozel_durum_note: lead.ozel_durum_note,
                wants_summer: lead.wants_summer,
              }}
              role={profile.role}
            />
          )}

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
              <h2 className="text-xl font-semibold text-foreground">
                Aktivite Akışı
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sistem aktiviteleri ve ekip notları en yeniden eskiye sıralanır.
              </p>
            </div>
            {notesResult.error || eventsResult.error ? (
              <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
                Aktivite akışı yüklenirken bir sorun oluştu.
              </p>
            ) : (
              <ActivityFeed items={feedItems} />
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Durum</h2>
            <div className="mt-4">
              {converted ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-slate-700">
                    {label(LEAD_STATUSES, lead.status)}
                    {lead.lost_reason
                      ? ` - ${label(LOST_REASONS, lead.lost_reason)}`
                      : ""}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Bu lead öğrenciye dönüştürüldüğü için durum kilitli.
                  </p>
                  <Link
                    href={`/ogrenciler/${lead.converted_student_id}`}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          {converted ? null : (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">
                Kayıt işlemi
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {canConvert
                  ? "Onaylı teklif ile öğrenci kaydı ve ödeme planı hazırlayın."
                  : "Öğrenciye dönüştürmek için önce teklif oluşturup onaylayın."}
              </p>
              <div className="mt-4 space-y-3">
                {canConvert ? (
                  <LeadConversionForm leadId={lead.id} canConvert />
                ) : (
                  <>
                    <a
                      href="#teklifler"
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
                    >
                      Teklifler bölümüne git
                    </a>
                    <button
                      type="button"
                      disabled
                      className="min-h-11 w-full cursor-not-allowed rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white opacity-50"
                    >
                      Öğrenciye Dönüştür
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          <NoteForm leadId={lead.id} />
        </aside>
      </div>
    </div>
  );
}
