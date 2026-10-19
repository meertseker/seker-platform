import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_HOURS as H, istanbulAt } from "@/lib/lead-flow/business-hours";
import {
  FOLLOWUP_STEPS,
  afterVisitTasks,
  appointmentTasks,
  followupAfterAttempt,
  kontenjanTask,
  noShowTask,
} from "@/lib/lead-flow/followups";

// 2026-11-03 Salı, 11-04 Çarşamba, 11-05 Perşembe, 11-06 Cuma, 11-09 Pazartesi
const at = (d: string, t: string) => istanbulAt(d, t);

describe("followupAfterAttempt", () => {
  it("ilk arama açılmazsa 3 saat sonra", () => {
    const a = at("2026-11-03", "10:00");
    const t = followupAfterAttempt("L1", "Ayşe", 1, a, a, H)!;
    expect(t.dueAt).toEqual(at("2026-11-03", "13:00"));
    expect(t.ruleKey).toBe("takip:L1:2");
    expect(t.title).toBe("2. deneme · Ayşe");
    expect(t.kind).toBe("arama");
  });
  it("+3 saat mesai dışına taşarsa sabaha kayar", () => {
    const a = at("2026-11-03", "16:30");
    expect(followupAfterAttempt("L1", "A", 1, a, a, H)!.dueAt).toEqual(at("2026-11-04", "08:30"));
  });
  it("ertesi gün 10:00", () => {
    const a = at("2026-11-03", "10:00");
    expect(followupAfterAttempt("L1", "A", 2, a, a, H)!.dueAt).toEqual(at("2026-11-04", "10:00"));
  });
  it("ertesi gün akşam 18:30 mesai dışı olsa da kalır", () => {
    const first = at("2026-11-03", "10:00");
    const t = followupAfterAttempt("L1", "A", 3, at("2026-11-04", "10:05"), first, H)!;
    expect(t.dueAt).toEqual(at("2026-11-04", "18:30"));
  });
  it("3. gün ziyaret saatleri şablonuyla", () => {
    const first = at("2026-11-03", "10:00");
    const t = followupAfterAttempt("L1", "A", 4, at("2026-11-04", "18:35"), first, H)!;
    expect(t.dueAt).toEqual(at("2026-11-05", "10:00"));
    expect(t.templateKey).toBe("ziyaret_saatleri");
  });
  it("7. gün son deneme", () => {
    const first = at("2026-11-03", "10:00");
    const t = followupAfterAttempt("L1", "A", 5, at("2026-11-05", "10:00"), first, H)!;
    expect(t.dueAt).toEqual(at("2026-11-09", "10:00"));
    expect(t.ruleKey).toBe("takip:L1:6");
    expect(t.title).toBe("Son deneme · A");
  });
  it("5. denemeden sonra sıra biter", () => {
    const a = at("2026-11-03", "10:00");
    expect(FOLLOWUP_STEPS).toBe(5);
    expect(followupAfterAttempt("L1", "A", 6, a, a, H)).toBeNull();
  });
  it("cumartesiye düşen 3. gün pazartesiye kayar", () => {
    const first = at("2026-11-05", "10:00"); // Perşembe
    const t = followupAfterAttempt("L1", "A", 4, at("2026-11-06", "18:35"), first, H)!;
    expect(t.dueAt).toEqual(at("2026-11-09", "10:00"));
  });
  it("hafta sonuna düşen 18:30 sonraki iş gününe kayar", () => {
    const first = at("2026-11-06", "10:00"); // Cuma
    const t = followupAfterAttempt("L1", "A", 3, at("2026-11-07", "10:00"), first, H)!;
    expect(t.dueAt).toEqual(at("2026-11-09", "18:30"));
  });
});

