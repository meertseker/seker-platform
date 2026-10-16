import { describe, it, expect } from "vitest";
import {
  buildPaymentMatrix,
  summarizeRows,
  type MatrixInstallmentInput,
  type MatrixPlanInput,
  type MatrixStudentInput,
} from "@/lib/payment-matrix";
import type { ItemType } from "@/lib/constants";

const SEASON = "2026-2027";
const TODAY = "2026-11-15";

let counter = 0;
function id() {
  counter += 1;
  return `id-${counter}`;
}

/** Bekleyen taksit; `amount` TL cinsinden (DB ile aynı birim). */
function bekliyor(dueDate: string, amount: number): MatrixInstallmentInput {
  return {
    id: id(),
    due_date: dueDate,
    amount,
    status: "bekliyor",
    paid_at: null,
    paid_amount: null,
    payment_method: null,
  };
}

function odendi(dueDate: string, amount: number, paidAmount = amount): MatrixInstallmentInput {
  return {
    id: id(),
    due_date: dueDate,
    amount,
    status: "odendi",
    paid_at: `${dueDate}T09:00:00+03:00`,
    paid_amount: paidAmount,
    payment_method: "havale",
  };
}

function iptal(dueDate: string, amount: number): MatrixInstallmentInput {
  return {
    id: id(),
    due_date: dueDate,
    amount,
    status: "iptal",
    paid_at: null,
    paid_amount: null,
    payment_method: null,
  };
}

function plan(
  itemType: ItemType,
  totalAmount: number,
  installmentCount: number,
  installments: MatrixInstallmentInput[],
  season = SEASON,
): MatrixPlanInput {
  return {
    id: id(),
    item_type: itemType,
    season,
    total_amount: totalAmount,
    installment_count: installmentCount,
    installments,
  };
}

function student(
  fullName: string,
  plans: MatrixPlanInput[],
  overrides: Partial<MatrixStudentInput> = {},
): MatrixStudentInput {
  return {
    id: id(),
    full_name: fullName,
    parent_name: "Veli",
    season: SEASON,
    status: "aktif",
    payment_plans: plans,
    ...overrides,
  };
}

function cellOf(matrix: ReturnType<typeof buildPaymentMatrix>, rowIndex: number, month: string) {
  return matrix.rows[rowIndex].cells[month];
}

describe("buildPaymentMatrix — ay sütunlarının türetilmesi", () => {
  it("taksit vadelerinden sıralı benzersiz aylar üretir", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 46000, 2, [bekliyor("2026-10-05", 23000), bekliyor("2026-09-05", 23000)]),
        ]),
        student("Berk", [plan("kitap", 8500, 1, [bekliyor("2026-09-05", 8500)])]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.months).toEqual(["2026-09", "2026-10"]);
  });

  it("taksiti olmayan aylar sütun açmaz", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 46000, 2, [bekliyor("2026-09-05", 23000), bekliyor("2026-12-05", 23000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.months).toEqual(["2026-09", "2026-12"]);
  });

  it("hiç taksit yoksa ay sütunu üretmez", () => {
    const matrix = buildPaymentMatrix([student("Ali", [])], TODAY, SEASON);

    expect(matrix.months).toEqual([]);
  });

  it("iptal taksit tek başına sütun açmaz", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 46000, 2, [bekliyor("2026-09-05", 23000), iptal("2026-10-05", 23000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.months).toEqual(["2026-09"]);
  });

  it("başka sezonun planını yok sayar", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 23000, 10, [bekliyor("2026-09-05", 23000)]),
          plan("aidat", 20000, 10, [bekliyor("2025-09-05", 20000)], "2025-2026"),
        ]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.months).toEqual(["2026-09"]);
    expect(matrix.rows[0].totalKurus).toBe(2300000);
  });
});

