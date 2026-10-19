import { describe, it, expect } from "vitest";
import { labelQueue, labelFollowups, type QueueRow, type FollowupRow } from "@/lib/queries/call-queue";
import { ageFromBirth } from "@/lib/lead-flow/age";
import { fillTemplate } from "@/lib/lead-flow/template";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/lead-flow/business-hours";

const ME = "00000000-0000-0000-0000-000000000001";
const ZEHRA = "00000000-0000-0000-0000-000000000002";
const hours = DEFAULT_BUSINESS_HOURS; // Pzt–Cum 08:30–18:00

function row(over: Partial<QueueRow> = {}): QueueRow {
  return {
    id: "l1",
    parent_name: "Ayşe Kaya",
    phone: "+905005550001",
    source: "instagram",
    channel: "ig_dm",
    content_code: "R-1104-A",
    district: "Beykent",
    start_window: "hemen",
    child_birth_month: 3,
    child_birth_year: 2023,
    created_at: "2026-10-20T10:00:00+03:00",
    claimed_at: null,
    assigned_to: null,
    claimer_name: null,
    ...over,
  };
}

// Salı 20 Ekim 2026, 10:20 İstanbul
const now = new Date("2026-10-20T10:20:00+03:00");

describe("labelQueue", () => {
  it("başkasının taze üstlendiği veli pasif görünür", () => {
    const [lead] = labelQueue(
      [row({ assigned_to: ZEHRA, claimed_at: "2026-10-20T10:12:00+03:00", claimer_name: "Zehra Yılmaz" })],
      ME, now, 15, hours,
    );
    expect(lead.claimedByName).toBe("Zehra Yılmaz");
    expect(lead.claimUntil).toBe(new Date("2026-10-20T10:27:00+03:00").toISOString());
  });

  it("15 dakikayı geçmiş üstlenme aktif görünür", () => {
    const [lead] = labelQueue(
      [row({ assigned_to: ZEHRA, claimed_at: "2026-10-20T10:04:00+03:00", claimer_name: "Zehra Yılmaz" })],
      ME, now, 15, hours,
    );
    expect(lead.claimedByName).toBeNull();
  });

  it("kendi üstlendiğim veli aktif görünür", () => {
    const [lead] = labelQueue(
      [row({ assigned_to: ME, claimed_at: "2026-10-20T10:15:00+03:00", claimer_name: "Ben" })],
      ME, now, 15, hours,
    );
    expect(lead.claimedByName).toBeNull();
  });

  it("otomatik atanmış ama kimsenin Ara'ya basmadığı veli aktif görünür", () => {
    const [lead] = labelQueue([row({ assigned_to: ZEHRA, claimed_at: null, claimer_name: "Zehra" })], ME, now, 15, hours);
    expect(lead.claimedByName).toBeNull();
  });

  it("isimsiz üstlenen için genel etiket", () => {
    const [lead] = labelQueue(
      [row({ assigned_to: ZEHRA, claimed_at: "2026-10-20T10:15:00+03:00", claimer_name: null })],
      ME, now, 15, hours,
    );
    expect(lead.claimedByName).toBe("Başka bir danışman");
  });

  it("mesai dışı gelen velinin sayacı mesai başında başlar", () => {
    // Pazartesi 22:40 gelen form → Salı 08:30'da başlar, gece kırmızıya dönmez.
    const [lead] = labelQueue([row({ created_at: "2026-10-19T22:40:00+03:00" })], ME, now, 15, hours);
    expect(lead.startedAt).toBe(new Date("2026-10-20T08:30:00+03:00").toISOString());
    const [atOpen] = labelQueue(
      [row({ created_at: "2026-10-19T22:40:00+03:00" })], ME, new Date("2026-10-20T08:30:00+03:00"), 15, hours,
    );
    expect(atOpen.startedAt).toBe(new Date("2026-10-20T08:30:00+03:00").toISOString());
  });

  it("en eski üstte; alanlar eşlenir", () => {
    const list = labelQueue(
      [
        row({ id: "yeni", created_at: "2026-10-20T10:18:00+03:00" }),
        row({ id: "eski", created_at: "2026-10-20T10:03:00+03:00", source: "reklam", channel: "form" }),
      ],
      ME, now, 15, hours,
    );
    expect(list.map((l) => l.id)).toEqual(["eski", "yeni"]);
    expect(list[1]).toMatchObject({
      parentName: "Ayşe Kaya",
      phone: "+905005550001",
      source: "instagram",
      channel: "ig_dm",
      contentCode: "R-1104-A",
      childAge: 3,
      district: "Beykent",
      startWindow: "hemen",
    });
  });
});

