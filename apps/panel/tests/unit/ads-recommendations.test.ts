import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_AD_SETTINGS } from "@/lib/ads/ad-settings";
import type { Gate } from "@/lib/ads/weekly";
import type { RecInput, RecommendationRow } from "@/lib/ads/recommendations";

const requireRole = vi.fn();
const revalidatePath = vi.fn();
const applyAdChange = vi.fn();
const moveContentStage = vi.fn();
const store = {
  get: vi.fn(),
  claim: vi.fn(async (): Promise<RecommendationRow | null> => null),
  release: vi.fn(async () => undefined),
  finish: vi.fn(async () => undefined),
  hold: vi.fn(async () => true),
};

vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({}) }));
vi.mock("@/actions/ad-changes", () => ({ applyAdChange: (...a: unknown[]) => applyAdChange(...a) }));
vi.mock("@/actions/content", () => ({ moveContentStage: (...a: unknown[]) => moveContentStage(...a) }));
vi.mock("@/lib/ads/recommendations", async (orig) => {
  const actual = await orig<typeof import("@/lib/ads/recommendations")>();
  return { ...actual, supabaseRecommendationStore: () => store };
});

import { accusative, buildRecommendations, genitive } from "@/lib/ads/recommendations";
import { fatigueNumbers } from "@/lib/queries/recommendations";
import { approveRecommendation, holdRecommendation } from "@/actions/recommendations";

const S = DEFAULT_AD_SETTINGS;

function gate(tone: Gate["tone"], label = "Randevu verilen"): Gate {
  return { key: "appt", label, value: 20, display: "%20", target: "", tone };
}
const GREEN = [gate("green", "İlk arama süresi"), gate("green")];
const RED = [gate("green", "İlk arama süresi"), gate("red")];

function input(over: Partial<RecInput>): RecInput {
  return {
    contentId: "11111111-1111-4111-8111-111111111111",
    contentCode: "R-2643-B",
    platform: "meta",
    stage: "test",
    perf: { spendKurus: 0, clicks: 0, platformResults: 0, leads: 0, qualified: 0, appointments: 0 },
    weeksInTest: 1,
    adObjects: [
      { objectId: "120001", level: "ad", name: "R-2643-B reklamı", status: "ACTIVE", dailyBudgetMicros: 150_000_000, budgetResource: "120900" },
    ],
    firstWeekCtr: null,
    lastWeekCtr: null,
    frequency: null,
    costPerQualifiedTrend: null,
    organic72h: null,
    ...over,
  };
}

const kurus = (tl: number) => tl * 100;

