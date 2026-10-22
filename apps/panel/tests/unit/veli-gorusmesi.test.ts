import { describe, expect, it } from "vitest";
import { labelFollowups, followupAction } from "@/lib/queries/call-queue";
import { hedefFor, chatIdFor } from "@/lib/wa/routing";
import { emptyContext, formatGroup, groupItems, type WaItem } from "@/lib/wa/format";
import {
  contactedAtInputValue,
  duePromisesFirst,
  openPromises,
  parseContactedAt,
  promiseKept,
  promiseRuleKey,
  promiseState,
  promiseTaskTitle,
  validateGorusmeInput,
  type GorusmeRow,
} from "@/lib/veli-gorusmesi";

const NOW = new Date("2026-10-22T09:00:00.000Z"); // İstanbul 12:00

function row(partial: Partial<GorusmeRow> & Pick<GorusmeRow, "id">): GorusmeRow {
  return {
    student_id: "S1",
    author_id: "U1",
    contacted_at: "2026-10-20T09:00:00.000Z",
    created_at: "2026-10-20T09:00:00.000Z",
    contact_with: "baba",
    outcome: "soz_verdi",
    note: null,
    promise_date: "2026-11-30",
    promise_amount: null,
    ...partial,
  };
}

describe("validateGorusmeInput", () => {
  const base = { contactWith: "baba", outcome: "ulasildi", note: "  Görüştük  ", contactedAt: "2026-10-22T11:30" };

  it("İstanbul saatini ISO'ya çevirir, notu kırpar, söz alanlarını boş bırakır", () => {
    const result = validateGorusmeInput(base, NOW);
    expect(result).toEqual({
      record: {
        contact_with: "baba",
        outcome: "ulasildi",
        note: "Görüştük",
        contacted_at: "2026-10-22T08:30:00.000Z",
        promise_date: null,
        promise_amount: null,
      },
    });
  });

  it("söz verdi: tarih zorunlu, tutar isteğe bağlı", () => {
    expect(validateGorusmeInput({ ...base, outcome: "soz_verdi" }, NOW)).toEqual({ error: "Söz verilen ödeme tarihini girin" });
    const ok = validateGorusmeInput({ ...base, outcome: "soz_verdi", promiseDate: "2026-11-30", promiseAmountTl: 55700 }, NOW);
    expect("record" in ok && ok.record).toMatchObject({ promise_date: "2026-11-30", promise_amount: 55700 });
    const noAmount = validateGorusmeInput({ ...base, outcome: "soz_verdi", promiseDate: "2026-11-30", promiseAmountTl: null }, NOW);
    expect("record" in noAmount && noAmount.record.promise_amount).toBeNull();
  });

  it("söz verdi dışında gelen söz alanları atılır (DB check ile uyumlu)", () => {
    const result = validateGorusmeInput({ ...base, outcome: "ulasilamadi", promiseDate: "2026-11-30", promiseAmountTl: 100 }, NOW);
    expect("record" in result && result.record).toMatchObject({ promise_date: null, promise_amount: null });
  });

  it("hatalı girdileri reddeder", () => {
    expect(validateGorusmeInput({ ...base, contactWith: "dede" }, NOW)).toHaveProperty("error");
    expect(validateGorusmeInput({ ...base, outcome: "bilinmiyor" }, NOW)).toHaveProperty("error");
    expect(validateGorusmeInput({ ...base, contactedAt: "2026-10-23T11:30" }, NOW)).toHaveProperty("error");
    expect(validateGorusmeInput({ ...base, note: "x".repeat(4001) }, NOW)).toHaveProperty("error");
    expect(
      validateGorusmeInput({ ...base, outcome: "soz_verdi", promiseDate: "2026-10-21" }, NOW),
    ).toEqual({ error: "Söz tarihi görüşme tarihinden önce olamaz" });
    expect(
      validateGorusmeInput({ ...base, outcome: "soz_verdi", promiseDate: "2026-11-30", promiseAmountTl: 0 }, NOW),
    ).toHaveProperty("error");
  });
});

describe("tarih yardımcıları", () => {
  it("formun varsayılan anı İstanbul saatidir ve geri okunur", () => {
    expect(contactedAtInputValue(NOW)).toBe("2026-10-22T12:00");
    expect(parseContactedAt(contactedAtInputValue(NOW), NOW)).toBe(NOW.toISOString());
    expect(parseContactedAt("22.10.2026", NOW)).toBeNull();
  });

  it("söz durumu", () => {
    expect(promiseState("2026-10-21", "2026-10-22")).toBe("gecti");
    expect(promiseState("2026-10-22", "2026-10-22")).toBe("bugun");
    expect(promiseState("2026-11-30", "2026-10-22")).toBe("ileride");
  });

  it("görev başlığı ve rule_key", () => {
    expect(promiseTaskTitle("Aziz Mirza Eryener", "2026-11-30")).toBe("Aziz Mirza Eryener: 30 Kasım ödeme sözü — ödeme geldi mi?");
    expect(promiseRuleKey("g1")).toBe("odeme_sozu:g1");
  });
});