describe("buildPaymentMatrix — hücre durumları", () => {
  it("ayın tüm taksitleri ödendiyse 'odendi'", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 23000, 10, [odendi("2026-09-05", 23000)]),
          plan("diger", 8500, 1, [odendi("2026-09-05", 8500)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    const cell = cellOf(matrix, 0, "2026-09");
    expect(cell.state).toBe("odendi");
    expect(cell.totalKurus).toBe(3150000);
    expect(cell.paidKurus).toBe(3150000);
    expect(cell.overdue).toBe(false);
  });

  it("bir kalem ödenip diğeri beklerken 'kismi'", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 23000, 10, [odendi("2026-12-05", 23000)]),
          plan("diger", 8500, 1, [bekliyor("2026-12-05", 8500)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    const cell = cellOf(matrix, 0, "2026-12");
    expect(cell.state).toBe("kismi");
    expect(cell.totalKurus).toBe(3150000);
    expect(cell.paidKurus).toBe(2300000);
    expect(cell.overdue).toBe(false);
  });

  it("hiç ödenmemiş ve vadesi geçmişse 'gecikti'", () => {
    const matrix = buildPaymentMatrix(
      [student("Ali", [plan("aidat", 23000, 10, [bekliyor("2026-10-05", 23000)])])],
      TODAY,
      SEASON,
    );

    const cell = cellOf(matrix, 0, "2026-10");
    expect(cell.state).toBe("gecikti");
    expect(cell.overdue).toBe(true);
  });

  it("vadesi gelmemiş bekleyen taksit 'bekliyor'", () => {
    const matrix = buildPaymentMatrix(
      [student("Ali", [plan("aidat", 23000, 10, [bekliyor("2026-12-05", 23000)])])],
      TODAY,
      SEASON,
    );

    const cell = cellOf(matrix, 0, "2026-12");
    expect(cell.state).toBe("bekliyor");
    expect(cell.overdue).toBe(false);
  });

  it("vadesi bugün olan taksit henüz gecikmiş sayılmaz", () => {
    const matrix = buildPaymentMatrix(
      [student("Ali", [plan("aidat", 23000, 10, [bekliyor(TODAY, 23000)])])],
      TODAY,
      SEASON,
    );

    expect(cellOf(matrix, 0, "2026-11").state).toBe("bekliyor");
  });

  it("o ayda taksiti olmayan öğrencinin hücresi 'bos'", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [plan("aidat", 23000, 10, [bekliyor("2026-09-05", 23000)])]),
        student("Berk", [plan("aidat", 23000, 10, [bekliyor("2026-10-05", 23000)])]),
      ],
      TODAY,
      SEASON,
    );

    expect(cellOf(matrix, 0, "2026-10").state).toBe("bos");
    expect(cellOf(matrix, 0, "2026-10").totalKurus).toBe(0);
  });

  it("her satırda her ay için hücre üretir", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [plan("aidat", 23000, 10, [bekliyor("2026-09-05", 23000)])]),
        student("Berk", []),
      ],
      TODAY,
      SEASON,
    );

    expect(Object.keys(matrix.rows[0].cells)).toEqual(matrix.months);
    expect(Object.keys(matrix.rows[1].cells)).toEqual(matrix.months);
  });

  it("ödenmiş kalem varken başka kalem gecikmişse 'kismi' kalır ama overdue işaretlenir", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 23000, 10, [odendi("2026-10-05", 23000)]),
          plan("diger", 8500, 1, [bekliyor("2026-10-05", 8500)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    const cell = cellOf(matrix, 0, "2026-10");
    expect(cell.state).toBe("kismi");
    expect(cell.overdue).toBe(true);
  });

  it("kısmi ödemede bölünen taksit çifti tek hücrede 'kismi' verir", () => {
    // markInstallmentPaid kısmi tahsilatta taksiti ödenen tutara indirip
    // aynı vadeye yeni bir bekleyen taksit ekliyor.
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 23000, 10, [odendi("2026-12-05", 10000), bekliyor("2026-12-05", 13000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    const cell = cellOf(matrix, 0, "2026-12");
    expect(cell.state).toBe("kismi");
    expect(cell.totalKurus).toBe(2300000);
    expect(cell.paidKurus).toBe(1000000);
  });

  it("tek taksit eksik ödendiyse (paid_amount < amount) 'kismi'", () => {
    const matrix = buildPaymentMatrix(
      [student("Ali", [plan("aidat", 230000, 10, [odendi("2026-09-05", 4000, 3000)])])],
      TODAY,
      SEASON,
    );

    expect(cellOf(matrix, 0, "2026-09").state).toBe("kismi");
    expect(cellOf(matrix, 0, "2026-09").paidKurus).toBe(300000);
  });

  it("paid_amount boşsa ödenen tutar amount'a düşer", () => {
    const eksik: MatrixInstallmentInput = { ...odendi("2026-09-05", 23000), paid_amount: null };
    const matrix = buildPaymentMatrix(
      [student("Ali", [plan("aidat", 23000, 10, [eksik])])],
      TODAY,
      SEASON,
    );

    expect(cellOf(matrix, 0, "2026-09").paidKurus).toBe(2300000);
  });

  it("hücre kalemlerini vadeye göre sıralı listeler", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("diger", 8500, 1, [bekliyor("2026-09-20", 8500)]),
          plan("aidat", 23000, 10, [bekliyor("2026-09-05", 23000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    expect(cellOf(matrix, 0, "2026-09").items.map((item) => item.itemType)).toEqual([
      "aidat",
      "diger",
    ]);
  });
});

describe("buildPaymentMatrix — iptal taksitler", () => {
  it("iptal taksit toplamlara girmez, sayaçta görünür", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 46000, 2, [bekliyor("2026-12-05", 23000), iptal("2026-12-05", 23000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    const cell = cellOf(matrix, 0, "2026-12");
    expect(cell.totalKurus).toBe(2300000);
    expect(cell.cancelledCount).toBe(1);
    expect(cell.items).toHaveLength(1);
  });

  it("ayın tek taksiti iptalse hücre 'bos'", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 46000, 2, [bekliyor("2026-09-05", 23000), iptal("2026-12-05", 23000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.months).toEqual(["2026-09"]);
    expect(matrix.rows[0].totalKurus).toBe(2300000);
  });
});

describe("buildPaymentMatrix — Excel yan sütunları", () => {
  it("kitap kendi hücresindedir, ay sütununa girmez", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 230000, 10, [odendi("2026-09-05", 23000)]),
          plan("kitap", 45000, 3, [
            odendi("2026-09-05", 15000),
            bekliyor("2026-10-05", 15000),
            bekliyor("2026-11-05", 15000),
          ]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    const row = matrix.rows[0];
    expect(matrix.months).toEqual(["2026-09"]);
    expect(row.cells["2026-09"].totalKurus).toBe(2300000);
    expect(row.kitapCell?.state).toBe("kismi");
    expect(row.kitapCell?.totalKurus).toBe(4500000);
    expect(row.kitapCell?.paidKurus).toBe(1500000);
    expect(row.kitapCell?.items).toHaveLength(3);
  });

  it("tek taksitli aidat yıllık peşindir: AİDAT TUTARI sütununa gider", () => {
    const matrix = buildPaymentMatrix(
      [student("Ali", [plan("aidat", 250000, 1, [bekliyor("2026-09-05", 250000)])])],
      TODAY,
      SEASON,
    );

    expect(matrix.months).toEqual([]);
    expect(matrix.rows[0].aidatCell?.totalKurus).toBe(25000000);
    expect(matrix.rows[0].aidatCell?.state).toBe("gecikti");
  });

  it("peşin aidat kısmi ödemede bölünse de aynı hücrede kalır", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 250000, 1, [odendi("2026-09-05", 100000), bekliyor("2026-09-05", 150000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.rows[0].aidatCell?.state).toBe("kismi");
    expect(matrix.rows[0].aidatCell?.paidKurus).toBe(10000000);
  });

  it("servis kendi hücresindedir", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("servis", 12000, 2, [bekliyor("2026-12-05", 6000), bekliyor("2027-01-05", 6000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.months).toEqual([]);
    expect(matrix.rows[0].servisCell?.totalKurus).toBe(1200000);
    expect(matrix.rows[0].servisCell?.state).toBe("bekliyor");
  });

  it("ilgili plan yoksa yan hücre null", () => {
    const matrix = buildPaymentMatrix(
      [student("Ali", [plan("aidat", 230000, 10, [bekliyor("2026-09-05", 23000)])])],
      TODAY,
      SEASON,
    );

    expect(matrix.rows[0].kitapCell).toBeNull();
    expect(matrix.rows[0].aidatCell).toBeNull();
    expect(matrix.rows[0].servisCell).toBeNull();
  });

  it("satır toplamı yan sütunları da içerir", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 230000, 10, [odendi("2026-09-05", 23000)]),
          plan("kitap", 50000, 1, [bekliyor("2026-09-05", 50000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.rows[0].totalKurus).toBe(7300000);
    expect(matrix.rows[0].paidKurus).toBe(2300000);
    expect(matrix.sideTotals.kitap).toEqual({ monthKey: "kitap", expectedKurus: 5000000, paidKurus: 0 });
  });

  it("tamamı nakit ödenen hücre mor (cash) işaretlenir", () => {
    const nakit = { ...odendi("2026-09-05", 23000), payment_method: "nakit" as const };
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [plan("aidat", 230000, 10, [nakit, odendi("2026-10-05", 23000)])]),
      ],
      TODAY,
      SEASON,
    );

    expect(cellOf(matrix, 0, "2026-09").cash).toBe(true);
    expect(cellOf(matrix, 0, "2026-10").cash).toBe(false);
  });
});

