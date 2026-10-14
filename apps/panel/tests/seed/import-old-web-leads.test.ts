import { describe, it, expect } from "vitest";
import { parseOldWebLeads } from "../../scripts/seed/lib/old-web-leads";

const header = "id,parent_name,phone,landing_path,gclid,created_at";

describe("parseOldWebLeads", () => {
  it("geçerli satırı E.164 telefonla döndürür", () => {
    const csv = `${header}\r\nabc-1,Ayşe Yılmaz,05301018875,/lp/kres-2-yas,Cj0X,2026-09-01 10:00:00+00\r\n`;
    expect(parseOldWebLeads(csv)).toEqual({
      rows: [{
        id: "abc-1", parentName: "Ayşe Yılmaz", phone: "+905301018875",
        landingPath: "/lp/kres-2-yas", gclid: "Cj0X", createdAt: "2026-09-01T10:00:00.000Z",
      }],
      rejected: [],
    });
  });

  it("geçersiz telefonu ve eksik adı satır numarasıyla reddeder", () => {
    const csv = `${header}\nx1,Ali Veli,02122223344,/,,2026-09-01T10:00:00Z\nx2,,05301018875,/,,2026-09-01T10:00:00Z\n`;
    const { rows, rejected } = parseOldWebLeads(csv);
    expect(rows).toHaveLength(0);
    expect(rejected).toEqual([
      { line: 2, reason: "geçersiz telefon" },
      { line: 3, reason: "ad eksik" },
    ]);
  });

  it("başlık eksikse anlaşılır hata fırlatır", () => {
    expect(() => parseOldWebLeads("id,name\n1,a\n")).toThrow(/phone/);
  });
});
