import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyContext, type WaContext, type WaItem } from "./format";
import type { WaOutboxRow, WaSettings, WaStore } from "./flush";

interface EventRow {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface NoteRow {
  id: string;
  lead_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

interface OutboxRow {
  id: string;
  attempts: number;
  created_at: string;
  event: EventRow | EventRow[] | null;
  note: NoteRow | NoteRow[] | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export async function readWaSettings(db: SupabaseClient): Promise<WaSettings & { groupName: string }> {
  const { data, error } = await db
    .from("app_settings")
    .select("key, value")
    .in("key", ["wa_enabled", "wa_group_id", "wa_group_name"]);
  if (error) throw new Error(`app_settings okunamadı: ${error.message}`);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  return {
    enabled: map.get("wa_enabled") === true,
    groupId: str(map.get("wa_group_id")) ?? "",
    groupName: str(map.get("wa_group_name")) ?? "",
  };
}

export function toItem(row: OutboxRow): WaItem | null {
  const event = one(row.event);
  if (event) {
    return {
      outboxId: row.id,
      eventType: event.event_type,
      entityType: event.entity_type,
      entityId: event.entity_id,
      actorId: event.actor_id,
      payload: event.payload ?? {},
      createdAt: event.created_at,
    };
  }
  const note = one(row.note);
  if (note) {
    return {
      outboxId: row.id,
      eventType: "not_eklendi",
      entityType: "lead",
      entityId: note.lead_id,
      actorId: note.author_id,
      payload: {},
      createdAt: note.created_at,
      noteBody: note.body,
    };
  }
  return null;
}

export function supabaseWaStore(db: SupabaseClient): WaStore {
  return {
    settings: () => readWaSettings(db),

    async releaseStale(lockedBeforeIso) {
      await db
        .from("wa_outbox")
        .update({ status: "bekliyor", locked_at: null })
        .eq("status", "gonderiliyor")
        .lt("locked_at", lockedBeforeIso);
    },

    async listPending(nowIso, limit): Promise<WaOutboxRow[]> {
      const { data, error } = await db
        .from("wa_outbox")
        .select(
          "id, attempts, created_at, event:events(id, entity_type, entity_id, event_type, actor_id, payload, created_at), note:lead_notes(id, lead_id, author_id, body, created_at)",
        )
        .eq("status", "bekliyor")
        .lte("available_at", nowIso)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`wa_outbox okunamadı: ${error.message}`);
      return ((data ?? []) as unknown as OutboxRow[]).map((row) => ({
        id: row.id,
        attempts: row.attempts,
        createdAt: row.created_at,
        item: toItem(row),
      }));
    },

    async loadContext(items): Promise<WaContext> {
      const ctx = emptyContext();
      const ids = (type: string) => [...new Set(items.filter((i) => i.entityType === type).map((i) => i.entityId))];

      const offerIds = ids("offer");
      if (offerIds.length) {
        const { data } = await db.from("offers").select("id, lead_id, program, offered_price, list_price").in("id", offerIds);
        for (const o of data ?? []) {
          ctx.offers.set(o.id, { leadId: o.lead_id, program: o.program, offeredPrice: Number(o.offered_price), listPrice: Number(o.list_price) });
        }
      }
      const appointmentIds = ids("appointment");
      if (appointmentIds.length) {
        const { data } = await db.from("appointments").select("id, lead_id, scheduled_at, type").in("id", appointmentIds);
        for (const a of data ?? []) ctx.appointments.set(a.id, { leadId: a.lead_id, scheduledAt: a.scheduled_at, type: a.type });
      }
      const installmentIds = ids("installment");
      if (installmentIds.length) {
        const { data } = await db
          .from("installments")
          .select("id, due_date, amount, plan:payment_plans(student_id, item_type)")
          .in("id", installmentIds);
        for (const row of (data ?? []) as unknown as Array<{ id: string; due_date: string; amount: number; plan: { student_id: string; item_type: string } | { student_id: string; item_type: string }[] | null }>) {
          const plan = one(row.plan);
          if (plan) ctx.installments.set(row.id, { studentId: plan.student_id, itemType: plan.item_type, dueDate: row.due_date, amount: Number(row.amount) });
        }
      }

      const leadIds = new Set(ids("lead"));
      for (const item of items) {
        const leadId = str(item.payload.leadId);
        if (leadId) leadIds.add(leadId);
      }
      for (const o of ctx.offers.values()) leadIds.add(o.leadId);
      for (const a of ctx.appointments.values()) leadIds.add(a.leadId);
      if (leadIds.size) {
        const { data } = await db.from("leads").select("id, parent_name, child_name, phone, source").in("id", [...leadIds]);
        for (const l of data ?? []) ctx.leads.set(l.id, { parentName: l.parent_name, childName: l.child_name, phone: l.phone, source: l.source });
      }

      const studentIds = new Set(ids("student"));
      for (const i of ctx.installments.values()) studentIds.add(i.studentId);
      if (studentIds.size) {
        const { data } = await db.from("students").select("id, full_name, parent_name, program").in("id", [...studentIds]);
        for (const s of data ?? []) ctx.students.set(s.id, { fullName: s.full_name, parentName: s.parent_name, program: s.program });
      }

      const priceListIds = ids("price_list");
      if (priceListIds.length) {
        const { data } = await db.from("price_lists").select("id, season").in("id", priceListIds);
        for (const p of data ?? []) ctx.priceLists.set(p.id, { season: p.season });
      }

      const actorIds = [...new Set(items.map((i) => i.actorId).filter((id): id is string => !!id))];
      if (actorIds.length) {
        const { data } = await db.from("profiles").select("id, full_name").in("id", actorIds);
        for (const p of data ?? []) ctx.actors.set(p.id, p.full_name);
      }
      return ctx;
    },

    async claim(ids) {
      const { data, error } = await db
        .from("wa_outbox")
        .update({ status: "gonderiliyor", locked_at: new Date().toISOString() })
        .in("id", ids)
        .eq("status", "bekliyor")
        .select("id");
      if (error) throw new Error(`wa_outbox kilitlenemedi: ${error.message}`);
      return (data ?? []).map((r) => r.id as string);
    },

    async markSent(ids, message) {
      const { error } = await db
        .from("wa_outbox")
        .update({ status: "gonderildi", sent_at: new Date().toISOString(), locked_at: null, error: null, message })
        .in("id", ids);
      if (error) throw new Error(`wa_outbox güncellenemedi: ${error.message}`);
    },

    async markRetry(ids, errorText, attempts, availableAtIso) {
      await db
        .from("wa_outbox")
        .update({ status: "bekliyor", locked_at: null, error: errorText, attempts, available_at: availableAtIso })
        .in("id", ids);
    },

    async markFailed(ids, errorText, attempts) {
      await db.from("wa_outbox").update({ status: "hata", locked_at: null, error: errorText, attempts }).in("id", ids);
    },

    async markSkipped(ids, reason) {
      await db.from("wa_outbox").update({ status: "atlandi", locked_at: null, error: reason }).in("id", ids);
    },
  };
}
