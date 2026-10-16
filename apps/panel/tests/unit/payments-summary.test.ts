import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildPaymentMatrix,
  type MatrixInstallmentInput,
  type MatrixPlanInput,
  type MatrixStudentInput,
} from "@/lib/payment-matrix";
import {
  dueThisMonthKurusOf,
  hasUnpaidThisMonth,
  overdueKurusOf,
  seasonSummaryOf,
} from "@/lib/payments-summary";
import { filterRows, resolveScope, seasonsOf, studentsInScope, type PaymentStudent } from "@/lib/payments-scope";
import { buildPaymentsWorkbook, cellStatusText, excelMonthLabel } from "@/lib/payments-excel";
import type { ItemType } from "@/lib/constants";

const SEASON = "2026-2027";
const TODAY = "2026-11-15";
const MONTH = "2026-11";

let n = 0;
const nid = () => `id-${++n}`;

function inst(due: string, amount: number, status: "bekliyor" | "odendi" | "iptal" = "bekliyor", paid?: number): MatrixInstallmentInput {
  return {
    id: nid(),
    due_date: due,
    amount,
    status,
    paid_at: status === "odendi" ? `${due}T09:00:00+03:00` : null,
    paid_amount: status === "odendi" ? (paid ?? amount) : null,
    payment_method: status === "odendi" ? "nakit" : null,
  };
}

function plan(item: ItemType, installments: MatrixInstallmentInput[]): MatrixPlanInput {
  return {
    id: nid(),
    item_type: item,
    season: SEASON,
    total_amount: installments.reduce((s, i) => s + i.amount, 0),
    installment_count: installments.length,
    installments,
  };
}

function student(name: string, plans: MatrixPlanInput[], extra: Partial<PaymentStudent> = {}): PaymentStudent {
  return {
    id: nid(),
    full_name: name,
    parent_name: `${name} Veli`,
    season: SEASON,
    status: "aktif",
    created_at: `2026-09-0${(n % 9) + 1}`,
    phone: "05301112233",
    payment_plans: plans,
    ...extra,
  } as PaymentStudent & MatrixStudentInput;
}

// Ali: ekim ve kasım (5'i, bugün 15'i) aidatı gecikmiş; kitap taksiti (yan sütun) ekimde gecikmiş.
const ali = student("Ali", [
  plan("aidat", [inst("2026-10-05", 4000), inst("2026-11-05", 4000), inst("2026-12-05", 4000)]),
  plan("kitap", [inst("2026-10-10", 1500)]),
]);
// Ayşe: her şey ödenmiş; kasım kısmi (3000/4000).
const ayse = student("Ayşe", [
  plan("aidat", [inst("2026-10-05", 4000, "odendi"), inst("2026-11-05", 4000, "odendi", 3000), inst("2026-12-05", 4000)]),
]);
// Can: planı yok.
const can = student("Can", []);

const matrix = buildPaymentMatrix([ali, ayse, can], TODAY, SEASON);
const row = (name: string) => matrix.rows.find((r) => r.fullName === name)!;

describe("payments-summary", () => {
  it("geciken tutar yan sütunları (kitap) da kapsar", () => {
    // Ali: ekim 4000 + kasım 4000 aidat + kitap 1500 gecikmiş
    expect(overdueKurusOf(matrix.rows)).toBe(950000);
  });

  it("bu ay vadesi gelen ödenmemiş tutar: bekleyen + kısmi kalan", () => {
    // Ali kasım 4000 bekliyor + Ayşe kasım 1000 kalan
    expect(dueThisMonthKurusOf(matrix.rows, MONTH)).toBe(500000);
  });

  it("bu ay ödemeyenler: Ali (bekliyor) ve Ayşe (kısmi); planı olmayan Can değil", () => {
    expect(hasUnpaidThisMonth(row("Ali"), MONTH)).toBe(true);
    expect(hasUnpaidThisMonth(row("Ayşe"), MONTH)).toBe(true);
    expect(hasUnpaidThisMonth(row("Can"), MONTH)).toBe(false);
  });

  it("sezon özeti: toplam, tahsil, kalan, oran, öğrenci sayıları", () => {
    const s = seasonSummaryOf(matrix.rows);
    expect(s.totalKurus).toBe(2550000); // 12000 + 1500 + 12000
    expect(s.paidKurus).toBe(700000); // 4000 + 3000
    expect(s.remainingKurus).toBe(1850000);
    expect(s.overdueKurus).toBe(950000);
    expect(s.collectionRate).toBeCloseTo(7000 / 25500);
    expect(s.studentCount).toBe(2);
    expect(s.overdueStudentCount).toBe(1);
  });

  it("boş listede oran yok", () => {
    expect(seasonSummaryOf([]).collectionRate).toBeNull();
  });
});

