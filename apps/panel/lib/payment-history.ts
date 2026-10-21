/**
 * Öğrenci sayfasındaki "Ödeme geçmişi" — saf. Kaynak ödenmiş taksit satırlarıdır
 * (status = 'odendi'); geri alınmamış `odeme_alindi` olayları satırları tek ödeme altında
 * toplar ve notu verir. Olayı olmayan satırlar (Excel / seed içe aktarma) tek tek görünür.
 */
import type { ItemType, PaymentMethod } from "@/lib/constants";
import { collectedDay, collectedKurus } from "@/lib/queries/money";
import { tlToKurus } from "@/lib/money";

export interface HistoryInstallmentInput {
  id: string;
  itemType: ItemType;
  dueDate: string;
  amount: number | string;
  status: string;
  paidAmount: number | string | null;
  paidAt: string | null;
  method: PaymentMethod | null;
  markedByName: string | null;
}

export interface HistoryEventInput {
  id: string;
  createdAt: string;
  actorName: string | null;
  payload: unknown;
}

export interface HistoryPart {
  method: PaymentMethod | null;
  kurus: number;
  paidOn: string;
}

export interface HistoryItem {
  installmentId: string;
  itemType: ItemType;
  dueDate: string;
  kurus: number;
}

export interface PaymentHistoryEntry {
  key: string;
  /** odeme: panelden alınmış (olaylı); ice_aktarma: olaysız satır. */
  kind: "odeme" | "ice_aktarma";
  eventId: string | null;
  /** Geri al / düzelt bu satır üzerinden çağrılır (olaylı ödemede ödemenin tamamı). */
  anchorId: string;
  /** Ödemenin (en son) günü, "YYYY-MM-DD". */
  paidOn: string;
  totalKurus: number;
  /** Yöntem ve gün başına parçalar (ödeme sırasıyla). */
  parts: HistoryPart[];
  /** Hangi kalem / ay (vade sırasıyla). */
  items: HistoryItem[];
  actorName: string | null;
  note: string | null;
  /** Bu ödeme bir "Ödemeyi düzelt" sonucu. */
  corrected: boolean;
  /** Düzeltmede yazılabilecek en yüksek tutar: ödemenin taksitlerinin ödeme öncesi toplamı. */
  capacityKurus: number;
}

interface EventPayload {
  paidIds?: unknown;
  snapshots?: unknown;
  note?: unknown;
  undone?: unknown;
  correctionOf?: unknown;
  correctedInstallmentId?: unknown;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function snapshotTotalKurus(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  let total = 0;
  for (const snap of value) {
    const amount = Number((snap as { amount?: unknown })?.amount);
    if (!Number.isFinite(amount)) return null;
    total += tlToKurus(amount);
  }
  return total;
}

function partsOf(rows: HistoryInstallmentInput[]): HistoryPart[] {
  const ordered = [...rows].sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? "") || a.id.localeCompare(b.id));
  const parts: HistoryPart[] = [];
  for (const row of ordered) {
    const paidOn = collectedDay({ status: row.status, paid_at: row.paidAt }) ?? "";
    const kurus = collectedKurus({ status: row.status, amount: row.amount, paid_amount: row.paidAmount });
    const same = parts.find((part) => part.method === row.method && part.paidOn === paidOn);
    if (same) same.kurus += kurus;
    else parts.push({ method: row.method, kurus, paidOn });
  }
  return parts;
}

function itemsOf(rows: HistoryInstallmentInput[]): HistoryItem[] {
  return [...rows]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
    .map((row) => ({
      installmentId: row.id,
      itemType: row.itemType,
      dueDate: row.dueDate,
      kurus: collectedKurus({ status: row.status, amount: row.amount, paid_amount: row.paidAmount }),
    }));
}

function latestDay(parts: HistoryPart[]): string {
  return parts.map((part) => part.paidOn).sort().at(-1) ?? "";
}

export function buildPaymentHistory(
  installments: HistoryInstallmentInput[],
  events: HistoryEventInput[],
): PaymentHistoryEntry[] {
  const paid = installments.filter((row) => row.status === "odendi");
  const paidById = new Map(paid.map((row) => [row.id, row]));
  const claimed = new Set<string>();
  const entries: (PaymentHistoryEntry & { createdAt: string })[] = [];

  // En yeni olay önce: aynı satırı iki olay sayarsa (olmamalı) yenisi alır — RPC ile aynı kural.
  const sorted = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const event of sorted) {
    const payload = (event.payload ?? {}) as EventPayload;
    if (payload.undone === true) continue;
    const rows = strings(payload.paidIds)
      .filter((id) => !claimed.has(id))
      .map((id) => paidById.get(id))
      .filter((row): row is HistoryInstallmentInput => row !== undefined);
    if (rows.length === 0) continue;
    for (const row of rows) claimed.add(row.id);
    const parts = partsOf(rows);
    const totalKurus = parts.reduce((sum, part) => sum + part.kurus, 0);
    const items = itemsOf(rows);
    entries.push({
      key: event.id,
      kind: "odeme",
      eventId: event.id,
      anchorId: items[0].installmentId,
      paidOn: latestDay(parts),
      totalKurus,
      parts,
      items,
      actorName: event.actorName,
      note: typeof payload.note === "string" && payload.note.trim() ? payload.note.trim() : null,
      corrected: typeof payload.correctedInstallmentId === "string",
      capacityKurus: snapshotTotalKurus(payload.snapshots) ?? totalKurus,
      createdAt: event.createdAt,
    });
  }

  for (const row of paid) {
    if (claimed.has(row.id)) continue;
    const parts = partsOf([row]);
    entries.push({
      key: row.id,
      kind: "ice_aktarma",
      eventId: null,
      anchorId: row.id,
      paidOn: latestDay(parts),
      totalKurus: parts[0]?.kurus ?? 0,
      parts,
      items: itemsOf([row]),
      actorName: row.markedByName,
      note: null,
      corrected: false,
      capacityKurus: tlToKurus(Number(row.amount)),
      createdAt: row.paidAt ?? "",
    });
  }

  return entries
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.createdAt.localeCompare(a.createdAt) || a.key.localeCompare(b.key))
    .map((entry) => {
      const { createdAt, ...rest } = entry;
      void createdAt;
      return rest;
    });
}
