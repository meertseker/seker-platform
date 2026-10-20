import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft, Phone } from "lucide-react";
import { ActivityFeed, type ActivityFeedItem } from "@/components/activity-feed";
import {
  AppointmentList,
  type AppointmentListItem,
} from "@/components/appointment-list";
import { CallButton } from "@/components/call-outcome";
import { FollowupTimeline } from "@/components/followup-timeline";
import { LeadOriginCard } from "@/components/lead-origin-card";
import { MessageTemplates, type MessageTemplateLink } from "@/components/message-templates";
import { LeadActions, type LeadSheet } from "@/components/lead-actions";
import { NoteForm } from "@/components/note-form";
import { type ActivePriceItem } from "@/components/offer-form";
import { OfferList, type OfferListItem } from "@/components/offer-list";
import { StageStepper } from "@/components/stage-stepper";
import { WhatsAppButton } from "@/components/whatsapp-button";
import {
  label,
  type AppointmentOutcome,
  type AppointmentType,
  LEAD_SOURCES,
  type LeadSource,
  type LeadStatus,
  type LostReason,
  type OfferStatus,
  type Program,
} from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { formatTRY, tlToKurus } from "@/lib/money";
import { attributionLines, originLines, type LeadAttribution } from "@/lib/lead-attribution";
import { formatDayTime } from "@/lib/lead-flow/business-hours";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { cardTemplates, suppressCallStep } from "@/lib/lead-flow/card";
import { fillTemplate } from "@/lib/lead-flow/template";
import { buildFollowupTimeline, type TimelineTask } from "@/lib/lead-flow/timeline";
import { waMeUrl } from "@/lib/whatsapp";
import { nextStep } from "@/lib/next-step";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Veli" };

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface LeadDetailPageProps {
  params: Params;
  searchParams: SearchParams;
}

const SHEETS: LeadSheet[] = ["randevu", "teklif", "kayit", "not", "sonuc", "durum", "duzenle"];

function parseSheet(value: string | string[] | undefined): LeadSheet | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && SHEETS.includes(raw as LeadSheet) ? (raw as LeadSheet) : null;
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
  channel: string | null;
  content_code: string | null;
  district: string | null;
  start_window: string | null;
  wants_whatsapp: boolean | null;
  first_contact_at: string | null;
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