describe("appointmentTasks", () => {
  const appt = at("2026-11-05", "16:30");
  it("randevu hatırlatmaları", () => {
    const l = appointmentTasks("A1", "Ayşe", appt, at("2026-11-03", "09:00"));
    expect(l.map((t) => t.ruleKey)).toEqual(["hatirlat:A1:once", "hatirlat:A1:sabah"]);
    expect(l[0].dueAt).toEqual(at("2026-11-04", "10:00"));
    expect(l[0].templateKey).toBe("randevu_onay");
    expect(l[1].dueAt).toEqual(at("2026-11-05", "09:00"));
    expect(l[0].title).toBe("Ziyaret hatırlatması · Ayşe");
  });
  it("geçmişte kalan atlanır", () => {
    const l = appointmentTasks("A1", "A", appt, at("2026-11-04", "11:00"));
    expect(l.map((t) => t.ruleKey)).toEqual(["hatirlat:A1:sabah"]);
  });
  it("sabah 09:00 hatırlatması yalnız ziyaretten önceyse kurulur (R25)", () => {
    const early = appointmentTasks("A1", "A", at("2026-11-05", "08:45"), at("2026-11-03", "09:00"));
    expect(early.map((t) => t.ruleKey)).toEqual(["hatirlat:A1:once"]);
    const atNine = appointmentTasks("A1", "A", at("2026-11-05", "09:00"), at("2026-11-03", "09:00"));
    expect(atNine.map((t) => t.ruleKey)).toEqual(["hatirlat:A1:once"]);
    const later = appointmentTasks("A1", "A", at("2026-11-05", "09:30"), at("2026-11-03", "09:00"));
    expect(later.map((t) => t.ruleKey)).toEqual(["hatirlat:A1:once", "hatirlat:A1:sabah"]);
  });
  it("pazartesi randevusunun önceki gün hatırlatması cumaya çekilir", () => {
    const l = appointmentTasks("A1", "A", at("2026-11-09", "11:00"), at("2026-11-02", "09:00"));
    expect(l[0].dueAt).toEqual(at("2026-11-06", "10:00"));
    expect(l[1].dueAt).toEqual(at("2026-11-09", "09:00"));
  });
});

describe("afterVisitTasks / noShowTask", () => {
  it("geldi sonrası görevler", () => {
    const l = afterVisitTasks("A1", "Ayşe", at("2026-11-05", "16:45"), H);
    expect(l.map((t) => t.ruleKey)).toEqual(["ziyaret:A1:1", "ziyaret:A1:2", "ziyaret:A1:3"]);
    expect(l[0]).toMatchObject({ kind: "whatsapp", templateKey: "ziyaret_tesekkur" });
    expect(l[0].dueAt).toEqual(at("2026-11-06", "10:00"));
    expect(l[1].dueAt).toEqual(at("2026-11-09", "10:00")); // Cumartesi → Pazartesi
    expect(l[1].kind).toBe("arama");
    expect(l[2].dueAt).toEqual(at("2026-11-12", "10:00"));
    expect(l[1].title).toBe("Ziyaret sonrası arama · Ayşe");
  });
  it("gelmedi görevi aynı gün", () => {
    const now = at("2026-11-03", "11:00");
    const t = noShowTask("A1", "Ayşe", now, H);
    expect(t.dueAt).toEqual(now);
    expect(t.ruleKey).toBe("noshow:A1");
  });
});

describe("takip tabanı (deneme saatinden önceye düşmez)", () => {
  it("Cuma ilk deneme: 3. deneme Pazartesi 18:30 ise 4. görev Salı 08:30", () => {
    const first = at("2026-11-06", "10:00");
    const t = followupAfterAttempt("L1", "A", 3, at("2026-11-09", "18:30"), first, H)!;
    expect(t.dueAt).toEqual(at("2026-11-10", "08:30"));
  });
  it("normal Salı akışı değişmez: 4. deneme Çarşamba 18:35 -> Perşembe 10:00", () => {
    const first = at("2026-11-03", "10:00");
    const t = followupAfterAttempt("L1", "A", 4, at("2026-11-04", "18:35"), first, H)!;
    expect(t.dueAt).toEqual(at("2026-11-05", "10:00"));
  });
  it("deneme 0 -> null", () => {
    const a = at("2026-11-03", "10:00");
    expect(followupAfterAttempt("L1", "A", 0, a, a, H)).toBeNull();
  });
  it("gelmedi görevi Cumartesi -> Pazartesi 08:30", () => {
    expect(noShowTask("A1", "A", at("2026-11-07", "12:00"), H).dueAt).toEqual(at("2026-11-09", "08:30"));
  });
});

describe("kontenjanTask", () => {
  it("kapanıştan 30 gün sonra 10:00, WhatsApp kontenjan şablonu", () => {
    const t = kontenjanTask("L1", "Ayşe", at("2026-11-03", "16:00"), H);
    expect(t).toEqual({
      ruleKey: "kontenjan:L1",
      title: "Kontenjan mesajı · Ayşe",
      kind: "whatsapp",
      templateKey: "kontenjan",
      dueAt: at("2026-12-03", "10:00"),
    });
  });
  it("hafta sonuna düşerse sonraki mesai gününe kayar", () => {
    // 2026-11-06 Cuma + 30 gün = 2026-12-06 Pazar -> Pazartesi
    expect(kontenjanTask("L1", "A", at("2026-11-06", "10:00"), H).dueAt).toEqual(at("2026-12-07", "10:00"));
  });
});
