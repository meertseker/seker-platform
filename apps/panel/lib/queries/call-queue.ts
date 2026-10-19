// Bugün ekranı: ortak arama listesi ("Şimdi ara") ve bugünkü takip görevleri.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ageFromBirth } from "@/lib/lead-flow/age";
import { type BusinessHours, businessMinutesBetween, clockStart } from "@/lib/lead-flow/business-hours";
import { FOLLOWUP_STEPS } from "@/lib/lead-flow/followups";
import { getLeadFlowSettings } from "@/lib/lead-flow/settings";

/** Listeye düşen kaynaklar; `channel` doluysa (mesajdan / formdan gelen) kaynak fark etmez. */
export const QUEUE_SOURCES = ["reklam", "web_sitesi", "instagram", "whatsapp"] as const;
const UNKNOWN_CLAIMER = "Başka bir danışman";

export type QueueRow = {
  id: string;
  parent_name: string;
  phone: string;
  source: string;
  channel: string | null;
  content_code: string | null;
  district: string | null;
  start_window: string | null;
  child_birth_month: number | null;
  child_birth_year: number | null;
  created_at: string;
  claimed_at: string | null;
  assigned_to: string | null;
  claimer_name: string | null;
};

export type QueueLead = {
  id: string;
  parentName: string;
  phone: string;
  source: string;
  channel: string | null;
  contentCode: string | null;
  childAge: number | null;
  district: string | null;
  startWindow: string | null;
  /** Sayacın başladığı an (mesai dışında gelen form için sonraki mesai başı). */
  startedAt: string;
  /** Başkası son `claimMinutes` içinde "Ara"ya bastıysa onun adı; "Ara" pasif olur. */
  claimedByName: string | null;
  /** Üstlenmenin düştüğü an; istemci sayacı bu andan sonra "Ara"yı yeniden açar. */
  claimUntil: string | null;
};

/**
 * claimLeadAs ile aynı kural: başkası son `claimMinutes` içinde "Ara"ya bastıysa veli onundur.
 * claimed_at boşsa (yalnız otomatik atama) herkes alabilir.
 */
export function heldByOther(
  r: { claimed_at: string | null; assigned_to: string | null },
  me: string,
  now: Date,
  claimMinutes: number,
): boolean {
  return (
    !!r.claimed_at &&
    !!r.assigned_to &&
    r.assigned_to !== me &&
    Date.parse(r.claimed_at) >= now.getTime() - claimMinutes * 60_000
  );
}

/** Saf: satırları etiketler ve en eski sayaç üstte olacak şekilde sıralar. */
export function labelQueue(
  rows: QueueRow[],
  me: string,
  now: Date,
  claimMinutes: number,
  hours: BusinessHours,
): QueueLead[] {
  // En eski sayaç üstte; aynı anda başlayanlar geliş sırasıyla.
  const sorted = [...rows].sort(
    (a, b) =>
      clockStart(new Date(a.created_at), hours).getTime() - clockStart(new Date(b.created_at), hours).getTime() ||
      Date.parse(a.created_at) - Date.parse(b.created_at),
  );
  return sorted.map((r) => {
    const held = heldByOther(r, me, now, claimMinutes);
    return {
      id: r.id,
      parentName: r.parent_name,
      phone: r.phone,
      source: r.source,
      channel: r.channel,
      contentCode: r.content_code,
      childAge: ageFromBirth(r.child_birth_month, r.child_birth_year, now),
      district: r.district,
      startWindow: r.start_window,
      startedAt: clockStart(new Date(r.created_at), hours).toISOString(),
      claimedByName: held ? r.claimer_name || UNKNOWN_CLAIMER : null,
      claimUntil: held ? new Date(Date.parse(r.claimed_at!) + claimMinutes * 60_000).toISOString() : null,
    };
  });
}

interface QueueDbRow extends Omit<QueueRow, "claimer_name"> {
  claimer?: { full_name: string } | { full_name: string }[] | null;
}

/** R23: aday hattı açılmadan en çok bu kadar gün önce gelen ve hiç aranmamış veliler listeye girer. */
export const QUEUE_LOOKBACK_DAYS = 14;

