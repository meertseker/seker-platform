import { describe, expect, it } from "vitest";
import {
  emptyContext,
  escapeWa,
  formatGroup,
  formatTl,
  groupItems,
  maskPhone,
  type WaContext,
  type WaItem,
} from "@/lib/wa/format";

let seq = 0;
function item(partial: Partial<WaItem> & Pick<WaItem, "eventType" | "entityType" | "entityId">): WaItem {
  seq += 1;
  return {
    outboxId: `o${seq}`,
    actorId: "u1",
    payload: {},
    createdAt: "2026-10-19T11:00:00.000Z",
    ...partial,
  };
}

function ctx(): WaContext {
  const c = emptyContext();
  c.actors.set("u1", "Merve Hanım");
  c.actors.set("u2", "Ahmet Bey");
  c.leads.set("L1", { parentName: "Ayşe Yılmaz", childName: "Can", phone: "05321234547", source: "instagram" });
  c.students.set("S1", { fullName: "Elif Demir", parentName: "Zeynep Demir", program: "tam_gun" });
  c.installments.set("I1", { studentId: "S1", itemType: "aidat", dueDate: "2026-10-05", amount: 3500 });
  c.offers.set("O1", { leadId: "L1", program: "tam_gun", offeredPrice: 9000, listPrice: 10000 });
  return c;
}

describe("yardımcılar", () => {
  it("telefonu maskeler", () => {
    expect(maskPhone("05321234547")).toBe("0532 *** ** 47");
    expect(maskPhone("+90 532 123 45 47")).toBe("0532 *** ** 47");
    expect(maskPhone("123")).toBeNull();
  });

  it("TL'yi kuruşsuz yazar", () => {
    expect(formatTl(3500)).toBe("3.500 ₺");
    expect(formatTl(1250.5)).toBe("1.250,5 ₺");
  });

  it("WhatsApp biçim karakterlerini etkisizleştirir", () => {
    expect(escapeWa("*kalın* _italik_ ~çizik~")).not.toMatch(/[*_~]/);
  });
});