interface TaskRow {
  rule_key: string;
  status: string;
  due_at: string | null;
  created_at: string;
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

export default async function LeadDetailPage({ params, searchParams }: LeadDetailPageProps) {
  const { id } = await params;
  const initialSheet = parseSheet((await searchParams).adim);
  const supabase = await createServerSupabase();
  const profile = await getSessionProfile();

  const [
    leadResult,
    notesResult,
    eventsResult,
    appointmentsResult,
    offersResult,
    priceItemsResult,
    tasksResult,
    settings,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, parent_name, phone, child_name, child_birth_month, child_birth_year, channel, content_code, district, start_window, wants_whatsapp, first_contact_at, source, source_detail, ad_platform, gclid, utm_source, utm_medium, utm_campaign, landing_path, status, lost_reason, ingilizce_gerekli, ozel_durum, ozel_durum_note, wants_summer, assigned_to, converted_student_id, last_activity_at, created_at, assigned:profiles!leads_assigned_to_fkey(id, full_name)",
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
    supabase
      .from("tasks")
      .select("rule_key, status, due_at, created_at")
      .eq("lead_id", id)
      .not("rule_key", "is", null),
    getLeadFlowSettings(supabase),
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
  const nowIso = new Date().toISOString();
  const step = nextStep({
    lead: {
      status: lead.status,
      converted_student_id: lead.converted_student_id,
      lost_reason: lead.lost_reason,
    },
    appointments,
    offers,
    now: nowIso,
  });
  const appointmentItems: AppointmentListItem[] = appointments.map((item) => ({ ...item }));
  const resultAppointments = appointmentItems
    .filter(
      (item) =>
        item.outcome === "bekliyor" && Date.parse(item.scheduled_at) <= Date.parse(nowIso),
    )
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const counterOffer = offers.find(
    (offer) =>
      offer.status === "revize_edildi" &&
      offer.counter_price !== null &&
      !offer.superseded_by_offer_id &&
      !offer.counterAccepted,
  );
  const convertBlocker = converted
    ? "Bu veli zaten öğrenci."
    : lead.status === "kaybedildi"
      ? "Kaybedilen veli öğrenciye dönüştürülemez. Önce yeniden açın."
      : offers.some((offer) => offer.status === "onay_bekliyor")
        ? "Teklif yönetici onayı bekliyor. Onaylanınca kayıt açılabilir."
        : counterOffer
          ? "Yönetici karşı rakam verdi. Önce o rakamla teklif oluşturun."
          : "Kayıt için onaylı bir teklif gerekiyor. Önce teklif hazırlayın.";
  const attribution = attributionLines(lead);
  const hasApplicationInfo = Boolean(lead.source_detail) || attribution.length > 0;
  const origin = originLines(lead);
  const originSub = [formatDayTime(new Date(lead.created_at)), origin.channelLabel.startsWith("Google") ? null : lead.landing_path]
    .filter(Boolean)
    .join(" · ");
  const events = (eventsResult.data ?? []) as unknown as EventRow[];
  const lastReachAt =
    events.find((event) => {
      const result = payloadObject(event.payload)?.result;
      return event.event_type === "arama_kaydi" && (result === "randevu" || result === "geri_ara");
    })?.created_at ?? null;
  const timeline = tasksResult.error || eventsResult.error
    ? null
    : buildFollowupTimeline({
        leadId: lead.id,
        status: lead.status,
        lostReason: lead.lost_reason,
        firstContactAt: lead.first_contact_at,
        lastReachAt,
        tasks: ((tasksResult.data ?? []) as TaskRow[]).map(
          (task): TimelineTask => ({
            ruleKey: task.rule_key,
            status: task.status,
            dueAt: task.due_at,
            createdAt: task.created_at,
          }),
        ),
      });
  const danisman = profile.full_name?.split(" ")[0] || profile.full_name || "";
  const timelineActive = timeline?.state === "active";
  // R19: takip sırası etkinken tek arama yolu onun üstlenen "Ara · açtı" düğmesidir.
  const leadStep = suppressCallStep(step, timelineActive);
  const messageItems: MessageTemplateLink[] = cardTemplates(settings.templates, {
    status: lead.status,
    hasPendingAppointment: appointments.some((item) => item.outcome === "bekliyor"),
  }).map((template) => {
    const text = fillTemplate(template.text, { veli: lead.parent_name, danisman });
    return { key: template.key, label: template.label, text, href: waMeUrl(lead.phone, text) };
  });
  const tags = [
    lead.ingilizce_gerekli ? "İngilizce" : null,
    lead.ozel_durum ? "Özel durum" : null,
    lead.wants_summer ? "Yaz okulu" : null,
  ].filter((tag): tag is string => tag !== null);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/pipeline"
          className="inline-flex min-h-12 items-center gap-1 rounded-xl pr-3 text-base font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft aria-hidden className="size-5" />
          Veliler
        </Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold text-foreground">{lead.parent_name}</h1>
            <p className="mt-1 text-base text-muted-foreground">
              {formatChild(lead)} · {label(LEAD_SOURCES, lead.source)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {timelineActive ? (
              // Takip sırası etkinken yalnız numarayı açar; arama kaydı "Ara · açtı" yolundan yapılır.
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Phone aria-hidden className="size-4" />
                Telefonu aç
              </a>
            ) : (
              <CallButton
                leadId={lead.id}
                phone={lead.phone}
                leadName={lead.parent_name}
                contacted={!!lead.first_contact_at}
              />
            )}
            <WhatsAppButton phone={lead.phone} />
          </div>
        </div>
      </div>

      <StageStepper status={lead.status} lostReason={lead.lost_reason} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <LeadOriginCard
          channelLabel={origin.channelLabel}
          codeLabel={origin.codeLabel}
          sub={originSub || null}
          answers={origin.answers}
          fromForm={lead.channel === "form" || Boolean(lead.gclid)}
        />
        {timeline ? (
          <FollowupTimeline
            leadId={lead.id}
            timeline={timeline}
            nowMs={Date.parse(nowIso)}
          />
        ) : (
          <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive-strong">
            Takip sırası yüklenirken bir sorun oluştu.
          </p>
        )}
        <MessageTemplates items={messageItems} />
      </div>

      <LeadActions
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
        status={lead.status}
        convertedStudentId={lead.converted_student_id}
        role={profile.role}
        step={leadStep}
        initialSheet={initialSheet}
        priceItems={priceItems}
        resultAppointments={resultAppointments}
        counterOfferId={counterOffer?.id ?? null}
        contacted={!!lead.first_contact_at}
        canConvert={canConvert}
        convertBlocker={convertBlocker}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Randevular</h2>
            {appointmentsResult.error ? (
              <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
                Randevular yüklenirken bir sorun oluştu.
              </p>
            ) : (
              <AppointmentList appointments={appointmentItems} emptyText="Henüz randevu yok." />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Teklifler</h2>
            {offersResult.error || priceItemsResult.error ? (
              <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
                Teklifler yüklenirken bir sorun oluştu.
              </p>
            ) : (
              <OfferList offers={offers} />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Geçmiş</h2>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <NoteForm leadId={lead.id} rows={2} />
            </div>
            {notesResult.error || eventsResult.error ? (
              <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
                Geçmiş yüklenirken bir sorun oluştu.
              </p>
            ) : (
              <ActivityFeed items={feedItems} />
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Bilgiler</h2>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-sm text-muted-foreground">Telefon</dt>
                <dd className="text-base font-medium tabular-nums text-foreground">{lead.phone}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Çocuk</dt>
                <dd className="text-base font-medium text-foreground">{formatChild(lead)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Danışman</dt>
                <dd className="text-base font-medium text-foreground">
                  {assigned?.full_name ?? "Atanmamış"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Kaynak</dt>
                <dd className="text-base font-medium text-foreground">
                  {label(LEAD_SOURCES, lead.source)}
                </dd>
              </div>
            </dl>
            {tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {lead.ozel_durum && lead.ozel_durum_note ? (
              <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold">Özel durum:</span> {lead.ozel_durum_note}
              </p>
            ) : null}
          </section>

          {hasApplicationInfo ? (
            <details className="group rounded-2xl border border-border bg-surface shadow-sm">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-5 py-3 text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Başvuru bilgisi
                <ChevronDown aria-hidden className="size-5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2 px-5 pb-5 text-sm text-slate-700">
                {lead.source_detail ? (
                  <p>
                    <span className="font-semibold">Kaynak detayı:</span> {lead.source_detail}
                  </p>
                ) : null}
                {attribution.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </details>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
