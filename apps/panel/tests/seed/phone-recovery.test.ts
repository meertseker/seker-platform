import { describe, it, expect } from "vitest";
import { buildQuery, scorePhone, normalizeName } from "../../scripts/seed/lib/phone-recovery";

describe("normalizeName", () => {
  it("uppercases Turkish and strips punctuation", () => {
    expect(normalizeName("İlay  Altın!")).toBe("ILAY ALTIN");
  });
});

describe("scorePhone", () => {
  const pool = [
    { name: normalizeName("NURGÜL ASLI ALTIN"), phone: "+905550000001", source: "leads.csv/parent" },
    { name: normalizeName("BAŞKA BİRİ"), phone: "+905550000002", source: "leads.csv/parent" },
  ];
  it("matches on surname + parent first name with high confidence", () => {
    const q = buildQuery("İLAY ALTIN", "NURGÜL ASLI & HASAN HALUK");
    const m = scorePhone(q, pool, []);
    expect(m).not.toBeNull();
    expect(m!.phone).toBe("+905550000001");
    expect(m!.confidence).toBe("high");
  });
  it("returns null when nothing scores >= 3", () => {
    const q = buildQuery("ZZZ YYYYYY", "AAAA & BBBB");
    expect(scorePhone(q, pool, [])).toBeNull();
  });
  it("uses a chat block only when surname AND a parent token co-occur (low/medium)", () => {
    const chat = [{ text: normalizeName("MERHABA MINEL AVCI ANNESI AYSE"), phones: ["+905550000009"] }];
    const q = buildQuery("MİNEL AVCI", "AYŞE & İSMAİL");
    const m = scorePhone(q, [], chat);
    expect(m!.phone).toBe("+905550000009");
  });
});