describe("buildPaymentMatrix — satırlar", () => {
  it("Excel'deki gibi deftere eklenme sırasıyla dizer", () => {
    const withPlan = (name: string, createdAt: string) =>
      student(name, [plan("aidat", 230000, 10, [bekliyor("2026-09-05", 23000)])], {
        created_at: createdAt,
      });

    const matrix = buildPaymentMatrix(
      [
        withPlan("Zeynep", "2026-09-12T10:00:01Z"),
        withPlan("Çınar", "2026-10-16T13:00:00Z"),
        student("Ahmet", [], { created_at: "2026-09-12T10:00:03Z" }),
        withPlan("İpek", "2026-09-12T10:00:02Z"),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.rows.map((row) => row.fullName)).toEqual(["Zeynep", "İpek", "Ahmet", "Çınar"]);
  });

  it("planı olmayan satırı işaretler", () => {
    const matrix = buildPaymentMatrix([student("Ahmet", [])], TODAY, SEASON);

    expect(matrix.rows[0].hasPlan).toBe(false);
    expect(matrix.rows[0].totalKurus).toBe(0);
  });

  it("başka sezonun planı olan öğrenci bu sezonda plansız sayılır", () => {
    const matrix = buildPaymentMatrix(
      [student("Ahmet", [plan("aidat", 20000, 10, [bekliyor("2025-09-05", 20000)], "2025-2026")])],
      TODAY,
      SEASON,
    );

    expect(matrix.rows[0].hasPlan).toBe(false);
  });

  it("satırda geciken taksit varsa hasOverdue işaretlenir", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 46000, 2, [bekliyor("2026-10-05", 23000), bekliyor("2026-12-05", 23000)]),
        ]),
        student("Berk", [plan("aidat", 23000, 10, [bekliyor("2026-12-05", 23000)])]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.rows[0].hasOverdue).toBe(true);
    expect(matrix.rows[1].hasOverdue).toBe(false);
  });

  it("satır toplamı, ödeneni ve kalanı hesaplar", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 46000, 2, [odendi("2026-09-05", 23000), bekliyor("2026-10-05", 23000)]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    const row = matrix.rows[0];
    expect(row.totalKurus).toBe(4600000);
    expect(row.paidKurus).toBe(2300000);
    expect(row.remainingKurus).toBe(2300000);
  });
});

