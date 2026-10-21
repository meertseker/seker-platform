import {
  APPOINTMENT_OUTCOMES,
  APPOINTMENT_TYPES,
  EVENT_LABELS,
  ITEM_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOST_REASONS,
  PAYMENT_METHODS,
  PROGRAMS,
  label,
  type ItemType,
} from "@/lib/constants";
import { installmentLabel } from "@/lib/payment-labels";

/** Kuyruktaki bir satır: bir events kaydı ya da bir görüşme notu. */
export interface WaItem {
  outboxId: string;
  eventType: string; // notlar için "not_eklendi"
  entityType: string; // notlar için "lead"
  entityId: string; // notlar için lead_id
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  noteBody?: string;
}

export interface WaContext {
  actors: Map<string, string>;
  leads: Map<string, { parentName: string; childName: string | null; phone: string; source: string }>;
  students: Map<string, { fullName: string; parentName: string; program: string | null }>;
  offers: Map<string, { leadId: string; program: string; offeredPrice: number; listPrice: number }>;
  appointments: Map<string, { leadId: string; scheduledAt: string; type: string }>;
  installments: Map<string, { studentId: string; itemType: string; dueDate: string; amount: number }>;
  priceLists: Map<string, { season: string }>;
}

export function emptyContext(): WaContext {
  return {
    actors: new Map(), leads: new Map(), students: new Map(), offers: new Map(),
    appointments: new Map(), installments: new Map(), priceLists: new Map(),
  };
}

export interface WaGroup {
  key: string;
  actorId: string | null;
  items: WaItem[];
  lastAt: string;
}

/** Aynı kişinin aynı kayıtta peş peşe yaptığı işlemler bu süre içindeyse tek mesajda birleşir. */
export const GROUP_GAP_MS = 90_000;

/** Toplu işlemler öğrenci başına olay yazar; grupta tek özet mesaj olarak görünür. */
const BATCH_EVENTS = new Set(["zam_uygulandi", "tutar_kesinlesti"]);

/** Gruba hiç yazılmayan olaylar: "Ara"ya basmak (ustlenildi) yalnız panel geçmişi içindir. */
const SILENT_EVENTS = new Set(["ustlenildi"]);

/** Bu olayları her zaman bir görüşme notu izler; not grupta varsa ayrı satır yazılmaz. */
const NOTE_COVERED_EVENTS = new Set(["arama_kaydi", "mesaj_tekrar"]);

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Kaydın "kime ait" olduğu: veli, öğrenci ya da toplu işlem. */
export function subjectKey(item: WaItem, ctx: WaContext): string {
  if (BATCH_EVENTS.has(item.eventType)) return `toplu:${item.eventType}`;
  switch (item.entityType) {
    case "lead":
      return `lead:${item.entityId}`;
    case "offer": {
      const leadId = str(item.payload.leadId) ?? ctx.offers.get(item.entityId)?.leadId;
      return leadId ? `lead:${leadId}` : `offer:${item.entityId}`;
    }
    case "appointment": {
      const leadId = str(item.payload.leadId) ?? ctx.appointments.get(item.entityId)?.leadId;
      return leadId ? `lead:${leadId}` : `appointment:${item.entityId}`;
    }
    case "installment": {
      const studentId = ctx.installments.get(item.entityId)?.studentId;
      return studentId ? `student:${studentId}` : `installment:${item.entityId}`;
    }
    default:
      return `${item.entityType}:${item.entityId}`;
  }
}

/** Kuyruk satırlarını mesajlara böler; sıra korunur (ilk işlem ilk mesaj). */
export function groupItems(items: WaItem[], ctx: WaContext, gapMs = GROUP_GAP_MS): WaGroup[] {
  const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const groups: WaGroup[] = [];
  const open = new Map<string, WaGroup>();
  for (const item of sorted) {
    const key = `${subjectKey(item, ctx)}|${item.actorId ?? "web"}`;
    const current = open.get(key);
    if (current && Date.parse(item.createdAt) - Date.parse(current.lastAt) <= gapMs) {
      current.items.push(item);
      current.lastAt = item.createdAt;
      continue;
    }
    const group: WaGroup = { key, actorId: item.actorId, items: [item], lastAt: item.createdAt };
    groups.push(group);
    open.set(key, group);
  }
  return groups;
}