/** Listeye girmenin en erken geliş zamanı; açılış ayarı yoksa sınır yok. */
export function queueCutoff(launchAt: Date | null): Date | null {
  return launchAt ? new Date(launchAt.getTime() - QUEUE_LOOKBACK_DAYS * 86_400_000) : null;
}

/** Saf: veli, geliş zamanına göre listeye girebilir mi (durum/ilk temas ayrıca bakılır). */
export function inQueueWindow(createdAt: string, launchAt: Date | null): boolean {
  const cutoff = queueCutoff(launchAt);
  return !cutoff || Date.parse(createdAt) >= cutoff.getTime();
}

/**
 * "Şimdi ara" listesinin süzgeci; bant ve 15 dakika uyarısı (cron) da bunu kullanır, hiçbiri ayrışmaz.
 * `cutoff`: queueCutoff(launchAt); bundan önce gelen veliler listeye girmez.
 */
export function applyQueueFilter<Q>(query: Q, cutoff: Date | null): Q {
  // Postgrest oluşturucusunun genel tipi burada sonsuz derinliğe kaçtığı için yapısal tip dar tutuldu.
  const q = query as unknown as {
    is(column: string, value: null): typeof q;
    eq(column: string, value: string): typeof q;
    or(filters: string): typeof q;
    gte(column: string, value: string): typeof q;
  };
  const base = q
    .is("first_contact_at", null)
    .eq("status", "yeni")
    .or(`source.in.(${QUEUE_SOURCES.join(",")}),channel.not.is.null`);
  return (cutoff ? base.gte("created_at", cutoff.toISOString()) : base) as unknown as Q;
}

/** İlk teması yapılmamış yeni veliler (ortak liste). */
export async function loadCallQueue(
  supabase: SupabaseClient,
  me: string,
  now: Date,
  settings?: { claimMinutes: number; hours: BusinessHours; launchAt: Date | null },
): Promise<QueueLead[]> {
  const { claimMinutes, hours, launchAt } = settings ?? (await getLeadFlowSettings(supabase));
  const { data, error } = await applyQueueFilter(
    supabase
      .from("leads")
      .select(
        "id, parent_name, phone, source, channel, content_code, district, start_window, child_birth_month, child_birth_year, created_at, claimed_at, assigned_to, claimer:profiles!leads_assigned_to_fkey(full_name)",
      ),
    queueCutoff(launchAt),
  )
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(`Arama listesi okunamadı: ${error.message}`);
  const rows = ((data ?? []) as unknown as QueueDbRow[]).map(({ claimer, ...r }) => {
    const c = Array.isArray(claimer) ? claimer[0] : claimer;
    return { ...r, claimer_name: c?.full_name ?? null };
  });
  return labelQueue(rows, me, now, claimMinutes, hours);
}

export type QueueBannerSummary = { count: number; oldestName: string; oldestMinutes: number };

/** Saf: diğer sayfalardaki bant için özet; sayı ortak listeyle aynıdır. */
export function queueBannerSummary(leads: QueueLead[], now: Date, hours: BusinessHours): QueueBannerSummary | null {
  const oldest = leads[0];
  if (!oldest) return null;
  return {
    count: leads.length,
    oldestName: oldest.parentName,
    oldestMinutes: businessMinutesBetween(new Date(oldest.startedAt), now, hours),
  };
}

type LeadJoin = { id: string; parent_name: string; phone: string };

export type FollowupRow = {
  id: string;
  title: string;
  rule_key: string | null;
  due_at: string | null;
  due_date: string;
  lead?: LeadJoin | LeadJoin[] | null;
};

/** Otomatik görev kurallarının önekleri (followups.ts, recordCall). */
const AUTO_RULE_KINDS = new Set(["takip", "geri", "noshow", "hatirlat", "ziyaret", "kontenjan"]);

export function isAutoRuleKey(ruleKey: string | null): boolean {
  return !!ruleKey && AUTO_RULE_KINDS.has(ruleKey.split(":")[0]);
}

export type FollowupAction =
  | { kind: "call"; canComplete: boolean }
  | { kind: "whatsapp"; templateKey: string; canComplete: boolean }
  | { kind: "manual"; canComplete: boolean };

