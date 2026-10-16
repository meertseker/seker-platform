/**
 * Ödeme olaylarından (events) taksit başına not ve hatırlatma izi — saf fonksiyon.
 * Excel'deki hücre yorumunun karşılığı: "anne nakit getirdi", "12 Eki'de hatırlatıldı".
 */
export interface PaymentEventRow {
  entity_id: string;
  event_type: string;
  created_at: string;
  payload: unknown;
  actor?: { full_name: string } | { full_name: string }[] | null;
}

export interface PaymentTrace {
  at: string;
  actorName: string | null;
  note: string | null;
}

export interface PaymentTraces {
  /** taksit id → o taksiti kapatan ödemelerin notları */
  notes: Map<string, PaymentTrace[]>;
  /** taksit id → hatırlatmalar (en yeni önce) */
  reminders: Map<string, PaymentTrace[]>;
  /** öğrenci id → son hatırlatma */
  lastReminderByStudent: Map<string, PaymentTrace>;
}

export const PAYMENT_EVENT_TYPES = ["odeme_alindi", "odeme_hatirlatildi"] as const;

function actorName(row: PaymentEventRow) {
  const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
  return actor?.full_name ?? null;
}

function push(map: Map<string, PaymentTrace[]>, key: string, trace: PaymentTrace) {
  const list = map.get(key);
  if (list) list.push(trace);
  else map.set(key, [trace]);
}

export function buildPaymentTraces(rows: PaymentEventRow[]): PaymentTraces {
  const notes = new Map<string, PaymentTrace[]>();
  const reminders = new Map<string, PaymentTrace[]>();
  const lastReminderByStudent = new Map<string, PaymentTrace>();

  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const row of sorted) {
    const payload = (row.payload ?? {}) as {
      note?: string | null;
      paidIds?: string[];
      installmentIds?: string[];
      undone?: boolean;
    };
    const trace: PaymentTrace = { at: row.created_at, actorName: actorName(row), note: payload.note ?? null };

    if (row.event_type === "odeme_alindi") {
      if (payload.undone || !payload.note) continue;
      for (const id of payload.paidIds ?? []) push(notes, id, trace);
    } else if (row.event_type === "odeme_hatirlatildi") {
      for (const id of payload.installmentIds ?? []) push(reminders, id, trace);
      if (!lastReminderByStudent.has(row.entity_id)) lastReminderByStudent.set(row.entity_id, trace);
    }
  }

  return { notes, reminders, lastReminderByStudent };
}