/** WhatsApp biçim karakterleri kullanıcı metnini bozmasın diye benzerleriyle değişir. */
export function escapeWa(text: string): string {
  return text.replace(/\*/g, "∗").replace(/~/g, "∼").replace(/`/g, "ʼ").replace(/_/g, "‗");
}

/** "0532 *** ** 47" — grupta numaranın tamamı dolaşmasın. */
export function maskPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const local = digits.slice(-10);
  return `0${local.slice(0, 3)} *** ** ${local.slice(-2)}`;
}

const tlFormatter = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 3500 → "3.500 ₺" (kuruş yoksa göstermez). */
export function formatTl(value: number): string {
  return `${tlFormatter.format(value)} ₺`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
});
const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul",
});
const monthFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "Europe/Istanbul" });

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : iso));
}

function formatMonth(yearMonth: string): string {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return yearMonth;
  const text = monthFormatter.format(new Date(`${yearMonth}-15T12:00:00+03:00`));
  return text.charAt(0).toLocaleUpperCase("tr") + text.slice(1);
}

function quote(body: string, max = 500): string[] {
  const trimmed = body.trim();
  const text = trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
  return escapeWa(text).split(/\r?\n/).filter((line) => line.trim()).map((line) => `> ${line}`);
}

const FIELD_LABELS: Record<string, string> = {
  parent_name: "veli adı", phone: "telefon", source: "kaynak", source_detail: "kaynak detayı",
  child_name: "çocuk adı", child_birth_month: "doğum tarihi", child_birth_year: "doğum tarihi",
  ingilizce_gerekli: "İngilizce", wants_summer: "yaz okulu", ozel_durum: "özel durum", ozel_durum_note: "özel durum",
  full_name: "ad", program: "program", birth_month: "doğum tarihi", birth_year: "doğum tarihi",
  start_date: "başlangıç tarihi", season: "sezon",
};

function fieldList(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const labels = [...new Set(value.filter((f): f is string => typeof f === "string").map((f) => FIELD_LABELS[f] ?? f))];
  return labels.length ? labels.join(", ") : null;
}

interface Line {
  icon: string;
  title: string;
  lines: string[];
}

function money(value: unknown): string | null {
  const n = num(value);
  return n === null ? null : formatTl(n);
}

const monthNameFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "Europe/Istanbul" });

/** "kitap" → "kitap-kırtasiye", "aidat" → "aidat" (cümle içinde). */
function itemNoun(itemType: string): string {
  return label(ITEM_TYPES, itemType).toLocaleLowerCase("tr");
}

/** "kitap" → "Kitap-kırtasiye" (satır başında). */
function itemTitle(itemType: string): string {
  const noun = itemNoun(itemType);
  return noun.charAt(0).toLocaleUpperCase("tr") + noun.slice(1);
}

/** "2026-10-05" + "kitap" → "Ekim kitap-kırtasiye". */
function installmentName(itemType: string, dueDate: string): string {
  const month = monthNameFormatter.format(new Date(`${dueDate}T12:00:00+03:00`));
  return `${month.charAt(0).toLocaleUpperCase("tr")}${month.slice(1)} ${itemNoun(itemType)}`;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v))
    : [];
}

/**
 * `odeme_alindi` olayındaki ödeme anı durumu: her taksit için bir satır, sonra
 * her plan için kalan. Aidatta ve kesinleşmemiş tutar bekleyen planlarda kalan
 * tutar yazılmaz, yalnız taksit sayısı yazılır. Eski olaylarda alan yoktur.
 */
function settlementLines(settledValue: unknown, plansValue: unknown): string[] {
  const lines: string[] = [];
  for (const s of records(settledValue)) {
    const itemType = str(s.itemType);
    const dueDate = str(s.dueDate);
    if (!itemType || !dueDate || typeof s.complete !== "boolean") continue;
    const name = installmentName(itemType, dueDate);
    if (s.complete) {
      lines.push(`✅ ${name} taksiti tamamlandı`);
      continue;
    }
    const remainder = num(s.remainderTl);
    const count = num(s.remainderCount) ?? 1;
    const nextDue = str(s.remainderDueDate);
    let text = `${name}: kısmi${remainder !== null ? `, kalan ${formatTl(remainder)}` : ""}`;
    if (count > 1) text += ` (${count} taksite bölündü${nextDue ? `, ilk vade ${formatDate(nextDue)}` : ""})`;
    else if (nextDue && nextDue !== dueDate) text += ` (yeni vade ${formatDate(nextDue)})`;
    lines.push(text);
  }
  for (const plan of records(plansValue)) {
    const itemType = str(plan.itemType);
    const pendingCount = num(plan.pendingCount);
    if (!itemType || pendingCount === null) continue;
    if (plan.closed === true || pendingCount === 0) {
      lines.push(`✅ ${itemTitle(itemType)} tamamen ödendi`);
      continue;
    }
    const pendingTl = num(plan.pendingTl);
    const countOnly = itemType === "aidat" || plan.tentativePending === true || pendingTl === null;
    lines.push(
      countOnly
        ? `${itemTitle(itemType)} kalan: ${pendingCount} taksit`
        : `${itemTitle(itemType)} kalan: ${formatTl(pendingTl)} (${pendingCount} taksit)`,
    );
  }
  return lines;
}

const dayMonthFormatter = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

/** Cümle içinde kısa yöntem adı: "4.000 ₺ nakit", "15.000 ₺ kart". */
const METHOD_NOUNS: Record<string, string> = { nakit: "nakit", pos: "kart", havale: "havale", diger: "diğer" };

/**
 * Parçalar farklı günlerde ödendiyse "4.000 ₺ nakit (12 Ekim) + 15.000 ₺ kart (14 Ekim)";
 * tek parça ya da hepsi aynı gün ise null (tutar satırı eski biçimde kalır).
 */
function datedParts(value: unknown): string | null {
  const parts = records(value).flatMap((part) => {
    const amount = num(part.amountTl);
    const method = str(part.method);
    const day = str(part.paidOn);
    return amount !== null && method && day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? [{ amount, method, day }] : [];
  });
  if (parts.length < 2 || new Set(parts.map((part) => part.day)).size < 2) return null;
  return parts
    .map(
      (part) =>
        `${formatTl(part.amount)} ${METHOD_NOUNS[part.method] ?? part.method} (${dayMonthFormatter.format(new Date(`${part.day}T12:00:00+03:00`))})`,
    )
    .join(" + ");
}

function describe(item: WaItem, ctx: WaContext): Line | null {
  const p = item.payload;
  const lead = ctx.leads.get(item.entityId);
  switch (item.eventType) {
    case "not_eklendi":
      return item.noteBody ? { icon: "📝", title: "Görüşme notu", lines: quote(item.noteBody) } : null;
    case "lead_olusturuldu":
    case "web_basvuru": {
      // Çocuğun adı başlıkta ("*Veli* · Çocuk") zaten var.
      const lines: string[] = [];
      const phone = maskPhone(lead?.phone);
      if (phone) lines.push(`Tel: ${phone}`);
      const source = str(p.source) ?? lead?.source;
      if (source) lines.push(`Kaynak: ${label(LEAD_SOURCES, source)}`);
      return item.eventType === "web_basvuru"
        ? { icon: "🌐", title: "Web sitesinden başvurdu", lines }
        : { icon: "🆕", title: "Yeni veli eklendi", lines };
    }
    case "web_tekrar_basvuru":
      return { icon: "🔁", title: "Web sitesinden tekrar başvurdu", lines: [] };
    case "durum_degisti": {
      const from = str(p.from);
      const to = str(p.to);
      if (!to) return null;
      const lines: string[] = [];
      const reason = str(p.lostReason);
      if (to === "kaybedildi" && reason) lines.push(`Sebep: ${label(LOST_REASONS, reason)}`);
      const arrow = from ? `${label(LEAD_STATUSES, from)} → ${label(LEAD_STATUSES, to)}` : label(LEAD_STATUSES, to);
      return { icon: "🔄", title: `Durum: ${arrow}`, lines };
    }
    case "lead_guncellendi":
    case "ogrenci_guncellendi": {
      const fields = fieldList(p.fields);
      return { icon: "✏️", title: "Bilgiler güncellendi", lines: fields ? [`Değişen: ${fields}`] : [] };
    }
    case "lead_silindi":
      return { icon: "🗑️", title: "Veli kaydı silindi", lines: [] };
    case "randevu_olusturuldu": {
      const at = str(p.scheduledAt) ?? ctx.appointments.get(item.entityId)?.scheduledAt;
      const type = str(p.type) ?? ctx.appointments.get(item.entityId)?.type;
      const lines = at ? [`${dateTimeFormatter.format(new Date(at))}${type ? ` · ${label(APPOINTMENT_TYPES, type)}` : ""}`] : [];
      return { icon: "📅", title: "Randevu verildi", lines };
    }
    case "randevu_sonuclandi": {
      const outcome = str(p.outcome);
      const at = ctx.appointments.get(item.entityId)?.scheduledAt;
      return {
        icon: "📍",
        title: `Randevu: ${outcome ? label(APPOINTMENT_OUTCOMES, outcome) : "sonuçlandı"}`,
        lines: at ? [dateTimeFormatter.format(new Date(at))] : [],
      };
    }
    case "teklif_olusturuldu":
    case "teklif_onaylandi":
    case "teklif_reddedildi": {
      const offer = ctx.offers.get(item.entityId);
      const program = str(p.program) ?? offer?.program;
      const price = num(p.offeredPrice) ?? offer?.offeredPrice ?? null;
      const list = num(p.listPrice) ?? offer?.listPrice ?? null;
      const lines: string[] = [];
      if (program || price !== null) {
        const parts = [program ? label(PROGRAMS, program) : null, price !== null ? `${formatTl(price)}/ay` : null];
        let text = parts.filter(Boolean).join(" · ");
        if (list !== null && price !== null && list !== price) text += ` (liste ${formatTl(list)})`;
        lines.push(text);
      }
      if (item.eventType === "teklif_olusturuldu") {
        if (p.counter === true) return { icon: "✅", title: "Karşı rakamla onaylandı", lines };
        if (p.status === "onay_bekliyor") lines.push("Yönetici onayı bekliyor");
        return { icon: "💬", title: "Teklif verildi", lines };
      }
      return item.eventType === "teklif_onaylandi"
        ? { icon: "✅", title: "Teklif onaylandı", lines }
        : { icon: "❌", title: "Teklif reddedildi", lines };
    }
    case "teklif_revize_edildi": {
      const counter = money(p.counterPrice);
      return { icon: "💬", title: "Teklife karşı rakam girildi", lines: counter ? [`${counter}/ay`] : [] };
    }
    case "ogrenciye_donusturuldu": {
      const student = ctx.students.get(item.entityId);
      const lines: string[] = [];
      if (student?.parentName) lines.push(`Veli: ${escapeWa(student.parentName)}`);
      if (student?.program) lines.push(`Program: ${label(PROGRAMS, student.program)}`);
      return { icon: "🎓", title: "Kayıt yapıldı", lines };
    }
    case "ogrenci_ayrildi": {
      const lines: string[] = [];
      const date = str(p.leftDate);
      if (date) lines.push(`Ayrılış: ${formatDate(date)}`);
      const reason = str(p.leaveReason);
      if (reason) lines.push(`Sebep: ${escapeWa(reason)}`);
      return { icon: "👋", title: "Öğrenci ayrıldı", lines };
    }
    case "ogrenci_silindi":
      return { icon: "🗑️", title: "Öğrenci kaydı silindi", lines: [] };
    case "iade_kaydedildi": {
      const amount = money(p.amountTl);
      const method = str(p.method);
      return {
        icon: "↩️", title: "İade yapıldı",
        lines: amount ? [`${amount}${method ? ` · ${label(PAYMENT_METHODS, method)}` : ""}`] : [],
      };
    }
    case "plan_olusturuldu": {
      const itemType = str(p.itemType);
      const total = money(p.totalTl);
      const count = num(p.count);
      const parts = [itemType ? label(ITEM_TYPES, itemType) : null, total, count ? `${count} taksit` : null];
      return { icon: "🧾", title: "Ödeme planı oluşturuldu", lines: [parts.filter(Boolean).join(" · ")].filter(Boolean) };
    }
    case "taksit_odendi": {
      const inst = ctx.installments.get(item.entityId);
      const paid = money(p.paidTl);
      const name = inst ? installmentLabel(inst.itemType as ItemType, inst.dueDate) : null;
      const text = [name, paid].filter(Boolean).join(": ");
      return { icon: "💰", title: p.partial === true ? "Kısmi ödeme alındı" : "Ödeme alındı", lines: text ? [text] : [] };
    }
    case "odeme_alindi": {
      const lines: string[] = [];
      const total = money(p.totalTl);
      const methods = Array.isArray(p.methods)
        ? p.methods.filter((m): m is string => typeof m === "string").map((m) => label(PAYMENT_METHODS, m))
        : [];
      const dated = datedParts(p.parts);
      if (total) {
        const detail = dated ?? (methods.length ? methods.join(", ") : null);
        lines.push(`Tutar: ${total}${detail ? ` · ${detail}` : ""}`);
      }
      lines.push(...settlementLines(p.settled, p.plans));
      const note = str(p.note);
      if (note) lines.push(`Not: ${escapeWa(note)}`);
      return { icon: "💰", title: "Ödeme alındı", lines };
    }
    case "odeme_geri_alindi": {
      const total = money(p.totalTl);
      const count = num(p.installmentCount);
      const parts = [total ? `Tutar: ${total}` : null, count && count > 1 ? `${count} taksit` : null];
      const line = parts.filter(Boolean).join(" · ");
      return { icon: "↩️", title: "Ödeme geri alındı", lines: line ? [line] : [] };
    }
    case "odeme_hatirlatildi": {
      const count = Array.isArray(p.installmentIds) ? p.installmentIds.length : 0;
      return { icon: "🔔", title: "Veliye ödeme hatırlatıldı", lines: count > 1 ? [`${count} taksit`] : [] };
    }
    case "taksitlendirildi": {
      const total = money(p.totalTl);
      const count = num(p.count);
      const first = str(p.firstDueDate);
      const parts = [total, count ? `${count} taksit` : null, first ? `ilk vade ${formatDate(first)}` : null];
      return { icon: "🗓️", title: "Taksitler yeniden düzenlendi", lines: [parts.filter(Boolean).join(" · ")].filter(Boolean) };
    }
    case "odeme_gunu_degisti": {
      const day = num(p.day);
      return { icon: "🗓️", title: day ? `Ödeme günü: her ayın ${day}'i` : "Ödeme günü değişti", lines: [] };
    }
    case "taksit_guncellendi": {
      const inst = ctx.installments.get(item.entityId);
      const lines: string[] = [];
      const fromTl = num(p.fromTl);
      const toTl = num(p.toTl);
      if (fromTl !== null && toTl !== null && fromTl !== toTl) lines.push(`Tutar: ${formatTl(fromTl)} → ${formatTl(toTl)}`);
      const fromDue = str(p.fromDueDate);
      const toDue = str(p.toDueDate);
      if (fromDue && toDue && fromDue !== toDue) lines.push(`Vade: ${formatDate(fromDue)} → ${formatDate(toDue)}`);
      const name = inst ? installmentLabel(inst.itemType as ItemType, toDue ?? inst.dueDate) : "Taksit";
      return { icon: "✏️", title: `${name} güncellendi`, lines };
    }
    case "fiyat_listesi_guncellendi": {
      const season = ctx.priceLists.get(item.entityId)?.season ?? str(p.season);
      if (p.action === "sezon_aktiflestirildi") {
        return { icon: "🏷️", title: `Aktif sezon: ${season ?? "değişti"}`, lines: [] };
      }
      const program = str(p.program);
      const lines: string[] = [];
      const oldFee = num(p.oldMonthlyFee);
      const newFee = num(p.newMonthlyFee);
      if (newFee !== null) lines.push(`Aylık: ${oldFee !== null && oldFee !== newFee ? `${formatTl(oldFee)} → ` : ""}${formatTl(newFee)}`);
      const oldReg = num(p.oldRegistrationFee);
      const newReg = num(p.newRegistrationFee);
      if (newReg !== null && oldReg !== newReg) lines.push(`Kayıt: ${oldReg !== null ? `${formatTl(oldReg)} → ` : ""}${formatTl(newReg)}`);
      return { icon: "🏷️", title: `Fiyat güncellendi${program ? `: ${label(PROGRAMS, program)}` : ""}`, lines };
    }
    default: {
      const known = (EVENT_LABELS as Record<string, string>)[item.eventType];
      return known ? { icon: "•", title: known, lines: [] } : null;
    }
  }
}