describe("labelFollowups", () => {
  const LEAD = { id: "l9", parent_name: "Elif Şahin", phone: "+905005550009" };
  function task(over: Partial<FollowupRow> = {}): FollowupRow {
    return {
      id: "t1",
      title: "2. deneme · Elif Şahin",
      rule_key: "takip:l9:2",
      due_at: "2026-10-20T10:00:00+03:00",
      due_date: "2026-10-20",
      lead: LEAD,
      ...over,
    };
  }

  it("alt başlığı kural anahtarından üretir", () => {
    const list = labelFollowups(
      [
        task({ id: "a", rule_key: "takip:l9:2" }),
        task({ id: "b", rule_key: "takip:l9:6", title: "Son deneme · Elif Şahin" }),
        task({ id: "c", rule_key: "geri:l9" }),
        task({ id: "d", rule_key: "hatirlat:ap1:sabah" }),
        task({ id: "e", rule_key: "ziyaret:ap1:2" }),
        task({ id: "f", rule_key: "noshow:ap1" }),
        task({ id: "g", rule_key: "ziyaret:ap1:1", title: "Teşekkür mesajı · Elif Şahin" }),
      ],
      now,
    );
    expect(Object.fromEntries(list.map((t) => [t.id, t.subtitle]))).toEqual({
      a: "2. deneme",
      b: "Son deneme",
      c: "Geri arama",
      d: "Ziyaret hatırlatması",
      e: "Ziyaret sonrası",
      f: "Gelmedi · tekrar ara",
      g: "Teşekkür mesajı",
    });
  });

  it("elle açılmış görevde başlık alt başlık olur", () => {
    const [t] = labelFollowups([task({ rule_key: null, title: "Broşür gönder" })], now);
    expect(t.subtitle).toBe("Broşür gönder");
  });

  it("vakti gelen 'şimdi', saatli görevler saate göre, saatsizler sonda", () => {
    const list = labelFollowups(
      [
        task({ id: "eski", due_at: null, due_date: "2026-10-19" }),
        task({ id: "aksam", due_at: "2026-10-20T18:30:00+03:00" }),
        task({ id: "sabah", due_at: "2026-10-20T10:00:00+03:00" }),
        task({ id: "ogle", due_at: "2026-10-20T14:00:00+03:00" }),
      ],
      now,
    );
    expect(list.map((t) => [t.id, t.time, t.dueNow])).toEqual([
      ["sabah", "10:00", true],
      ["ogle", "14:00", false],
      ["aksam", "18:30", false],
      ["eski", null, false],
    ]);
  });
});

describe("ageFromBirth", () => {
  it("Mart 2023 doğumluya Kasım 2026'da 3 der", () => {
    expect(ageFromBirth(3, 2023, new Date("2026-11-04T10:00:00+03:00"))).toBe(3);
  });
  it("doğum ayı gelmediyse bir eksik", () => {
    expect(ageFromBirth(12, 2023, new Date("2026-11-04T10:00:00+03:00"))).toBe(2);
  });
  it("eksik bilgide null", () => {
    expect(ageFromBirth(null, 2023, new Date())).toBeNull();
    expect(ageFromBirth(3, null, new Date())).toBeNull();
  });
  it("gelecekteki doğumda null", () => {
    expect(ageFromBirth(5, 2027, new Date("2026-11-04T10:00:00+03:00"))).toBeNull();
  });
});

describe("fillTemplate", () => {
  it("yer tutucuları doldurur, bilinmeyeni bırakır", () => {
    expect(fillTemplate("Merhaba {veli}, ben {danisman}. {x}", { veli: "Ayşe Hanım", danisman: "Zehra" })).toBe(
      "Merhaba Ayşe Hanım, ben Zehra. {x}",
    );
  });
});
