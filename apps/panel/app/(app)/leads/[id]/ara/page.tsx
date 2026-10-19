import Link from "next/link";
import { notFound } from "next/navigation";
import { CallScreen, type CallScreenLead } from "@/components/call-screen";
import { getSessionProfile } from "@/lib/auth";
import { clockStart } from "@/lib/lead-flow/business-hours";
import { callWaLink } from "@/lib/lead-flow/call-wa";
import { readConflictWindowMinutes } from "@/lib/lead-flow/conflict-window";
import { ageFromBirth, fillScript, suggestSlots } from "@/lib/lead-flow/script";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";
import { heldByOther } from "@/lib/queries/call-queue";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Arama" };

export const dynamic = "force-dynamic";

const UNKNOWN_CLAIMER = "Başka bir danışman";
const TIMING_OK = ["hemen", "1_3_ay", "3_6_ay"];
// Önerilen saatler 5 iş gününe yayılır; iki hafta hafta sonu ve tatille birlikte yeter.
const SLOT_LOOKAHEAD_MS = 14 * 86_400_000;

interface LeadRow {
  id: string;
  parent_name: string;
  phone: string;
  source: string;
  source_detail: string | null;
  channel: string | null;
  content_code: string | null;
  district: string | null;
  start_window: string | null;
  child_birth_month: number | null;
  child_birth_year: number | null;
  created_at: string;
  claimed_at: string | null;
  assigned_to: string | null;
  first_contact_at: string | null;
  converted_student_id: string | null;
  q_age_ok: boolean | null;
  q_area_ok: boolean | null;
  q_timing_ok: boolean | null;
  claimer?: { full_name: string } | { full_name: string }[] | null;
}

function Notice({ leadId, message }: { leadId: string; message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Link href="/bugun" className="flex min-h-11 items-center self-start text-base font-semibold text-primary">
        ‹ Bugün
      </Link>
      <p role="alert" className="rounded-2xl bg-warning-soft px-4 py-3.5 text-base font-semibold text-warning">
        {message}
      </p>
      <Link
        href={`/leads/${leadId}`}
        className="flex min-h-11 items-center justify-center text-sm font-medium text-muted-foreground"
      >
        Veli kartını aç
      </Link>
    </div>
  );
}

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getSessionProfile();
  const supabase = await createServerSupabase();
  const now = new Date();

  const { data } = await supabase
    .from("leads")
    .select(
      "id, parent_name, phone, source, source_detail, channel, content_code, district, start_window, child_birth_month, child_birth_year, created_at, claimed_at, assigned_to, first_contact_at, converted_student_id, q_age_ok, q_area_ok, q_timing_ok, claimer:profiles!leads_assigned_to_fkey(full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  const lead = data as unknown as LeadRow | null;
  if (!lead) notFound();

  if (lead.converted_student_id) {
    return <Notice leadId={lead.id} message="Bu veli öğrenciye dönüştürüldü; arama kaydı açılamaz." />;
  }

  const settings = await getLeadFlowSettings(supabase);

  // Bugün listesindeki kuralın aynısı; sayfa açılırken üstlenme yapılmaz (onu "Ara" düğmesi yapar).
  if (!lead.first_contact_at && heldByOther(lead, profile.id, now, settings.claimMinutes)) {
    const claimer = Array.isArray(lead.claimer) ? lead.claimer[0] : lead.claimer;
    return <Notice leadId={lead.id} message={`${claimer?.full_name || UNKNOWN_CLAIMER} bu veliyi arıyor`} />;
  }

  const windowMinutes = await readConflictWindowMinutes(supabase);
  const { data: appointmentRows } = await supabase
    .from("appointments")
    .select("scheduled_at")
    .eq("outcome", "bekliyor")
    .gte("scheduled_at", new Date(now.getTime() - windowMinutes * 60_000).toISOString())
    .lte("scheduled_at", new Date(now.getTime() + SLOT_LOOKAHEAD_MS).toISOString());
  const slots = suggestSlots((appointmentRows ?? []) as { scheduled_at: string }[], now, settings.hours, 3, windowMinutes);

  const danisman = profile.full_name.split(" ")[0] || profile.full_name;
  const age = ageFromBirth(lead.child_birth_month, lead.child_birth_year, now);
  const script = fillScript(settings.callScript, {
    veli: lead.parent_name,
    danisman,
    cocukYasi: age !== null ? String(age) : "…",
    semt: lead.district ?? "…",
  });

  const districtOk = !!lead.district && settings.districts.some(
    (d) => d.toLocaleLowerCase("tr-TR") === lead.district!.trim().toLocaleLowerCase("tr-TR"),
  );
  // Daha önce bir danışman işaretlediyse onun kararı, yoksa form cevabı.
  const quals = {
    age: lead.q_age_ok ?? (age !== null && age >= 2 && age <= 6),
    area: lead.q_area_ok ?? districtOk,
    timing: lead.q_timing_ok ?? (!!lead.start_window && TIMING_OK.includes(lead.start_window)),
    reached: true,
  };

  // recordCall bitti listesindeki WhatsApp satırını aynı fonksiyonla yazar: düğme yoksa satır da yok.
  const waLinks: Partial<Record<"randevu" | "ulasilamadi", string>> = {};
  for (const result of ["randevu", "ulasilamadi"] as const) {
    const href = callWaLink(result, lead.phone, settings.templates, { veli: lead.parent_name, danisman });
    if (href) waLinks[result] = href;
  }

  const screenLead: CallScreenLead = {
    id: lead.id,
    parentName: lead.parent_name,
    source: lead.source,
    channel: lead.channel,
    sourceDetail: lead.content_code ?? lead.source_detail,
    childAge: age,
    district: lead.district,
    startWindow: lead.start_window,
    startedAt: lead.first_contact_at ? null : clockStart(new Date(lead.created_at), settings.hours).toISOString(),
  };

  return (
    <CallScreen
      lead={screenLead}
      serverNow={now.getTime()}
      hours={settings.hours}
      script={script}
      priceAnswer={settings.priceAnswer}
      initialQuals={quals}
      slots={slots}
      waLinks={waLinks}
    />
  );
}
