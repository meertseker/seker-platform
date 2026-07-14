import { describe, it, expect } from "vitest";
import { installmentsToCancel } from "@/lib/student-leave";

describe("installmentsToCancel", () => {
  it("yalnız 'bekliyor' durumundaki taksitleri seçer", () => {
    const rows = [
      { id: "1", status: "bekliyor" },
      { id: "2", status: "odendi" },
      { id: "3", status: "bekliyor" },
      { id: "4", status: "iptal" },
    ];
    expect(installmentsToCancel(rows).map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("hiç bekleyen taksit yoksa boş dizi döner", () => {
    const rows = [
      { id: "1", status: "odendi" },
      { id: "2", status: "iptal" },
    ];
    expect(installmentsToCancel(rows)).toEqual([]);
  });

  it("boş girdi için boş dizi döner", () => {
    expect(installmentsToCancel([])).toEqual([]);
  });
});