describe("buildPaymentMatrix — toplamlar", () => {
  it("ay sütunu başına beklenen ve tahsil edileni toplar", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [plan("aidat", 46000, 2, [odendi("2026-09-05", 23000), bekliyor("2026-10-05", 23000)])]),
        student("Berk", [plan("aidat", 40000, 2, [bekliyor("2026-09-05", 20000), bekliyor("2026-10-05", 20000)])]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.columnTotals).toEqual([
      { monthKey: "2026-09", expectedKurus: 4300000, paidKurus: 2300000 },
      { monthKey: "2026-10", expectedKurus: 4300000, paidKurus: 0 },
    ]);
  });

  it("genel toplam satır toplamlarıyla tutarlıdır", () => {
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [plan("aidat", 46000, 2, [odendi("2026-09-05", 23000), bekliyor("2026-10-05", 23000)])]),
        student("Berk", [plan("kitap", 8500, 1, [bekliyor("2026-09-05", 8500)])]),
      ],
      TODAY,
      SEASON,
    );

    const rowTotal = matrix.rows.reduce((sum, row) => sum + row.totalKurus, 0);
    const columnTotal =
      matrix.columnTotals.reduce((sum, col) => sum + col.expectedKurus, 0) +
      Object.values(matrix.sideTotals).reduce((sum, col) => sum + col.expectedKurus, 0);

    expect(matrix.grandTotal.totalKurus).toBe(rowTotal);
    expect(matrix.grandTotal.totalKurus).toBe(columnTotal);
    expect(matrix.grandTotal.paidKurus).toBe(2300000);
    expect(matrix.grandTotal.remainingKurus).toBe(rowTotal - 2300000);
  });

  it("summarizeRows, satır süzüldükten sonra toplamları görünen satırlara göre yeniden hesaplar", () => {
    // Sayfa, filtre çipleriyle satır süzüyor; alt toplam ekranda görünenle tutmalı.
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [plan("aidat", 23000, 10, [bekliyor("2026-10-05", 23000)])]),
        student("Berk", [plan("aidat", 20000, 10, [bekliyor("2026-12-05", 20000)])]),
      ],
      TODAY,
      SEASON,
    );

    const gecikenler = matrix.rows.filter((row) => row.hasOverdue);
    const summary = summarizeRows(matrix.months, gecikenler);

    expect(summary.columnTotals).toEqual([
      { monthKey: "2026-10", expectedKurus: 2300000, paidKurus: 0 },
      { monthKey: "2026-12", expectedKurus: 0, paidKurus: 0 },
    ]);
    expect(summary.grandTotal).toEqual({
      totalKurus: 2300000,
      paidKurus: 0,
      remainingKurus: 2300000,
    });
  });

  it("kalanlı bölmelerde kuruş kaybı yaşamaz", () => {
    // 25.000 TL / 3 taksit: 8333,33 + 8333,33 + 8333,34
    const matrix = buildPaymentMatrix(
      [
        student("Ali", [
          plan("aidat", 25000, 3, [
            bekliyor("2026-09-05", 8333.33),
            bekliyor("2026-10-05", 8333.33),
            bekliyor("2026-11-05", 8333.34),
          ]),
        ]),
      ],
      TODAY,
      SEASON,
    );

    expect(matrix.rows[0].totalKurus).toBe(2500000);
  });
});
