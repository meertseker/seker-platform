import { describe, it, expect } from "vitest";
import type { MatrixInstallmentInput, MatrixPlanInput, MatrixStudentInput } from "@/lib/payment-matrix";
import {
  columnKeyForInstallment,
  defaultPanelKey,
  pendingColumns,
  studentPanelColumns,
} from "@/lib/student-payment-panel";

/**
 * Öğrenci sayfasındaki bütün ödeme girişleri (Durum kartı "Ödeme al", taksit satırları,
 * aidat satırı hücreleri) Ödemeler ekranındaki hücre panelini açar. Hangi ayın açılacağı
 * buradaki saf seçimle belirlenir.
 */
const TODAY = "2026-10-21";
let n = 0;
function inst(due_date: string, amount: number, status: MatrixInstallmentInput["status"] = "bekliyor"): MatrixInstallmentInput {
  n += 1;
  return {
    id: `i${n}`,
    due_date,
    amount,
    status,
    paid_at: status === "odendi" ? `${due_date}T09:00:00Z` : null,
    paid_amount: status === "odendi" ? amount : null,
    payment_method: status === "odendi" ? "nakit" : null,
  };
}
function plan(item_type: MatrixPlanInput["item_type"], season: string, installments: MatrixInstallmentInput[]): MatrixPlanInput {
  n += 1;
  return {
    id: `p${n}`,
    item_type,
    season,
    total_amount: installments.reduce((s, i) => s + i.amount, 0),
    installment_count: installments.length,
    installments,
  };
}
function student(plans: MatrixPlanInput[]): MatrixStudentInput {
  return { id: "S1", full_name: "Elif Demir", parent_name: null, season: "2026-2027", status: "aktif", payment_plans: plans };
}

describe("öğrenci sayfası ödeme paneli", () => {
  it("\"Ödeme al\" en eski bekleyen/geciken taksitin ayını açar", () => {
    const eylul = inst("2026-09-05", 19000, "odendi");
    const ekim = inst("2026-10-05", 19000);
    const kasim = inst("2026-11-05", 19000);
    const columns = studentPanelColumns(student([plan("aidat", "2026-2027", [eylul, kasim, ekim])]), TODAY);
    expect(defaultPanelKey(columns)).toBe("2026-10");
    const ekimColumn = columns.find((c) => c.key === "2026-10")!;
    expect(ekimColumn.label).toBe("Ekim 2026");
    expect(ekimColumn.cell.items.map((i) => i.installmentId)).toEqual([ekim.id]);
  });

  it("geciken kitap taksiti aidattan eskiyse kitap sütunu açılır", () => {
    const kitap = inst("2026-09-15", 3000);
    const aidat = inst("2026-10-05", 19000);
    const columns = studentPanelColumns(
      student([plan("aidat", "2026-2027", [aidat, inst("2026-11-05", 19000)]), plan("kitap", "2026-2027", [kitap])]),
      TODAY,
    );
    expect(defaultPanelKey(columns)).toBe("kitap");
    expect(columns.find((c) => c.key === "kitap")!.label).toBe("Kitap - Kırtasiye");
  });

  it("bekleyen yoksa panel açılmaz", () => {
    const columns = studentPanelColumns(
      student([plan("aidat", "2026-2027", [inst("2026-09-05", 19000, "odendi"), inst("2026-10-05", 19000, "odendi")])]),
      TODAY,
    );
    expect(defaultPanelKey(columns)).toBeNull();
    expect(pendingColumns(columns)).toEqual([]);
  });

  it("taksit satırı kendi ayının panelini açar; önceki sezonun taksiti de bulunur", () => {
    const eski = inst("2026-05-05", 17000);
    const ekim = inst("2026-10-05", 19000);
    const columns = studentPanelColumns(
      student([plan("aidat", "2026-2027", [ekim, inst("2026-11-05", 19000)]), plan("aidat", "2025-2026", [inst("2026-04-05", 17000), eski])]),
      TODAY,
    );
    expect(columnKeyForInstallment(columns, ekim.id)).toBe("2026-10");
    const eskiKey = columnKeyForInstallment(columns, eski.id)!;
    expect(eskiKey).toBe("2025-2026:2026-05");
    expect(columns.find((c) => c.key === eskiKey)!.label).toBe("Mayıs 2026 · 2025-2026");
    // En eski bekleyen önceki sezondan
    expect(defaultPanelKey(columns)).toBe("2025-2026:2026-04");
    expect(columnKeyForInstallment(columns, "yok")).toBeNull();
  });

  it("diğer bekleyenler vade sırasıyla, ödenmiş aylar hariç", () => {
    const columns = studentPanelColumns(
      student([plan("aidat", "2026-2027", [inst("2026-09-05", 19000, "odendi"), inst("2026-11-05", 19000), inst("2026-10-05", 19000)])]),
      TODAY,
    );
    expect(pendingColumns(columns).map((c) => [c.key, c.overdue, c.openKurus])).toEqual([
      ["2026-10", true, 1900000],
      ["2026-11", false, 1900000],
    ]);
  });
});