describe("buildRecommendations (prototip örnekleri)", () => {
  it("R-2643-B 3.150 TL, 0 nitelikli → durdur", () => {
    const [d, ...rest] = buildRecommendations(
      [input({ perf: { spendKurus: kurus(3150), clicks: 40, platformResults: 3, leads: 2, qualified: 0, appointments: 0 } })],
      GREEN,
      S,
    );
    expect(rest).toEqual([]);
    expect(d).toMatchObject({
      ruleKey: "durdur",
      objectKey: "R-2643-B",
      platform: "meta",
      title: "R-2643-B'yi durdur",
      why: "3.150 TL harcadı, hiç nitelikli veli getirmedi. Kural: hedefin 3 katı harcayıp sonuç yoksa dur.",
      blockedReason: null,
      action: { platform: "meta", level: "ad", objectId: "120001", objectName: "R-2643-B reklamı", kind: "pause" },
    });
  });

  it("durdurulmuş reklam için durdurma önerisi yazılmaz", () => {
    const out = buildRecommendations(
      [
        input({
          perf: { spendKurus: kurus(3150), clicks: 0, platformResults: 0, leads: 0, qualified: 0, appointments: 0 },
          adObjects: [{ objectId: "120001", level: "ad", name: "x", status: "PAUSED", dailyBudgetMicros: null, budgetResource: null }],
        }),
      ],
      GREEN,
      S,
    );
    expect(out).toEqual([]);
  });

  it("R-2641-A 6 nitelikli, veli başı 760 TL → büyütme kampanyasına taşı (aşama eylemi)", () => {
    const [d] = buildRecommendations(
      [input({ contentCode: "R-2641-A", perf: { spendKurus: kurus(4560), clicks: 90, platformResults: 9, leads: 8, qualified: 6, appointments: 3 } })],
      GREEN,
      S,
    );
    expect(d).toMatchObject({
      ruleKey: "buyut",
      objectKey: "R-2641-A",
      title: "R-2641-A'yı büyütme kampanyasına taşı",
      why: "6 nitelikli veli, veli başı 760 TL (hedef 1.000 TL).",
      action: { kind: "stage", contentId: "11111111-1111-4111-8111-111111111111", to: "kazanan" },
      blockedReason: null,
    });
  });

  it("R-2645-A organikte önde → teste girsin", () => {
    const [d] = buildRecommendations(
      [input({ contentCode: "R-2645-A", stage: "organik", adObjects: [], organic72h: { lead: "onde", ratio: 2, versus: "R-2645-B" } })],
      GREEN,
      S,
    );
    expect(d).toMatchObject({
      ruleKey: "teste_al",
      title: "R-2645-A teste girsin",
      why: "72 saatte organik izlenmede R-2645-B'nin 2 katı.",
      action: { kind: "stage", to: "test" },
    });
  });

  it("organikte geride ya da eşit → öneri yok", () => {
    for (const lead of ["geride", "esit", null] as const) {
      expect(buildRecommendations([input({ stage: "organik", organic72h: { lead, ratio: null } })], GREEN, S)).toEqual([]);
    }
  });

  const winner = (status = "ENABLED") =>
    input({
      contentCode: "S-2641-G",
      platform: "google",
      stage: "kazanan",
      perf: { spendKurus: kurus(4560), clicks: 90, platformResults: 9, leads: 8, qualified: 6, appointments: 3 },
      adObjects: [
        { objectId: "9001", level: "campaign", name: "TR_K2-A_Beykent", status, dailyBudgetMicros: 150_000_000, budgetResource: "customers/1/campaignBudgets/7" },
      ],
    });

  it("TR_K2-A kazanan, kapı kırmızı → bütçe önerisi yazılır ama engelli", () => {
    const [d] = buildRecommendations([winner()], RED, S);
    expect(d).toMatchObject({
      ruleKey: "butce_artir",
      objectKey: "google:customers/1/campaignBudgets/7",
      platform: "google",
      title: "TR_K2-A_Beykent bütçesini %20 artır",
      blockedReason: "Kapı kırmızı",
      action: { platform: "google", level: "campaign", objectId: "9001", kind: "budget", newDailyBudgetTl: 180 },
    });
    expect(d.why).toBe(
      "Veli başı maliyet hedefin altında (760 TL, hedef 1.000 TL). Günlük bütçe 150 TL → 180 TL. " +
        "Ancak bir kapı kırmızı (Randevu verilen) olduğu için bekletiliyor.",
    );
  });

  it("bütçe artışı sınırı aşmaz: 153 TL × %20 = 183,6 → 183 TL (aşağı yuvarlanır)", () => {
    const w = winner();
    w.adObjects[0].dailyBudgetMicros = 153_000_000;
    const [d] = buildRecommendations([w], GREEN, S);
    expect(d.action).toMatchObject({ kind: "budget", newDailyBudgetTl: 183 });
    expect(((183 - 153) / 153) * 100).toBeLessThanOrEqual(S.scaleMaxPct);
  });

  it("paylaşılan Meta bütçesi: tek öneri, reklam seti adıyla, reklam setine uygulanır", () => {
    const owner = { level: "adset" as const, objectId: "120900", name: "Test seti" };
    const ad = (objectId: string) => ({
      objectId,
      level: "ad",
      name: `reklam ${objectId}`,
      status: "ACTIVE",
      dailyBudgetMicros: 150_000_000,
      budgetResource: "120900",
      budgetOwner: owner,
    });
    const perf = { spendKurus: kurus(4560), clicks: 90, platformResults: 9, leads: 8, qualified: 6, appointments: 3 };
    const out = buildRecommendations(
      [
        input({ contentCode: "R-2641-A", stage: "kazanan", perf, adObjects: [ad("1")] }),
        input({ contentCode: "R-2641-B", stage: "kazanan", perf, adObjects: [ad("2")] }),
      ],
      GREEN,
      S,
    );
    const budget = out.filter((d) => d.ruleKey === "butce_artir");
    expect(budget).toHaveLength(1);
    expect(budget[0]).toMatchObject({
      objectKey: "meta:120900",
      title: "Test seti bütçesini %20 artır",
      action: { platform: "meta", level: "adset", objectId: "120900", objectName: "Test seti", kind: "budget", newDailyBudgetTl: 180 },
    });
    expect(budget[0].why).toContain("Bu bütçe reklam seti düzeyinde; aynı bütçeyi kullanan diğer reklamlar da büyür.");
  });

  it("Meta bütçesinin sahibi bilinmiyorsa bütçe önerisi yazılmaz", () => {
    const perf = { spendKurus: kurus(4560), clicks: 90, platformResults: 9, leads: 8, qualified: 6, appointments: 3 };
    expect(buildRecommendations([input({ stage: "kazanan", perf })], GREEN, S).filter((d) => d.ruleKey === "butce_artir")).toEqual([]);
  });

  it("kapılar yeşilken bütçe önerisi engelsiz", () => {
    const [d] = buildRecommendations([winner()], GREEN, S);
    expect(d.blockedReason).toBeNull();
    expect(d.why).toBe("Veli başı maliyet hedefin altında (760 TL, hedef 1.000 TL). Günlük bütçe 150 TL → 180 TL.");
  });

  it("kapı 'veri yok' (gri) kırmızı sayılmaz", () => {
    const [d] = buildRecommendations([winner()], [gate("none")], S);
    expect(d.blockedReason).toBeNull();
  });

  it("durmuş kampanyanın bütçesi artırılmaz", () => {
    expect(buildRecommendations([winner("PAUSED")], GREEN, S)).toEqual([]);
  });

  it("yorgunluk: sıklık > 3, tıklama oranı %30+ düşük ve maliyet artıyor", () => {
    const base = {
      stage: "kazanan",
      perf: { spendKurus: kurus(9000), clicks: 0, platformResults: 0, leads: 10, qualified: 6, appointments: 2 },
      frequency: 3.4,
      firstWeekCtr: 0.02,
      lastWeekCtr: 0.013,
      costPerQualifiedTrend: "up" as const,
      adObjects: [{ objectId: "120001", level: "ad", name: "R-2643-B reklamı", status: "ACTIVE", dailyBudgetMicros: null, budgetResource: null }],
    };
    const [d] = buildRecommendations([input(base)], GREEN, S);
    expect(d).toMatchObject({ ruleKey: "yorgunluk", title: "R-2643-B yoruldu, durdurun", action: { kind: "pause", objectId: "120001" } });
    expect(d.why).toContain("Sıklık 3,4 (sınır 3), tıklama oranı ilk haftaya göre %35 düştü");
    // Üç koşuldan biri eksikse yorgunluk yok.
    expect(buildRecommendations([input({ ...base, frequency: 3 })], GREEN, S)).toEqual([]);
    expect(buildRecommendations([input({ ...base, lastWeekCtr: 0.015 })], GREEN, S)).toEqual([]);
    expect(buildRecommendations([input({ ...base, costPerQualifiedTrend: "flat" })], GREEN, S)).toEqual([]);
  });

  it("sonuçsuz: 3 hafta testte, kazanma ve durdurma tutmadı → arşive", () => {
    const perf = { spendKurus: kurus(2800), clicks: 0, platformResults: 0, leads: 4, qualified: 2, appointments: 1 };
    const [d] = buildRecommendations([input({ weeksInTest: 3, perf })], GREEN, S);
    expect(d).toMatchObject({
      ruleKey: "sonucsuz",
      title: "R-2643-B arşive alınsın",
      why: "3 haftadır testte, 2 nitelikli veli, veli başı 1.400 TL. Kural: 3 haftada kazanamayan arşive alınır.",
      action: { kind: "stage", to: "arsiv" },
    });
    expect(buildRecommendations([input({ weeksInTest: 2, perf })], GREEN, S)).toEqual([]);
  });

  it("birden fazla çalışan reklamda durdurma hedefi tahmin edilmez", () => {
    const [d] = buildRecommendations(
      [
        input({
          perf: { spendKurus: kurus(3150), clicks: 0, platformResults: 0, leads: 0, qualified: 0, appointments: 0 },
          adObjects: [
            { objectId: "1", level: "ad", name: "a", status: "ACTIVE", dailyBudgetMicros: null, budgetResource: null },
            { objectId: "2", level: "ad", name: "b", status: "ACTIVE", dailyBudgetMicros: null, budgetResource: null },
          ],
        }),
      ],
      GREEN,
      S,
    );
    expect(d.action).toBeNull();
    expect(d.why).toContain("birden fazla reklam");
  });
});

