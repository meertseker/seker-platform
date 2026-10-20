import { describe, expect, it } from "vitest";
import { cleanSuggestions, suggestionProblem, type Suggestion } from "@/lib/ai/gorev-oneri";
import { DEFAULT_BANNED_PHRASES } from "@/lib/content/checks";

const ok: Suggestion = {
  baslik: "Servis güzergâhı nasıl planlanır",
  aciklama: "Öğretmen sabah servis karşılamasını anlatır. Velilerin en sık sorusu ulaşım; bu hafta kayıt görüşmeleri yoğun.",
  dayanak: "Kapıdan kapıya servis",
};

function out(yuvalar: { yuva: string; oneriler: Suggestion[] }[]) {
  return { yuvalar };
}

describe("suggestionProblem", () => {
  it("geçerli öneri için null", () => {
    expect(suggestionProblem(ok, DEFAULT_BANNED_PHRASES)).toBeNull();
  });
  it("yasaklı ifade eki de yakalanır", () => {
    expect(suggestionProblem({ ...ok, aciklama: `${ok.aciklama} Garantili gelişim.` }, DEFAULT_BANNED_PHRASES)).toMatch(/garanti/);
    expect(suggestionProblem({ ...ok, baslik: "Bölgenin EN İYİ bahçesi" }, DEFAULT_BANNED_PHRASES)).toMatch(/en iyi/);
  });
  it("ayardaki yasaklı ifade de denetlenir", () => {
    expect(suggestionProblem({ ...ok, dayanak: "Tek adres bahçe" }, ["tek adres"])).toMatch(/tek adres/);
  });
  it("para ifadesi atılır", () => {
    for (const aciklama of [
      "Bu hafta 500 TL harcanan reklam iyi gitti, aynı konuyu çekin lütfen.",
      "Reklam bütçesi bu konuya kaydı, öğretmen bunu anlatsın diye öneriyoruz.",
      "Nitelikli veli maliyeti düşük çıkan konu; öğretmen tekrar anlatsın.",
      "Kampanya ₺ bazında verimli oldu, öğretmen bahçeyi anlatsın.",
    ]) {
      expect(suggestionProblem({ ...ok, aciklama }, DEFAULT_BANNED_PHRASES)).toMatch(/para/);
    }
  });
  it("uzunluk sınırları", () => {
    expect(suggestionProblem({ ...ok, baslik: "x".repeat(81) }, [])).not.toBeNull();
    expect(suggestionProblem({ ...ok, aciklama: "x".repeat(401) }, [])).not.toBeNull();
    expect(suggestionProblem({ ...ok, dayanak: "x".repeat(121) }, [])).not.toBeNull();
    expect(suggestionProblem({ ...ok, baslik: "  " }, [])).not.toBeNull();
  });
});

describe("cleanSuggestions", () => {
  it("şema dışı çıktıda null", () => {
    expect(cleanSuggestions({ foo: 1 }, [])).toBeNull();
    expect(cleanSuggestions(null, [])).toBeNull();
  });
  it("yuva başına en çok 3, kötü öneri atılır, eksik yuva boş", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...ok, baslik: `${ok.baslik} ${i}` }));
    const res = cleanSuggestions(
      out([
        { yuva: "reels_a", oneriler: many },
        { yuva: "sayfa_google", oneriler: [{ ...ok, baslik: "En iyi okul" }, ok] },
      ]),
      DEFAULT_BANNED_PHRASES,
    );
    expect(res).not.toBeNull();
    expect(res!.reels_a).toHaveLength(3);
    expect(res!.sayfa_google).toEqual([ok]);
    expect(res!.reels_b).toEqual([]);
    expect(res!.sayfa_instagram).toEqual([]);
  });
  it("boşlukları kırpar ve aynı başlığı bir kez alır", () => {
    const res = cleanSuggestions(
      out([{ yuva: "reels_b", oneriler: [{ ...ok, baslik: `  ${ok.baslik} ` }, ok] }]),
      [],
    );
    expect(res!.reels_b).toEqual([ok]);
  });
  it("tanınmayan yuva şema dışıdır: null", () => {
    const res = cleanSuggestions({ yuvalar: [{ yuva: "reels_c", oneriler: [ok] }] }, []);
    expect(res).toBeNull();
  });
});