function header(group: WaGroup, ctx: WaContext): string | null {
  const [kind, id] = group.key.split("|")[0].split(":");
  const first = group.items[0];
  if (kind === "lead") {
    const lead = ctx.leads.get(id);
    const name = lead?.parentName ?? str(first.payload.parentName);
    if (!name) return "*Veli*";
    const child = lead?.childName ?? str(first.payload.childName);
    return `*${escapeWa(name)}*${child ? ` · ${escapeWa(child)}` : ""}`;
  }
  if (kind === "student") {
    const name = ctx.students.get(id)?.fullName ?? str(first.payload.fullName);
    return name ? `*${escapeWa(name)}* · öğrenci` : "*Öğrenci*";
  }
  if (kind === "price_list") {
    const season = ctx.priceLists.get(id)?.season;
    return `*Fiyat listesi${season ? ` · ${season}` : ""}*`;
  }
  return null;
}

function batchMessage(group: WaGroup): string[] {
  const students = new Set(group.items.map((i) => i.entityId)).size;
  const first = group.items[0];
  if (first.eventType === "zam_uygulandi") {
    const percent = num(first.payload.percent);
    const fromMonth = str(first.payload.fromMonth);
    const parts = [`${students} öğrenci`, percent !== null ? `%${percent}` : null, fromMonth ? `${formatMonth(fromMonth)} ayından itibaren` : null];
    return ["📈 *Toplu zam uygulandı*", parts.filter(Boolean).join(" · ")];
  }
  return ["✅ *Aidat tutarları kesinleşti*", `${students} öğrenci`];
}

/** Bir grubu WhatsApp mesajına çevirir; gösterilecek bir şey yoksa null (satırlar atlanır). */
export function formatGroup(group: WaGroup, ctx: WaContext): string | null {
  const actor = group.actorId ? ctx.actors.get(group.actorId) ?? "Panel" : "Web sitesi";
  const footer = `— ${escapeWa(actor)}`;

  if (group.key.startsWith("toplu:")) return [...batchMessage(group), footer].join("\n");

  // Görüşme notu aynı mesajdaysa arama/mesaj olayı aynı şeyi ikinci kez söylemesin.
  const hasNote = group.items.some((i) => i.eventType === "not_eklendi" && !!i.noteBody);
  const described = group.items
    .filter((item) => !SILENT_EVENTS.has(item.eventType))
    .filter((item) => !(hasNote && NOTE_COVERED_EVENTS.has(item.eventType)))
    .map((item) => describe(item, ctx))
    .filter((d): d is Line => d !== null);
  if (described.length === 0) return null;

  const out: string[] = [];
  const head = header(group, ctx);
  if (head) out.push(head);
  for (const d of described) {
    out.push(`${d.icon} ${d.title}`);
    out.push(...d.lines);
  }
  out.push(footer);
  return out.join("\n");
}
