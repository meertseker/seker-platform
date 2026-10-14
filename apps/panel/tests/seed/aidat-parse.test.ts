import { describe, it, expect } from "vitest";
import { parseAidatCell, buildRosterRow, SEASON } from "../../scripts/seed/lib/aidat-parse";

describe("parseAidatCell", () => {
  it("treats a big lump as annual and divides by 10 -> tam_gun", () => {
    expect(parseAidatCell(250000)).toMatchObject({ monthlyTl: 25000, program: "tam_gun" });
  });
  it("treats a small number as monthly; 23000 defaults to yarim_gun", () => {
    expect(parseAidatCell(23000)).toMatchObject({ monthlyTl: 23000, program: "yarim_gun" });
  });
  it("parses 'Y / TAM' text: uses the TAM figure, program tam_gun, keeps raw in note", () => {
    const r = parseAidatCell("23.000 Y - 28.000 TAM");
    expect(r.monthlyTl).toBe(28000);
    expect(r.program).toBe("tam_gun");
    expect(r.note).toContain("23.000 Y - 28.000 TAM");
  });
  it("ÜCRETSİZ / empty -> no amount, no program, word in note", () => {
    expect(parseAidatCell("ÜCRETSİZ")).toMatchObject({ monthlyTl: null, program: null });
    expect(parseAidatCell("")).toMatchObject({ monthlyTl: null, program: null });
  });
});

describe("buildRosterRow", () => {
  it("maps a full row and marks program as a guess", () => {
    // cols: 0 name, 1 parents, 2 kitap, 3 aidat, 4 blank, 5 servis
    const row = ["ÖRNEK ÇOCUK", "ANNE & BABA", 45000, 250000, "", ""];
    const r = buildRosterRow(row, 2)!;
    expect(r.full_name).toBe("ÖRNEK ÇOCUK");
    expect(r.parent_name).toBe("ANNE & BABA");
    expect(r.kitap_amount).toBe(45000);
    expect(r.aidat_monthly).toBe(25000);
    expect(r.program).toBe("tam_gun");
    expect(r.program_note).toMatch(/guess/);
    expect(r.season).toBe(SEASON);
  });
  it("returns null when there is no student name", () => {
    expect(buildRosterRow(["", "ANNE", "", ""], 9)).toBeNull();
  });
  it("emits a row with blank program when aidat is absent", () => {
    const r = buildRosterRow(["ADSIZ", "", "", ""], 5)!;
    expect(r.program).toBeNull();
    expect(r.aidat_monthly).toBeNull();
  });
});