describe("metin ekleri", () => {
  it("belirtme ve ilgi eki ünlü uyumuyla", () => {
    expect(accusative("R-2643-B")).toBe("R-2643-B'yi");
    expect(accusative("R-2641-A")).toBe("R-2641-A'yı");
    expect(accusative("R-2641-O")).toBe("R-2641-O'yu");
    expect(genitive("R-2645-B")).toBe("R-2645-B'nin");
    expect(genitive("R-2645-A")).toBe("R-2645-A'nın");
  });
});

describe("fatigueNumbers", () => {
  const day = (date: string, clicks: number, impressions: number, reach: number, tl = 100) => ({
    date,
    costMicros: tl * 1_000_000,
    clicks,
    impressions,
    reach,
  });

  it("ilk hafta ve toplantı haftası tıklama oranı, sıklık ve maliyet yönü", () => {
    const rows = [
      day("2026-09-28", 20, 1000, 800),
      day("2026-10-02", 20, 1000, 800),
      day("2026-10-05", 10, 1000, 500, 100), // önceki hafta
      day("2026-10-12", 10, 1500, 600, 200), // toplantı haftası
      day("2026-10-14", 5, 1000, 700, 200),
    ];
    const r = fatigueNumbers(rows, ["2026-10-06", "2026-10-06", "2026-10-13"], "2026-10-12");
    expect(r.firstWeekCtr).toBeCloseTo(0.02);
    expect(r.lastWeekCtr).toBeCloseTo(15 / 2500);
    expect(r.frequency).toBeCloseTo(2500 / 700);
    // önceki hafta 100 TL / 2 nitelikli = 50; bu hafta 400 TL / 1 = 400 → artıyor
    expect(r.costPerQualifiedTrend).toBe("up");
  });

  it("ilk hafta toplantı haftasıyla çakışıyorsa ilk hafta yok; veri yoksa hepsi null", () => {
    expect(fatigueNumbers([day("2026-10-10", 1, 100, 50)], [], "2026-10-12").firstWeekCtr).toBeNull();
    expect(fatigueNumbers([], [], "2026-10-12")).toEqual({
      firstWeekCtr: null,
      lastWeekCtr: null,
      frequency: null,
      costPerQualifiedTrend: null,
    });
  });
});

