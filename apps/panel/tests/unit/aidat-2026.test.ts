import { describe, it, expect } from "vitest";
import {
  CSV_HEADER,
  type Cell,
  buildStudentDraft,
  draftFromCsvRow,
  draftToCsvRow,
  expandMonthlyAmounts,
  guessProgram,
  parseAmount,
} from "@/scripts/seed/lib/aidat-2026";
import { csvToObjects, toCsv } from "@/scripts/seed/lib/csv";

/** "2026 - 2027" sayfasının kolon düzenine uygun satır kurar. `months`: TEMMUZ…HAZİRAN. */
function sheetRow(o: {
  name: string;
  parents?: Cell;
  kitap?: Cell;
  annual?: Cell;
  servis?: Cell;
  months?: Cell[];
}): Cell[] {
  const row: Cell[] = Array.from({ length: 18 }, () => null);
  row[0] = o.name;
  row[1] = o.parents ?? null;
  row[2] = o.kitap ?? null;
  row[3] = o.annual ?? null;
  row[5] = o.servis ?? null;
  (o.months ?? []).forEach((v, i) => {
    row[6 + i] = v;
  });
  return row;
}

const m = (...eylulOnward: Cell[]): Cell[] => [null, null, ...eylulOnward];

describe("parseAmount", () => {
  it("sayı ve binlik noktalı metni okur", () => {
    expect(parseAmount(45000)).toBe(45000);
    expect(parseAmount("23.000")).toBe(23000);
  });
  it("açık sıfırı korur", () => {
    expect(parseAmount(0)).toBe(0);
  });
  it("boş ve sayısal olmayan hücreleri null döner", () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("?")).toBeNull();
    expect(parseAmount("ÜCRETSİZ")).toBeNull();
    expect(parseAmount("ÜCRET ALINMADI")).toBeNull();
    expect(parseAmount("23.000 Y - 28.000 TAM")).toBeNull();
  });
});

describe("expandMonthlyAmounts", () => {
  it("boş bırakılan OCAK–HAZİRAN için ARALIK tutarını taşır", () => {
    expect(expandMonthlyAmounts(m(26000, 26000, 26000, 26000))).toEqual(Array(10).fill(26000));
  });
  it("aylar arası değişimi korur, son dolu ayı sürdürür", () => {
    // ÖMER GÜNEŞ: Eylül/Ekim 23.000, Kasım/Aralık 28.000
    expect(expandMonthlyAmounts(m(23000, 23000, 28000, 28000))).toEqual([
      23000, 23000, 28000, 28000, 28000, 28000, 28000, 28000, 28000, 28000,
    ]);
  });
  it("TEMMUZ/AĞUSTOS hücrelerini plana almaz", () => {
    const cells: Cell[] = [45500, 45360, 23000, 23000, 28000, 28000];
    expect(expandMonthlyAmounts(cells)[0]).toBe(23000);
  });
  it("hiç dolu ay yoksa tamamı null", () => {
    expect(expandMonthlyAmounts(m("?", "?", "?", "?"))).toEqual(Array(10).fill(null));
  });
});

describe("guessProgram", () => {
  it("eşik ve üstü tam gün, altı yarım gün", () => {
    expect(guessProgram(25000)).toBe("tam_gun");
    expect(guessProgram(23000)).toBe("yarim_gun");
  });
  it("tutar yoksa null", () => {
    expect(guessProgram(null)).toBeNull();
    expect(guessProgram(0)).toBeNull();
  });
});

describe("buildStudentDraft — aylık öğrenci", () => {
  const draft = buildStudentDraft(
    sheetRow({
      name: "YAĞIZ AHMET AKYILDIZ",
      parents: "ESRA & FATİH",
      kitap: 43000,
      months: m(26000, 26000, 26000, 26000),
    }),
    10,
  )!;

  it("10 taksitli aidat planı kurar, toplam taksitlerin toplamına eşittir", () => {
    const aidat = draft.plans.find((p) => p.itemType === "aidat")!;
    expect(aidat.installmentCount).toBe(10);
    expect(aidat.totalTl).toBe(260000);
    expect(aidat.installments.reduce((s, i) => s + i.amountTl, 0)).toBe(aidat.totalTl);
  });
  it("vadeleri Eylül'den Haziran'a aylık ilerletir", () => {
    const aidat = draft.plans.find((p) => p.itemType === "aidat")!;
    expect(aidat.installments[0].dueDate).toBe("2026-09-05");
    expect(aidat.installments.at(-1)!.dueDate).toBe("2027-06-05");
  });
  it("yalnız Eylül taksitini ödenmiş işaretler", () => {
    const aidat = draft.plans.find((p) => p.itemType === "aidat")!;
    expect(aidat.installments.filter((i) => i.paid)).toHaveLength(1);
    expect(aidat.installments[0].paid).toBe(true);
  });
  it("kitap planını tek taksit, Eylül vadeli, bekliyor kurar", () => {
    const kitap = draft.plans.find((p) => p.itemType === "kitap")!;
    expect(kitap.installments).toEqual([{ dueDate: "2026-09-05", amountTl: 43000, paid: false }]);
  });
  it("programı Aralık tutarından tahmin eder", () => {
    expect(draft.guessedProgram).toBe("tam_gun");
  });
});