/**
 * Saf: Takip satırının ana düğmesi (R24). Arama adımları üstlenip arama ekranına gider; mesaj adımları
 * hazır metinli WhatsApp açar. Takip sırasındaki görevde ✓ yoktur: elle tamamlamak sırayı sessizce durdurur.
 */
export function followupAction(ruleKey: string | null): FollowupAction {
  if (!isAutoRuleKey(ruleKey)) return { kind: "manual", canComplete: true };
  const [kind, , step] = ruleKey!.split(":");
  if (kind === "hatirlat") return { kind: "whatsapp", templateKey: "randevu_onay", canComplete: true };
  if (kind === "kontenjan") return { kind: "whatsapp", templateKey: "kontenjan", canComplete: true };
  if (kind === "ziyaret" && step === "1") return { kind: "whatsapp", templateKey: "ziyaret_tesekkur", canComplete: true };
  return { kind: "call", canComplete: kind !== "takip" };
}

export type FollowupItem = {
  id: string;
  ruleKey: string | null;
  action: FollowupAction;
  leadId: string | null;
  leadName: string | null;
  phone: string | null;
  title: string;
  subtitle: string;
  /** İstanbul "HH:MM"; eski (saatsiz) görevlerde null. */
  time: string | null;
  /** Vakti geldi: "şimdi" etiketi. */
  dueNow: boolean;
};

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Istanbul",
});

function subtitleFor(ruleKey: string | null, title: string, leadName: string | null): string {
  const [kind, , step] = (ruleKey ?? "").split(":");
  switch (kind) {
    case "takip": {
      const n = Number(step);
      if (Number.isInteger(n) && n > FOLLOWUP_STEPS) return "Son deneme";
      if (Number.isInteger(n) && n > 0) return `${n}. deneme`;
      break;
    }
    case "geri":
      return "Geri arama";
    case "hatirlat":
      return "Ziyaret hatırlatması";
    case "ziyaret":
      return step === "1" ? "Teşekkür mesajı" : "Ziyaret sonrası";
    case "noshow":
      return "Gelmedi · tekrar ara";
  }
  // Elle açılmış görev: başlıktaki " · <veli adı>" eki atılır.
  const suffix = leadName ? ` · ${leadName}` : null;
  return suffix && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

/** Saf: alt başlık, saat ve "şimdi" etiketi; saatli görevler saate göre, saatsizler sonda. */
export function labelFollowups(rows: FollowupRow[], now: Date): FollowupItem[] {
  const sorted = [...rows].sort((a, b) => {
    if (!!a.due_at !== !!b.due_at) return a.due_at ? -1 : 1;
    if (a.due_at && b.due_at) return Date.parse(a.due_at) - Date.parse(b.due_at);
    return a.due_date.localeCompare(b.due_date);
  });
  return sorted.map((r) => {
    const lead = Array.isArray(r.lead) ? (r.lead[0] ?? null) : (r.lead ?? null);
    return {
      id: r.id,
      ruleKey: r.rule_key,
      action: followupAction(r.rule_key),
      leadId: lead?.id ?? null,
      leadName: lead?.parent_name ?? null,
      phone: lead?.phone ?? null,
      title: r.title,
      subtitle: subtitleFor(r.rule_key, r.title, lead?.parent_name ?? null),
      time: r.due_at ? timeFormatter.format(new Date(r.due_at)) : null,
      dueNow: !!r.due_at && Date.parse(r.due_at) <= now.getTime(),
    };
  });
}

/** Bugün (ve öncesinde) vadesi gelmiş açık görevler. Danışman yalnız kendininkini görür. */
export async function loadFollowupTasks(
  supabase: SupabaseClient,
  me: string,
  role: "yonetici" | "danisman",
  today: string,
  now: Date = new Date(),
): Promise<FollowupItem[]> {
  let query = supabase
    .from("tasks")
    .select("id, title, rule_key, due_at, due_date, lead:leads(id, parent_name, phone)")
    .eq("status", "acik")
    .lte("due_date", today)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("due_date", { ascending: true });
  if (role !== "yonetici") query = query.eq("assigned_to", me);
  const { data, error } = await query;
  if (error) throw new Error(`Takip görevleri okunamadı: ${error.message}`);
  return labelFollowups((data ?? []) as unknown as FollowupRow[], now);
}