const REC_ID = "22222222-2222-4222-8222-222222222222";

/** Ayırma (claim) satırı döndürür; onay o satırın eylemini uygular. */
function given(row: RecommendationRow) {
  store.claim.mockResolvedValue(row);
  store.get.mockResolvedValue(row);
}

function rec(over: Partial<RecommendationRow>): RecommendationRow {
  return {
    id: REC_ID,
    weekStart: "2026-10-12",
    ruleKey: "durdur",
    objectKey: "R-2643-B",
    platform: "meta",
    title: "R-2643-B'yi durdur",
    why: "w",
    action: { platform: "meta", level: "ad", objectId: "120001", objectName: "R-2643-B", kind: "pause" },
    blockedReason: null,
    status: "acik",
    result: null,
    decidedAt: null,
    ...over,
  };
}

describe("approveRecommendation / holdRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: "yon-1", role: "yonetici" });
    store.claim.mockResolvedValue(null);
    store.hold.mockResolvedValue(true);
  });

  it("danışman onaylayamaz ve bekletemez", async () => {
    requireRole.mockRejectedValue(new Error("yetkisiz"));
    await expect(approveRecommendation(REC_ID)).rejects.toThrow();
    await expect(holdRecommendation(REC_ID)).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith("yonetici");
    expect(store.claim).not.toHaveBeenCalled();
    expect(store.hold).not.toHaveBeenCalled();
    expect(applyAdChange).not.toHaveBeenCalled();
  });

  it("platform eylemi applyAdChange'e öneri kaynağıyla gider; kapalıyken sonuç kayda geçer", async () => {
    given(rec({}));
    applyAdChange.mockResolvedValue({ ok: true, status: "uygulanmadi_kapali", message: "x" });
    const r = await approveRecommendation(REC_ID);
    expect(r).toEqual({ ok: true, result: "Kaydedildi · uygulanmadı: canlı yazım kapalı" });
    expect(applyAdChange).toHaveBeenCalledWith({
      platform: "meta",
      level: "ad",
      objectId: "120001",
      objectName: "R-2643-B",
      kind: "pause",
      source: "oneri",
      recommendationId: REC_ID,
      reason: undefined,
    });
    expect(store.claim).toHaveBeenCalledWith(REC_ID, "yon-1");
    expect(store.finish).toHaveBeenCalledWith(REC_ID, "Kaydedildi · uygulanmadı: canlı yazım kapalı");
  });

  it("canlı yazım açıkken uygulandı sonucu", async () => {
    given(rec({}));
    applyAdChange.mockResolvedValue({ ok: true, status: "uygulandi", message: "x" });
    expect(await approveRecommendation(REC_ID)).toEqual({ ok: true, result: "✓ Uygulandı · kayda geçti" });
  });

  it("kırmızı kapıda gerekçesiz bütçe önerisi: gerekçe istenir, öneri açık kalır", async () => {
    given(
      rec({
        ruleKey: "butce_artir",
        blockedReason: "Kapı kırmızı",
        action: { platform: "google", level: "campaign", objectId: "9001", objectName: "TR_K2-A", kind: "budget", newDailyBudgetTl: 180 },
      }),
    );
    applyAdChange.mockResolvedValue({ error: "Bu hafta bir kapı kırmızı (Randevu verilen). ...", needsReason: true });
    const r = await approveRecommendation(REC_ID);
    expect(r).toMatchObject({ needsReason: true });
    expect(store.release).toHaveBeenCalledWith(REC_ID);
    expect(store.finish).not.toHaveBeenCalled();

    applyAdChange.mockResolvedValue({ ok: true, status: "uygulanmadi_kapali", message: "x" });
    const ok = await approveRecommendation(REC_ID, "Randevu oranı geçici düştü, deniyoruz");
    expect(ok).toEqual({ ok: true, result: "Kaydedildi · uygulanmadı: canlı yazım kapalı" });
    expect(applyAdChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "budget", newDailyBudgetTl: 180, reason: "Randevu oranı geçici düştü, deniyoruz" }),
    );
  });

  it("aşama eylemi moveContentStage ile", async () => {
    given(
      rec({ ruleKey: "buyut", action: { kind: "stage", contentId: "11111111-1111-4111-8111-111111111111", to: "kazanan" } }),
    );
    moveContentStage.mockResolvedValue({ ok: true });
    expect(await approveRecommendation(REC_ID)).toEqual({ ok: true, result: "✓ Uygulandı · kayda geçti" });
    expect(moveContentStage).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "kazanan");
    expect(applyAdChange).not.toHaveBeenCalled();
  });

  it("aşama geçişi başarısızsa öneri yeniden açılır", async () => {
    given(rec({ action: { kind: "stage", contentId: "11111111-1111-4111-8111-111111111111", to: "test" } }));
    moveContentStage.mockResolvedValue({ error: "Bu aşama geçişi yapılamaz" });
    expect(await approveRecommendation(REC_ID)).toEqual({ error: "Bu aşama geçişi yapılamaz" });
    expect(store.release).toHaveBeenCalledWith(REC_ID);
  });

  it("karar verilmiş öneri yeniden onaylanamaz; geçersiz öneri onaylanamaz", async () => {
    store.claim.mockResolvedValue(null);
    store.get.mockResolvedValue(rec({ status: "bekletildi" }));
    expect(await approveRecommendation(REC_ID)).toEqual({ error: "Bu öneri için karar zaten verildi." });
    store.get.mockResolvedValue(rec({ status: "onaylandi" }));
    expect(await approveRecommendation(REC_ID)).toEqual({ error: "Bu öneri için karar zaten verildi." });
    store.get.mockResolvedValue(rec({ status: "gecersiz" }));
    expect(await approveRecommendation(REC_ID)).toEqual({ error: "Bu öneri artık geçerli değil." });
    store.get.mockResolvedValue(null);
    expect(await approveRecommendation(REC_ID)).toEqual({ error: "Öneri bulunamadı." });
    expect(applyAdChange).not.toHaveBeenCalled();
    expect(moveContentStage).not.toHaveBeenCalled();
  });

  it("ayırılan satırın eylemi uygulanır (okuma ile ayırma arasında tazelenen öneri)", async () => {
    given(
      rec({
        ruleKey: "butce_artir",
        action: { platform: "meta", level: "adset", objectId: "120900", objectName: "Test seti", kind: "budget", newDailyBudgetTl: 183 },
      }),
    );
    store.get.mockResolvedValue(rec({})); // eski okuma: durdurma eylemi
    applyAdChange.mockResolvedValue({ ok: true, status: "uygulanmadi_kapali", message: "x" });
    await approveRecommendation(REC_ID);
    expect(applyAdChange).toHaveBeenCalledWith(expect.objectContaining({ objectId: "120900", kind: "budget", newDailyBudgetTl: 183 }));
  });

  it("geçersiz kimlik reddedilir", async () => {
    expect(await approveRecommendation("x")).toEqual({ error: "Geçersiz öneri." });
    expect(await holdRecommendation("x")).toEqual({ error: "Geçersiz öneri." });
  });

  it("Şimdilik bekle: bekletildi ve sonuç metni", async () => {
    expect(await holdRecommendation(REC_ID)).toEqual({ ok: true, result: "Bekletiliyor · gelecek hafta tekrar sorulur" });
    expect(store.hold).toHaveBeenCalledWith(REC_ID, "yon-1", "Bekletiliyor · gelecek hafta tekrar sorulur", expect.any(String));
    store.hold.mockResolvedValue(false);
    expect(await holdRecommendation(REC_ID)).toEqual({ error: "Bu öneri için karar zaten verildi." });
  });
});