describe("buildStudentDraft — prorate edilmiş Eylül", () => {
  it("Eylül'ün düşük tutarını korur ve ödenmiş sayar", () => {
    // DEFNE KARAKUŞ: Eylül 10.500 (yarım ay), sonrası 21.000
    const draft = buildStudentDraft(
      sheetRow({ name: "DEFNE KARAKUŞ", kitap: 45000, months: m(10500, 21000, 21000, 21000) }),
      22,
    )!;
    const aidat = draft.plans.find((p) => p.itemType === "aidat")!;
    expect(aidat.installmentCount).toBe(10);
    expect(aidat.totalTl).toBe(10500 + 21000 * 9);
    expect(aidat.installments[0]).toEqual({ dueDate: "2026-09-05", amountTl: 10500, paid: true });
    expect(draft.guessedProgram).toBe("yarim_gun");
  });

  it("Eylül 0 ise o ay için taksit üretmez ve hiçbir taksit ödenmiş olmaz", () => {
    // KIVANÇ GÖK: Eylül ücretsiz
    const draft = buildStudentDraft(
      sheetRow({ name: "KIVANÇ GÖK", kitap: 35000, months: m(0, 22000, 22000, 22000) }),
      55,
    )!;
    const aidat = draft.plans.find((p) => p.itemType === "aidat")!;
    expect(aidat.installmentCount).toBe(9);
    expect(aidat.totalTl).toBe(22000 * 9);
    expect(aidat.installments[0].dueDate).toBe("2026-10-05");
    expect(aidat.installments.some((i) => i.paid)).toBe(false);
    expect(draft.notes.join(" ")).toContain("Eylül");
  });
});

describe("buildStudentDraft — yıllık peşin öğrenci", () => {
  const draft = buildStudentDraft(
    sheetRow({ name: "ÖVÜNÇ SOYLUER", parents: "GÖKÇEN & HAKAN", kitap: 45000, annual: 250000 }),
    2,
  )!;

  it("tek taksitli, bekliyor durumunda aidat planı kurar", () => {
    const aidat = draft.plans.find((p) => p.itemType === "aidat")!;
    expect(draft.mode).toBe("yillik");
    expect(aidat.installments).toEqual([{ dueDate: "2026-09-05", amountTl: 250000, paid: false }]);
  });
  it("programı yıllık/10 tutarından tahmin eder", () => {
    expect(draft.referenceMonthlyTl).toBe(25000);
    expect(draft.guessedProgram).toBe("tam_gun");
  });
  it("aylık tutar kolonlarını boş bırakır", () => {
    expect(draft.monthlyAmounts).toEqual(Array(10).fill(null));
  });
});

