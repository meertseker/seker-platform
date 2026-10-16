import { describe, it, expect } from "vitest";
import { buildPaymentTraces } from "@/lib/payment-events";

describe("buildPaymentTraces", () => {
  it("ödeme notunu ödenen taksitlere bağlar, geri alınanı atlar", () => {
    const traces = buildPaymentTraces([
      { entity_id: "s1", event_type: "odeme_alindi", created_at: "2026-10-08T10:00:00Z", payload: { note: "anne nakit getirdi", paidIds: ["a", "b"] }, actor: { full_name: "Zehra" } },
      { entity_id: "s1", event_type: "odeme_alindi", created_at: "2026-10-09T10:00:00Z", payload: { note: "yanlış", paidIds: ["c"], undone: true } },
      { entity_id: "s1", event_type: "odeme_alindi", created_at: "2026-10-09T11:00:00Z", payload: { note: null, paidIds: ["d"] } },
    ]);
    expect(traces.notes.get("a")?.[0]).toEqual({ at: "2026-10-08T10:00:00Z", actorName: "Zehra", note: "anne nakit getirdi" });
    expect(traces.notes.get("b")).toHaveLength(1);
    expect(traces.notes.has("c")).toBe(false);
    expect(traces.notes.has("d")).toBe(false);
  });

  it("hatırlatmaları en yeni önce sıralar ve öğrencinin son hatırlatmasını verir", () => {
    const traces = buildPaymentTraces([
      { entity_id: "s1", event_type: "odeme_hatirlatildi", created_at: "2026-10-05T09:00:00Z", payload: { installmentIds: ["x"] } },
      { entity_id: "s1", event_type: "odeme_hatirlatildi", created_at: "2026-10-12T09:00:00Z", payload: { installmentIds: ["x", "y"] }, actor: [{ full_name: "Mehtap" }] },
    ]);
    expect(traces.reminders.get("x")?.map((t) => t.at)).toEqual(["2026-10-12T09:00:00Z", "2026-10-05T09:00:00Z"]);
    expect(traces.lastReminderByStudent.get("s1")?.actorName).toBe("Mehtap");
  });
});