describe("payments-scope", () => {
  it("sezonlar yeniden eskiye; geçersiz filtre/sezon varsayılana düşer", () => {
    const old = student("Eski", [], { season: "2025-2026" });
    expect(seasonsOf([ali, old])).toEqual(["2026-2027", "2025-2026"]);
    expect(resolveScope({ sezon: "1999", filtre: "hack" }, ["2026-2027"])).toEqual({
      season: "2026-2027", query: "", filter: "tumu", includePast: false,
    });
  });

  it("arama aksansız, ayrılanlar varsayılan olarak hariç", () => {
    const gone = student("Zeynep", [], { status: "ayrildi" });
    const scope = resolveScope({ q: "ayse" }, [SEASON]);
    expect(studentsInScope([ali, ayse, gone], scope).map((s) => s.full_name)).toEqual(["Ayşe"]);
    expect(studentsInScope([ali, gone], resolveScope({ gecmis: "1" }, [SEASON]))).toHaveLength(2);
  });

  it("filtreler", () => {
    const names = (f: "bu_ay" | "geciken" | "plansiz") => filterRows(matrix.rows, f, MONTH).map((r) => r.fullName).sort();
    expect(names("bu_ay")).toEqual(["Ali", "Ayşe"]);
    expect(names("geciken")).toEqual(["Ali"]);
    expect(names("plansiz")).toEqual(["Can"]);
  });
});

describe("payments-excel", () => {
  it("defter düzeninde üç sayfa üretir; tutarlar TL, durum metinle", () => {
    const book = buildPaymentsWorkbook({
      season: SEASON,
      months: matrix.months,
      rows: matrix.rows,
      phoneById: new Map([[row("Ali").studentId, "05301112233"]]),
      generatedOn: TODAY,
      filterLabel: "Tümü",
    });
    expect(book.SheetNames).toEqual(["Tutarlar", "Durum", "Gecikenler"]);

    const read = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
    const amounts = XLSX.utils.sheet_to_json<unknown[]>(read.Sheets.Tutarlar, { header: 1 });
    const header = amounts[2] as string[];
    expect(header.slice(0, 6)).toEqual(["SIRA", "ÖĞRENCİ", "ANNE & BABA", "KİTAP - KIRTASİYE", "AİDAT TUTARI", "SERVİS TUTARI"]);
    expect(header).toContain("EKİM 2026");
    expect(header.slice(-3)).toEqual(["TOPLAM", "ÖDENEN", "KALAN"]);
    const aliRow = amounts.find((r) => (r as unknown[])[1] === "Ali") as unknown[];
    expect(aliRow[3]).toBe(1500);
    expect(aliRow.slice(-3)).toEqual([13500, 0, 13500]);
    const total = amounts[amounts.length - 1] as unknown[];
    expect(total.slice(-3)).toEqual([25500, 7000, 18500]);

    const status = XLSX.utils.sheet_to_json<unknown[]>(read.Sheets.Durum, { header: 1 });
    const ayseStatus = status.find((r) => (r as unknown[])[1] === "Ayşe") as unknown[];
    expect(ayseStatus).toContain("Nakit ödendi");
    expect(ayseStatus).toContain("Kısmi (3.000 / 4.000)");

    const late = XLSX.utils.sheet_to_json<unknown[]>(read.Sheets.Gecikenler, { header: 1 });
    expect(late[3]).toEqual(["Ali", "Ali Veli", "05301112233", 9500]);
  });

  it("ay başlığı ve boş hücre", () => {
    expect(excelMonthLabel("2026-09")).toBe("EYLÜL 2026");
    expect(cellStatusText(null)).toBe("");
  });
});