describe("groupItems", () => {
  it("aynı kişinin aynı velide peş peşe işlemlerini birleştirir", () => {
    const c = ctx();
    const groups = groupItems(
      [
        item({ eventType: "not_eklendi", entityType: "lead", entityId: "L1", noteBody: "Ulaştım", createdAt: "2026-10-19T11:00:00Z" }),
        item({ eventType: "durum_degisti", entityType: "lead", entityId: "L1", payload: { from: "yeni", to: "ulasildi" }, createdAt: "2026-10-19T11:00:02Z" }),
        item({ eventType: "randevu_olusturuldu", entityType: "appointment", entityId: "A1", payload: { leadId: "L1", scheduledAt: "2026-10-25T07:30:00Z", type: "okul_ziyareti" }, createdAt: "2026-10-19T11:00:40Z" }),
      ],
      c,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(3);
  });

  it("farklı kişi, farklı kayıt ya da uzun ara ayrı mesaj olur", () => {
    const c = ctx();
    const groups = groupItems(
      [
        item({ eventType: "lead_olusturuldu", entityType: "lead", entityId: "L1", createdAt: "2026-10-19T11:00:00Z" }),
        item({ eventType: "durum_degisti", entityType: "lead", entityId: "L1", actorId: "u2", payload: { to: "ulasildi" }, createdAt: "2026-10-19T11:00:10Z" }),
        item({ eventType: "taksit_odendi", entityType: "installment", entityId: "I1", createdAt: "2026-10-19T11:00:20Z" }),
        item({ eventType: "lead_guncellendi", entityType: "lead", entityId: "L1", createdAt: "2026-10-19T11:05:00Z" }),
      ],
      c,
    );
    expect(groups.map((g) => g.items.length)).toEqual([1, 1, 1, 1]);
  });

  it("toplu zam olaylarını tek grupta toplar", () => {
    const c = ctx();
    const groups = groupItems(
      ["S1", "S2", "S3"].map((id) =>
        item({ eventType: "zam_uygulandi", entityType: "student", entityId: id, payload: { percent: 25, fromMonth: "2027-01" } }),
      ),
      c,
    );
    expect(groups).toHaveLength(1);
    expect(formatGroup(groups[0], c)).toBe("📈 *Toplu zam uygulandı*\n3 öğrenci · %25 · Ocak 2027 ayından itibaren\n— Merve Hanım");
  });
});

describe("formatGroup", () => {
  it("yeni veli mesajı", () => {
    const c = ctx();
    const [group] = groupItems([item({ eventType: "lead_olusturuldu", entityType: "lead", entityId: "L1", payload: { source: "instagram" } })], c);
    expect(formatGroup(group, c)).toBe(
      ["*Ayşe Yılmaz* · Can", "🆕 Yeni veli eklendi", "Tel: 0532 *** ** 47", "Kaynak: Instagram", "— Merve Hanım"].join("\n"),
    );
  });

  it("görüşme notu + durum değişimi tek mesaj", () => {
    const c = ctx();
    const [group] = groupItems(
      [
        item({ eventType: "not_eklendi", entityType: "lead", entityId: "L1", noteBody: "Ulaştım\nCumartesi gelecekler" }),
        item({ eventType: "durum_degisti", entityType: "lead", entityId: "L1", payload: { from: "yeni", to: "randevu" } }),
      ],
      c,
    );
    expect(formatGroup(group, c)).toBe(
      [
        "*Ayşe Yılmaz* · Can",
        "📝 Görüşme notu",
        "> Ulaştım",
        "> Cumartesi gelecekler",
        "🔄 Durum: Yeni → Randevu",
        "— Merve Hanım",
      ].join("\n"),
    );
  });

  it("aynı grupta görüşme notu varsa arama_kaydi ve mesaj_tekrar ayrı satır üretmez (R25)", () => {
    const c = ctx();
    const [group] = groupItems(
      [
        item({ eventType: "not_eklendi", entityType: "lead", entityId: "L1", noteBody: "Arandı, ulaşılamadı (1. deneme)" }),
        item({ eventType: "arama_kaydi", entityType: "lead", entityId: "L1", payload: { result: "ulasilamadi" } }),
        item({ eventType: "mesaj_tekrar", entityType: "lead", entityId: "L1", payload: { channel: "ig_dm" } }),
      ],
      c,
    );
    expect(formatGroup(group, c)).toBe(
      ["*Ayşe Yılmaz* · Can", "📝 Görüşme notu", "> Arandı, ulaşılamadı (1. deneme)", "— Merve Hanım"].join("\n"),
    );
    // Not yoksa olay kendi satırıyla görünür.
    const [alone] = groupItems([item({ eventType: "arama_kaydi", entityType: "lead", entityId: "L1" })], c);
    expect(formatGroup(alone, c)).toContain("Arama kaydedildi");
  });

  it("ödeme mesajı öğrenci adıyla", () => {
    const c = ctx();
    const [group] = groupItems(
      [item({ eventType: "odeme_alindi", entityType: "student", entityId: "S1", payload: { totalTl: 3500, methods: ["nakit"], note: "Ekim" } })],
      c,
    );
    expect(formatGroup(group, c)).toBe(
      ["*Elif Demir* · öğrenci", "💰 Ödeme alındı", "Tutar: 3.500 ₺ · Nakit", "Not: Ekim", "— Merve Hanım"].join("\n"),
    );
  });

  it("taksit olayı taksitin öğrencisine bağlanır", () => {
    const c = ctx();
    const [group] = groupItems([item({ eventType: "taksit_odendi", entityType: "installment", entityId: "I1", payload: { paidTl: 3500 } })], c);
    expect(formatGroup(group, c)).toBe(["*Elif Demir* · öğrenci", "💰 Ödeme alındı", "Ekim aidatı: 3.500 ₺", "— Merve Hanım"].join("\n"));
  });

  it("teklif bilgisi teklif kaydından tamamlanır", () => {
    const c = ctx();
    const [group] = groupItems([item({ eventType: "teklif_onaylandi", entityType: "offer", entityId: "O1", payload: { leadId: "L1" } })], c);
    expect(formatGroup(group, c)).toBe(
      ["*Ayşe Yılmaz* · Can", "✅ Teklif onaylandı", "Tam Gün · 9.000 ₺/ay (liste 10.000 ₺)", "— Merve Hanım"].join("\n"),
    );
  });

  it("silinen veli adını olay kaydından alır", () => {
    const c = emptyContext();
    c.actors.set("u1", "Merve Hanım");
    const [group] = groupItems(
      [item({ eventType: "lead_silindi", entityType: "lead", entityId: "GONE", payload: { parentName: "Eski Veli", childName: null } })],
      c,
    );
    expect(formatGroup(group, c)).toBe(["*Eski Veli*", "🗑️ Veli kaydı silindi", "— Merve Hanım"].join("\n"));
  });

  it("web başvurusunu 'Web sitesi' imzasıyla yazar", () => {
    const c = ctx();
    const [group] = groupItems([item({ eventType: "web_basvuru", entityType: "lead", entityId: "L1", actorId: null })], c);
    expect(formatGroup(group, c)).toContain("— Web sitesi");
    expect(formatGroup(group, c)).toContain("🌐 Web sitesinden başvurdu");
  });

  it("bilinmeyen olay türü için mesaj üretmez", () => {
    const c = ctx();
    const [group] = groupItems([item({ eventType: "bilinmeyen_tur", entityType: "lead", entityId: "L1" })], c);
    expect(formatGroup(group, c)).toBeNull();
  });
});

describe("sessiz olaylar", () => {
  it("üstlenme olayı gruba yazılmaz; yanındaki not yine gider", () => {
    const c = ctx();
    const alone = groupItems([item({ eventType: "ustlenildi", entityType: "lead", entityId: "L1" })], c);
    expect(formatGroup(alone[0], c)).toBeNull();
    const withNote = groupItems([
      item({ eventType: "ustlenildi", entityType: "lead", entityId: "L1", createdAt: "2026-10-19T11:00:00Z" }),
      item({ eventType: "not_eklendi", entityType: "lead", entityId: "L1", noteBody: "Ulaştım", createdAt: "2026-10-19T11:00:10Z" }),
    ], c);
    const text = formatGroup(withNote[0], c)!;
    expect(text).toContain("Ulaştım");
    expect(text).not.toMatch(/üstlen/i);
  });
});