describe("buildStudentDraft — karma ve okunamayan satırlar", () => {
  it("aidat hücresi metinken aylık defteri kullanır ve ham metni nota alır", () => {
    const draft = buildStudentDraft(
      sheetRow({
        name: "ÖMER GÜNEŞ",
        kitap: 45000,
        annual: "23.000 Y - 28.000 TAM",
        months: [45500, 45360, 23000, 23000, 28000, 28000],
      }),
      16,
    )!;
    const aidat = draft.plans.find((p) => p.itemType === "aidat")!;
    expect(draft.mode).toBe("aylik");
    expect(aidat.totalTl).toBe(23000 * 2 + 28000 * 8);
    expect(draft.notes.join(" ")).toContain("23.000 Y - 28.000 TAM");
  });

  it("kitap hücresi '?' ise kitap planı kurmaz, aidatı kurar", () => {
    const draft = buildStudentDraft(
      sheetRow({ name: "ELA NAZ GÜRSEL", kitap: "?", months: m(9000, 9000, 9000, 9000) }),
      34,
    )!;
    expect(draft.plans.map((p) => p.itemType)).toEqual(["aidat"]);
    expect(draft.notes.join(" ")).toContain("kitap hücresi: ?");
  });

  it("tüm tutarlar okunamazsa hiç plan kurmaz ama öğrenciyi korur", () => {
    const draft = buildStudentDraft(
      sheetRow({ name: "BADE PAKEL", kitap: "?", months: m("?", "?", "?", "?") }),
      48,
    )!;
    expect(draft.mode).toBe("yok");
    expect(draft.plans).toEqual([]);
    expect(draft.guessedProgram).toBeNull();
  });

  it("isim boşsa satırı atlar", () => {
    expect(buildStudentDraft(sheetRow({ name: "   ", kitap: 1000 }), 99)).toBeNull();
  });

  it("servis hücresi doluysa uyarı notu bırakır", () => {
    const draft = buildStudentDraft(
      sheetRow({ name: "TEST", servis: 5100, months: m(20000) }),
      7,
    )!;
    expect(draft.notes.join(" ")).toContain("servis");
  });
});

describe("CSV gidiş-dönüşü", () => {
  /** Taslakları CSV'ye yazıp geri okur — yükleme kaynağı CSV olduğu için plan aynı kalmalı. */
  function roundTrip(drafts: ReturnType<typeof buildStudentDraft>[]) {
    const present = drafts.filter((d): d is NonNullable<typeof d> => d !== null);
    const csv = toCsv(CSV_HEADER, present.map(draftToCsvRow));
    return csvToObjects(csv).map((o, i) => draftFromCsvRow(o, i + 2)!);
  }

  const originals = [
    buildStudentDraft(sheetRow({ name: "YAĞIZ AHMET AKYILDIZ", parents: "ESRA & FATİH", kitap: 43000, months: m(26000, 26000, 26000, 26000) }), 10),
    buildStudentDraft(sheetRow({ name: "DEFNE KARAKUŞ", kitap: 45000, months: m(10500, 21000, 21000, 21000) }), 22),
    buildStudentDraft(sheetRow({ name: "KIVANÇ GÖK", kitap: 35000, months: m(0, 22000, 22000, 22000) }), 55),
    buildStudentDraft(sheetRow({ name: "ÖVÜNÇ SOYLUER", parents: "GÖKÇEN & HAKAN", kitap: 45000, annual: 250000 }), 2),
    buildStudentDraft(sheetRow({ name: "BADE PAKEL", kitap: "?", months: m("?", "?", "?", "?") }), 48),
  ];

  it("planları, tutarları ve ödenmiş taksitleri birebir korur", () => {
    const restored = roundTrip(originals);
    expect(restored).toHaveLength(originals.length);
    originals.forEach((original, i) => {
      expect(restored[i].plans).toEqual(original!.plans);
      expect(restored[i].mode).toBe(original!.mode);
      expect(restored[i].fullName).toBe(original!.fullName);
      expect(restored[i].parentName).toBe(original!.parentName);
      expect(restored[i].guessedProgram).toBe(original!.guessedProgram);
      expect(restored[i].sourceRow).toBe(original!.sourceRow);
    });
  });

  it("insan CSV'de bir ay tutarını düzeltirse plan buna göre kurulur", () => {
    const csv = toCsv(CSV_HEADER, [draftToCsvRow(originals[0]!)]);
    const edited = csvToObjects(csv).map((o) => ({ ...o, haziran: "30000" }));
    const plan = draftFromCsvRow(edited[0], 2)!.plans.find((p) => p.itemType === "aidat")!;
    expect(plan.installments.at(-1)!.amountTl).toBe(30000);
    expect(plan.totalTl).toBe(26000 * 9 + 30000);
  });

  it("geçersiz program değerini null'a düşürür", () => {
    const csv = toCsv(CSV_HEADER, [draftToCsvRow(originals[0]!)]);
    const edited = csvToObjects(csv).map((o) => ({ ...o, program_guess: "haftasonu" }));
    expect(draftFromCsvRow(edited[0], 2)!.guessedProgram).toBeNull();
  });

  it("isim boşsa null döner", () => {
    expect(draftFromCsvRow({ full_name: "  " }, 2)).toBeNull();
  });
});
