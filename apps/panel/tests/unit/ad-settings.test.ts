import { describe, it, expect, vi, beforeEach } from "vitest";

const requireRole = vi.fn();
const revalidatePath = vi.fn();
const upsert = vi.fn();
const from = vi.fn(() => ({ upsert }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));

import { saveAdSettings } from "@/actions/ad-settings";
import { DEFAULT_AD_SETTINGS, getAdSettings, parseAdSettings, type AdSettings } from "@/lib/ads/ad-settings";
import { getContentRules } from "@/lib/content/settings";

const valid = (): AdSettings => ({
  ...DEFAULT_AD_SETTINGS,
  gates: { ...DEFAULT_AD_SETTINGS.gates },
  monthlyBudget: { googleTl: 5000, metaTl: 3000 },
  banned: ["en iyi", "garanti"],
  limits: { ...DEFAULT_AD_SETTINGS.limits },
});

const rows = [
  { key: "reklam_kurallari", value: { hedef_nitelikli_tl: 800, durdur_kat: 2, kazan_min_nitelikli: 4, sonucsuz_hafta: 2, buyutme_yuzde: 15, yorgunluk_siklik: 4, yorgunluk_ctr_dusus_yuzde: 25 } },
  { key: "kapi_esikleri", value: { ilk_arama_dk: 10, ulasma_yuzde: 75, randevu_yuzde: 30, gelme_yuzde: 65 } },
  { key: "aylik_butce", value: { google_tl: 4000, meta_tl: 2000 } },
  { key: "yasakli_ifadeler", value: ["birinci"] },
  { key: "icerik_limitleri", value: { reels_aciklama: 120, sayfa_baslik: 25, en_az: 8 } },
];

const clientWith = (data: unknown) => ({ from: () => ({ select: () => ({ in: async () => ({ data }) }) }) }) as never;

describe("parseAdSettings", () => {
  it("satır yoksa varsayılanları verir", () => {
    expect(parseAdSettings([])).toEqual(DEFAULT_AD_SETTINGS);
    expect(DEFAULT_AD_SETTINGS.targetTl).toBe(1000);
    expect(DEFAULT_AD_SETTINGS.gates).toEqual({ firstCallMin: 15, reachPct: 80, apptPct: 35, showPct: 70 });
  });

  it("bozuk değer varsayılana düşer, sağlam alan korunur", () => {
    const s = parseAdSettings([
      { key: "reklam_kurallari", value: { hedef_nitelikli_tl: "çok", durdur_kat: -1, kazan_min_nitelikli: 7 } },
      { key: "kapi_esikleri", value: null },
      { key: "yasakli_ifadeler", value: "x" },
    ]);
    expect(s.targetTl).toBe(1000);
    expect(s.stopMultiple).toBe(3);
    expect(s.winMin).toBe(7);
    expect(s.gates).toEqual(DEFAULT_AD_SETTINGS.gates);
    expect(s.banned).toEqual(DEFAULT_AD_SETTINGS.banned);
  });

  it("tam satırları okur", () => {
    const s = parseAdSettings(rows);
    expect(s.targetTl).toBe(800);
    expect(s.gates.firstCallMin).toBe(10);
    expect(s.monthlyBudget).toEqual({ googleTl: 4000, metaTl: 2000 });
    expect(s.limits).toEqual({ reelsCaption: 120, pageTitle: 25, min: 8 });
  });
});

describe("getContentRules", () => {
  it("öğretmen oturumunda yalnız iki anahtar görünse de çalışır", async () => {
    const teacherRows = rows.filter((r) => ["yasakli_ifadeler", "icerik_limitleri"].includes(r.key));
    const c = await getContentRules(clientWith(teacherRows));
    expect(c.banned).toEqual(["birinci"]);
    expect(c.limits).toEqual({ reelsCaption: 120, pageTitle: 25, min: 8 });
    expect(c.rules).toEqual({ targetTl: 1000, stopMultiple: 3, winMin: 5, noResultWeeks: 3 });
  });

  it("getAdSettings ile aynı değerleri döner", async () => {
    const full = await getAdSettings(clientWith(rows));
    const c = await getContentRules(clientWith(rows));
    expect(c.rules).toEqual({ targetTl: full.targetTl, stopMultiple: full.stopMultiple, winMin: full.winMin, noResultWeeks: full.noResultWeeks });
    expect(c.banned).toEqual(full.banned);
    expect(c.limits).toEqual(full.limits);
  });
});

describe("saveAdSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: "u1", role: "yonetici" });
    upsert.mockResolvedValue({ error: null });
  });

  it("danışman kaydedemez", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(saveAdSettings(valid())).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith("yonetici");
    expect(upsert).not.toHaveBeenCalled();
  });

  it('"%120" reddedilir', async () => {
    const input = valid();
    (input.gates as unknown as { reachPct: unknown }).reachPct = "%120";
    expect("error" in (await saveAdSettings(input))).toBe(true);
    input.gates.reachPct = 120;
    expect("error" in (await saveAdSettings(input))).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("aralık dışı değerleri ve kısa yasaklı ifadeyi reddeder", async () => {
    const mutations: ((i: AdSettings) => void)[] = [
      (i) => void (i.stopMultiple = 11),
      (i) => void (i.winMin = 0),
      (i) => void (i.gates.firstCallMin = 241),
      (i) => void (i.monthlyBudget.metaTl = -1),
      (i) => void (i.targetTl = 10.5),
      (i) => void (i.banned = ["a"]),
      (i) => void (i.banned = Array.from({ length: 51 }, (_, n) => `ifade ${n}`)),
    ];
    for (const mut of mutations) {
      const input = valid();
      mut(input);
      expect("error" in (await saveAdSettings(input))).toBe(true);
    }
    expect(upsert).not.toHaveBeenCalled();
  });

  it("geçerli girdi beş anahtarı upsert eder", async () => {
    const r = await saveAdSettings(valid());
    expect(r).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("app_settings");
    const [payload, opts] = upsert.mock.calls[0] as unknown as [{ key: string; value: unknown }[], unknown];
    expect(opts).toEqual({ onConflict: "key" });
    expect(payload.map((p) => p.key)).toEqual(["reklam_kurallari", "kapi_esikleri", "aylik_butce", "yasakli_ifadeler", "icerik_limitleri"]);
    expect(payload[1]!.value).toEqual({ ilk_arama_dk: 15, ulasma_yuzde: 80, randevu_yuzde: 35, gelme_yuzde: 70 });
    expect(payload[3]!.value).toEqual(["en iyi", "garanti"]);
  });

  it("veritabanı hatasında hata döner", async () => {
    upsert.mockResolvedValue({ error: { message: "x" } });
    expect("error" in (await saveAdSettings(valid()))).toBe(true);
  });
});