describe("openPromises", () => {
  it("öğrencinin en son görüşmesi söz ise açıktır; sonraki görüşme eski sözü kapatır", () => {
    const rows = [
      row({ id: "a", student_id: "S1", contacted_at: "2026-10-01T09:00:00.000Z" }),
      row({ id: "b", student_id: "S1", contacted_at: "2026-10-10T09:00:00.000Z", outcome: "ulasilamadi", promise_date: null }),
      row({ id: "c", student_id: "S2", contacted_at: "2026-10-05T09:00:00.000Z" }),
      row({ id: "d", student_id: "S3", contacted_at: "2026-10-05T09:00:00.000Z", promise_date: "2026-10-20" }),
      row({ id: "e", student_id: "S3", contacted_at: "2026-10-06T09:00:00.000Z", promise_date: "2026-12-01" }),
    ];
    expect(openPromises(rows).map((r) => r.id).sort()).toEqual(["c", "e"]);
  });
});

describe("promiseKept", () => {
  const promise = { contacted_at: "2026-10-20T09:00:00.000Z", promise_date: "2026-11-30", promise_amount: null };
  const pending = { status: "bekliyor", due_date: "2026-06-30", amount: 55700 };

  it("tutarsız söz: söz tarihine kadar vadesi gelen bekleyen taksit kalmamalı", () => {
    expect(promiseKept(promise, [pending])).toBe(false);
    expect(promiseKept(promise, [{ ...pending, due_date: "2026-12-31" }])).toBe(true);
    expect(promiseKept(promise, [{ ...pending, status: "iptal" }])).toBe(true);
  });

  it("tutarlı söz: görüşme gününden bu yana o kadar tahsilat", () => {
    const withAmount = { ...promise, promise_amount: "20000" };
    const paid = (amount: number, day: string) => ({
      status: "odendi", due_date: "2026-06-30", amount, paid_amount: amount, paid_at: `${day}T10:00:00+03:00`,
    });
    expect(promiseKept(withAmount, [pending])).toBe(false);
    expect(promiseKept(withAmount, [paid(20000, "2026-10-19"), pending])).toBe(false); // görüşmeden önce
    expect(promiseKept(withAmount, [paid(15000, "2026-10-20"), pending])).toBe(false);
    expect(promiseKept(withAmount, [paid(15000, "2026-10-20"), paid(5000, "2026-11-02"), pending])).toBe(true);
  });
});

describe("duePromisesFirst", () => {
  it("söz günü gelmiş olanlar üstte (en eski söz önce), diğerlerinin sırası korunur", () => {
    const promises: Record<string, string | null> = { a: null, b: "2026-11-30", c: "2026-10-22", d: "2026-10-01", e: null };
    const ordered = duePromisesFirst(["a", "b", "c", "d", "e"], (k) => promises[k], "2026-10-22");
    expect(ordered).toEqual(["d", "c", "a", "b", "e"]);
  });
});

describe("Bugün: öğrenciye bağlı görev", () => {
  it("ödeme sözü görevi öğrenci adıyla, elle tamamlanır", () => {
    const [item] = labelFollowups(
      [
        {
          id: "t1",
          title: "Aziz Mirza Eryener: 30 Kasım ödeme sözü — ödeme geldi mi?",
          rule_key: "odeme_sozu:g1",
          due_at: null,
          due_date: "2026-11-30",
          lead: null,
          student: { id: "S9", full_name: "Aziz Mirza Eryener" },
        },
      ],
      NOW,
    );
    expect(item).toMatchObject({
      leadId: null,
      studentId: "S9",
      studentName: "Aziz Mirza Eryener",
      subtitle: "30 Kasım ödeme sözü — ödeme geldi mi?",
    });
    expect(followupAction("odeme_sozu:g1")).toEqual({ kind: "manual", canComplete: true });
  });
});

describe("WhatsApp: veli_gorusmesi", () => {
  it("ödeme grubuna gider", () => {
    expect(hedefFor("veli_gorusmesi")).toBe("finans");
    expect(chatIdFor("veli_gorusmesi", { groupId: "ana@g.us", finansGroupId: "odeme@g.us" })).toBe("odeme@g.us");
  });

  it("kiminle · sonuç, söz satırı ve kısaltılmış not", () => {
    const c = emptyContext();
    c.actors.set("u1", "Zehra Gürsel");
    const item: WaItem = {
      outboxId: "o1",
      eventType: "veli_gorusmesi",
      entityType: "student",
      entityId: "S9",
      actorId: "u1",
      createdAt: "2026-10-22T09:00:00.000Z",
      payload: {
        fullName: "Aziz Mirza Eryener",
        contactWith: "baba",
        outcome: "soz_verdi",
        contactedAt: "2026-10-22T09:00:00.000Z",
        promiseDate: "2026-11-30",
        promiseAmountTl: 55700,
        note: `Hastalık nedeniyle *zorluk* yaşıyor. ${"uzun ".repeat(100)}`,
      },
    };
    const [group] = groupItems([item], c);
    const text = formatGroup(group, c)!;
    const lines = text.split("\n");
    expect(lines.slice(0, 3)).toEqual([
      "*Aziz Mirza Eryener* · öğrenci",
      "📞 Veli görüşmesi: Baba · söz verdi",
      "Ödeme sözü: 30 Kasım 2026 · 55.700 ₺",
    ]);
    expect(lines[3]).toMatch(/^> Hastalık nedeniyle ∗zorluk∗ yaşıyor\./);
    expect(lines[3].endsWith("…")).toBe(true);
    expect(lines[3].length).toBeLessThan(320);
    expect(lines.at(-1)).toBe("— Zehra Gürsel");
  });
});
