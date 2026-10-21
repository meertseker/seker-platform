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

describe("odeme_alindi: taksit ve plan durumu", () => {
  function settled(partial: Record<string, unknown>) {
    return {
      installmentId: "I9", itemType: "kitap", dueDate: "2026-10-05", amountTl: 3000, paidTl: 3000,
      complete: true, remainderTl: 0, remainderCount: 0, remainderDueDate: null, ...partial,
    };
  }
  function plan(partial: Record<string, unknown>) {
    return { planId: "P1", itemType: "kitap", pendingCount: 0, pendingTl: 0, tentativePending: false, closed: true, ...partial };
  }
  function message(payload: Record<string, unknown>) {
    const c = ctx();
    const [group] = groupItems(
      [item({ eventType: "odeme_alindi", entityType: "student", entityId: "S1", payload: { methods: ["nakit"], ...payload } })],
      c,
    );
    return formatGroup(group, c);
  }

  it("tam ödenen taksit ve planda kalan tutar", () => {
    expect(
      message({
        totalTl: 3000,
        settled: [settled({})],
        plans: [plan({ pendingCount: 2, pendingTl: 6000, closed: false })],
      }),
    ).toBe(
      [
        "*Elif Demir* · öğrenci",
        "💰 Ödeme alındı",
        "Tutar: 3.000 ₺ · Nakit",
        "✅ Ekim kitap-kırtasiye taksiti tamamlandı",
        "Kitap-kırtasiye kalan: 6.000 ₺ (2 taksit)",
        "— Merve Hanım",
      ].join("\n"),
    );
  });

  it("kısmi ödeme: kalan aynı vadede", () => {
    expect(
      message({
        totalTl: 2995,
        note: "eksik getirdi",
        settled: [settled({ paidTl: 2995, complete: false, remainderTl: 5, remainderCount: 1, remainderDueDate: "2026-10-05" })],
        plans: [plan({ pendingCount: 1, pendingTl: 5, closed: false })],
      }),
    ).toBe(
      [
        "*Elif Demir* · öğrenci",
        "💰 Ödeme alındı",
        "Tutar: 2.995 ₺ · Nakit",
        "Ekim kitap-kırtasiye: kısmi, kalan 5 ₺",
        "Kitap-kırtasiye kalan: 5 ₺ (1 taksit)",
        "Not: eksik getirdi",
        "— Merve Hanım",
      ].join("\n"),
    );
  });

  it("kısmi ödeme: kalan yeni vadeye ya da birkaç taksite bölündü", () => {
    const one = message({
      totalTl: 2000,
      settled: [settled({ paidTl: 2000, complete: false, remainderTl: 1000, remainderCount: 1, remainderDueDate: "2026-11-05" })],
    });
    expect(one).toContain("Ekim kitap-kırtasiye: kısmi, kalan 1.000 ₺ (yeni vade 5 Kasım 2026)");
    const many = message({
      totalTl: 2100,
      settled: [settled({ paidTl: 2100, complete: false, remainderTl: 900, remainderCount: 3, remainderDueDate: "2026-11-05" })],
    });
    expect(many).toContain("Ekim kitap-kırtasiye: kısmi, kalan 900 ₺ (3 taksite bölündü, ilk vade 5 Kasım 2026)");
  });

  it("iki taksit birden ödenir", () => {
    const text = message({
      totalTl: 6000,
      settled: [settled({ installmentId: "Ia" }), settled({ installmentId: "Ib", dueDate: "2026-11-05" })],
      plans: [plan({ pendingCount: 1, pendingTl: 3000, closed: false })],
    });
    expect(text).toContain(
      ["✅ Ekim kitap-kırtasiye taksiti tamamlandı", "✅ Kasım kitap-kırtasiye taksiti tamamlandı", "Kitap-kırtasiye kalan: 3.000 ₺ (1 taksit)"].join("\n"),
    );
  });

  it("plan kapanır", () => {
    expect(
      message({ totalTl: 3000, settled: [settled({ dueDate: "2026-12-05" })], plans: [plan({})] }),
    ).toBe(
      [
        "*Elif Demir* · öğrenci",
        "💰 Ödeme alındı",
        "Tutar: 3.000 ₺ · Nakit",
        "✅ Aralık kitap-kırtasiye taksiti tamamlandı",
        "✅ Kitap-kırtasiye tamamen ödendi",
        "— Merve Hanım",
      ].join("\n"),
    );
  });

  it("aidatta kalan tutar değil taksit sayısı yazılır", () => {
    expect(
      message({
        totalTl: 15495,
        settled: [settled({ itemType: "aidat", amountTl: 15495, paidTl: 15495 })],
        plans: [plan({ itemType: "aidat", pendingCount: 8, pendingTl: 123960, closed: false })],
      }),
    ).toBe(
      [
        "*Elif Demir* · öğrenci",
        "💰 Ödeme alındı",
        "Tutar: 15.495 ₺ · Nakit",
        "✅ Ekim aidat taksiti tamamlandı",
        "Aidat kalan: 8 taksit",
        "— Merve Hanım",
      ].join("\n"),
    );
  });

  it("kesinleşmemiş tutar varsa kalan tutar yazılmaz, yalnız taksit sayısı", () => {
    const text = message({
      totalTl: 3000,
      settled: [settled({})],
      plans: [plan({ pendingCount: 2, pendingTl: 6000, tentativePending: true, closed: false })],
    });
    expect(text).toContain("Kitap-kırtasiye kalan: 2 taksit");
    expect(text).not.toContain("6.000");
  });

  it("eski payload (durum alanı yok) bugünkü mesajı aynen verir", () => {
    expect(message({ totalTl: 15495, note: "Ekim" })).toBe(
      ["*Elif Demir* · öğrenci", "💰 Ödeme alındı", "Tutar: 15.495 ₺ · Nakit", "Not: Ekim", "— Merve Hanım"].join("\n"),
    );
  });

  it("bozuk durum kayıtlarını atlar", () => {
    expect(message({ totalTl: 100, settled: [null, { itemType: 3 }], plans: "x" })).toBe(
      ["*Elif Demir* · öğrenci", "💰 Ödeme alındı", "Tutar: 100 ₺ · Nakit", "— Merve Hanım"].join("\n"),
    );
  });
});
