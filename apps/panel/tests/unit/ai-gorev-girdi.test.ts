import { describe, expect, it } from "vitest";
import { buildPromptInput, SYSTEM_PROMPT, type PromptData } from "@/lib/ai/gorev-girdi";

const empty: PromptData = {
  weekStart: "2026-10-19",
  schoolInfo: "",
  banned: ["en iyi", "garanti"],
  slots: ["reels_a", "reels_b", "sayfa_google", "sayfa_instagram"],
  recentTopics: [],
  contentLeads: [],
  keywords: [],
  campaigns: [],
};

describe("buildPromptInput", () => {
  it("veri yokken de derlenir ve bunu söyler", () => {
    const text = buildPromptInput(empty);
    expect(text).toContain("19 Ekim 2026");
    expect(text).toContain("Okul bilgileri girilmedi");
    expect(text).toMatch(/Son haftalarda verilmiş görev yok/);
    expect(text).toMatch(/henüz veri yok/);
    for (const label of ["Reels A", "Reels B", "Sayfa · Google", "Sayfa · Instagram"]) expect(text).toContain(label);
  });

  it("yalnız istenen yuvalar yazılır", () => {
    const text = buildPromptInput({ ...empty, slots: ["sayfa_google"] });
    expect(text).toContain("sayfa_google");
    expect(text).not.toContain("reels_a");
  });

  it("okul bilgisi, eski konular, kelimeler ve kampanyalar girer; tutar yok", () => {
    const text = buildPromptInput({
      ...empty,
      schoolInfo: "Bahçeli bina, İngilizce her gün.",
      recentTopics: [{ weekStart: "2026-10-12", code: "R-2642-A", topic: "Uyum haftası" }],
      contentLeads: [{ code: "R-2642-A", topic: "Uyum haftası", total: 4, randevu: 2, kayit: 1, kayip: 1 }],
      keywords: [{ term: "kadıköy anaokulu", total: 6, randevu: 3, kayit: 1 }],
      campaigns: [{ name: "Arama - Kadıköy", platform: "google", clicks: 120, impressions: 3400 }],
    });
    expect(text).toContain("Bahçeli bina, İngilizce her gün.");
    expect(text).toContain("Uyum haftası");
    expect(text).toContain("kadıköy anaokulu");
    expect(text).toContain("Arama - Kadıköy");
    expect(text).not.toMatch(/TL|₺|maliyet|harcama/i);
  });

  it("arama kelimesindeki uzun rakam dizisi (telefon) silinir", () => {
    const text = buildPromptInput({ ...empty, keywords: [{ term: "anaokulu 05321234567", total: 1, randevu: 0, kayit: 0 }] });
    expect(text).not.toContain("05321234567");
    expect(text).toContain("anaokulu");
  });

  it("yasaklı ifadeler prompt'a yazılır", () => {
    expect(buildPromptInput(empty)).toContain('"en iyi", "garanti"');
  });
});

describe("SYSTEM_PROMPT", () => {
  it("MEB, yazmama ve para kuralları yazılı", () => {
    expect(SYSTEM_PROMPT).toMatch(/öğrenci(nin)? yüz/i);
    expect(SYSTEM_PROMPT).toMatch(/yalnız konu/i);
    expect(SYSTEM_PROMPT).toMatch(/para/i);
    expect(SYSTEM_PROMPT).toMatch(/en iyi/);
  });
});
