import { describe, expect, it } from "vitest";
import {
  adviceFor,
  canConfirmFace,
  cardTag,
  chunk,
  emptyPerf,
  fetchAllPages,
  groupByStage,
  loadContentPerf,
  perfCodes,
  ruleBars,
  stopRuleHit,
  type BoardItem,
  type ContentPerf,
} from "@/lib/content/board";
import { DEFAULT_AD_RULES } from "@/lib/content/settings";

const rules = DEFAULT_AD_RULES;
const NOW = new Date("2026-11-10T09:00:00Z"); // Salı 12:00 İstanbul

function item(over: Partial<BoardItem>): BoardItem {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    code: "R-2646-A",
    kind: "reels",
    platform: "instagram",
    topic: "07:30'da kapımız açık",
    audience: null,
    brief: null,
    ownerId: "o1",
    ownerName: "Ayşe Yılmaz",
    ownerPhone: null,
    dueAt: "2026-11-12T14:00:00Z", // Perşembe 17:00
    status: "taslak",
    stage: "gorev",
    stageChangedAt: "2026-11-09T09:00:00Z",
    submittedAt: null,
    caption: null,
    pageFields: {},
    mediaPath: null,
    faceAnswer: null,
    reviewNote: null,
    learnedNote: null,
    igPermalink: null,
    igPublishedAt: null,
    ...over,
  };
}

function perf(over: Partial<ContentPerf>): ContentPerf {
  return { ...emptyPerf(), ...over };
}

const STOP = perf({ spendKurus: 315_000, clicks: 212, platformResults: 6, leads: 2, qualified: 0 });
const WIN = perf({ spendKurus: 456_000, clicks: 388, platformResults: 15, leads: 9, qualified: 6, appointments: 3 });
const EARLY = perf({ spendKurus: 112_000, clicks: 41, leads: 3, qualified: 2 });

describe("ruleBars", () => {
  it("3.150 TL ve 0 nitelikli: harcama çubuğu kırmızı ve dolu", () => {
    const bars = ruleBars(STOP, rules);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toEqual({ label: "Nitelikli veli (kazanmak için 5)", value: "0 / 5", pct: 0, tone: "bad" });
    expect(bars[1]).toEqual({ label: "Harcama (durdurma sınırı 3.000 TL)", value: "3.150 TL", pct: 100, tone: "bad" });
  });

  it("nitelikli varsa veli başı maliyet çubuğu eklenir", () => {
    const bars = ruleBars(perf({ spendKurus: 456_000, qualified: 6 }), rules);
    expect(bars).toHaveLength(3);
    expect(bars[0]).toMatchObject({ value: "6 / 5", pct: 100, tone: "ok" });
    expect(bars[2]).toEqual({ label: "Veli başı maliyet (hedef 1.000 TL)", value: "760 TL", pct: 76, tone: "ok" });
  });

  it("erken: nötr çubuklar", () => {
    const bars = ruleBars(EARLY, rules);
    expect(bars[0]).toMatchObject({ value: "2 / 5", pct: 40, tone: "neutral" });
    expect(bars[1]).toMatchObject({ value: "1.120 TL", pct: 37, tone: "neutral" });
  });
});

describe("adviceFor", () => {
  it("Görev: teslim günüyle bekleniyor, Hatırlat", () => {
    expect(adviceFor(item({}), emptyPerf(), rules, NOW)).toEqual({
      text: "Bekleniyor. Perşembe teslim.",
      action: { kind: "remind", label: "Hatırlat" },
    });
  });

  it("Kontrol: Onayla", () => {
    const a = adviceFor(item({ stage: "kontrol", status: "teslim" }), emptyPerf(), rules, NOW);
    expect(a.text).toBe("Otomatik kontrol geçti. Okuyup onaylayın.");
    expect(a.action).toEqual({ kind: "approve", label: "Onayla" });
  });

  it("Testte, durdurma kuralı: Durdur", () => {
    const a = adviceFor(item({ stage: "test", status: "onaylandi" }), STOP, rules, NOW);
    expect(a.text).toBe("Hedefin 3 katı harcadı, nitelikli veli yok. Durdurun.");
    expect(a.action).toEqual({ kind: "stop", label: "Durdur" });
  });

  it("Testte, kazanma kuralı: Büyütme kampanyasına taşı", () => {
    const a = adviceFor(item({ stage: "test", status: "onaylandi" }), WIN, rules, NOW);
    expect(a.text).toBe("6 nitelikli veli, veli başı 760 TL (hedef 1.000 TL). Büyütme kampanyasına taşıyın.");
    expect(a.action).toEqual({ kind: "scale", label: "Büyütme kampanyasına taşı" });
  });

  it("Testte, erken: eylem yok", () => {
    const a = adviceFor(item({ stage: "test", status: "onaylandi", stageChangedAt: "2026-11-04T09:00:00Z" }), EARLY, rules, NOW);
    expect(a.text).toBe("Erken. En az 1 hafta daha bekleyin.");
    expect(a.action).toEqual({ kind: "none", label: "Beklemeye devam" });
  });

  it("Testte, 3 hafta sonuçsuz: Arşive al", () => {
    const a = adviceFor(
      item({ stage: "test", status: "onaylandi", stageChangedAt: "2026-10-15T09:00:00Z" }),
      perf({ spendKurus: 50_000 }),
      rules,
      NOW,
    );
    expect(a.text).toBe("3 haftadır nitelikli veli yok. Arşive alın.");
    expect(a.action).toEqual({ kind: "archive", label: "Arşive al" });
  });

  it("Organik, 72 saat doldu: Teste al", () => {
    const a = adviceFor(item({ stage: "organik", status: "onaylandi", igPublishedAt: "2026-11-06T09:00:00Z" }), emptyPerf(), rules, NOW);
    expect(a.action).toEqual({ kind: "test", label: "Teste al" });
  });
});

describe("cardTag", () => {
  it("Görev: Yazılıyor", () => expect(cardTag(item({}), emptyPerf(), rules, NOW).text).toBe("Yazılıyor"));
  it("Kontrol: Onay bekleniyor", () =>
    expect(cardTag(item({ stage: "kontrol", status: "teslim" }), emptyPerf(), rules, NOW).text).toBe("Onay bekleniyor"));
  it("Organik 72 saat doldu · önde", () =>
    expect(
      cardTag(item({ stage: "organik", status: "onaylandi", igPublishedAt: "2026-11-06T09:00:00Z" }), emptyPerf(), rules, NOW, "önde").text,
    ).toBe("72 saat doldu · önde"));
  it("Testte: durdurma kuralı tuttu", () =>
    expect(cardTag(item({ stage: "test", status: "onaylandi" }), STOP, rules, NOW)).toEqual({ text: "Durdurma kuralı tuttu", tone: "bad" }));
  it("Testte: kazandı", () =>
    expect(cardTag(item({ stage: "test", status: "onaylandi" }), WIN, rules, NOW)).toEqual({ text: "Kazandı · büyütülmeye hazır", tone: "ok" }));
  it("Testte: veri toplanıyor", () =>
    expect(cardTag(item({ stage: "test", status: "onaylandi" }), EARLY, rules, NOW).text).toBe("Veri toplanıyor · 3 nitelikli daha"));
});

describe("groupByStage", () => {
  it("altı sütun, kartlar kendi aşamasında", () => {
    const cols = groupByStage([item({ code: "R-2646-A" }), item({ code: "S-2646-G", stage: "test" })]);
    expect(cols.map((c) => c.key)).toEqual(["gorev", "kontrol", "organik", "test", "kazanan", "arsiv"]);
    expect(cols[0].items.map((i) => i.code)).toEqual(["R-2646-A"]);
    expect(cols[3].items.map((i) => i.code)).toEqual(["S-2646-G"]);
  });
});

describe("chunk", () => {
  it("listeyi en çok n elemanlı parçalara böler", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});

describe("fetchAllPages", () => {
  it("kısa sayfa gelene kadar .range() ile okur", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => i);
    const calls: [number, number][] = [];
    const out = await fetchAllPages<number>(async (from, to) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    }, 2);
    expect(out).toEqual(rows);
    expect(calls).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it("hata fırlatır", async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: { message: "x" } }))).rejects.toThrow("x");
  });
});

describe("perfCodes", () => {
  it("paylaşım saati bilinmiyorsa organik kart 72 saat dolduğunu söylemez", () => {
    const i = item({ stage: "organik", status: "onaylandi", stageChangedAt: "2026-11-01T09:00:00Z", igPublishedAt: null });
    expect(cardTag(i, emptyPerf(), rules, NOW).text).toBe("Paylaşım saati bekleniyor");
    expect(adviceFor(i, emptyPerf(), rules, NOW).action.kind).toBe("none");
  });

  it("yalnız organik, test, kazanan ve arşiv kodları", () => {
    const codes = perfCodes([
      item({ code: "R-2646-A", stage: "gorev" }),
      item({ code: "S-2646-G", stage: "kontrol" }),
      item({ code: "R-2645-A", stage: "organik" }),
      item({ code: "R-2643-B", stage: "test" }),
      item({ code: "R-2641-A", stage: "kazanan" }),
      item({ code: "R-2638-A", stage: "arsiv" }),
    ]);
    expect(codes).toEqual(["R-2645-A", "R-2643-B", "R-2641-A", "R-2638-A"]);
  });
});

describe("stopRuleHit", () => {
  it("hedef 0 ya da altıysa kural tutmaz", () => {
    expect(stopRuleHit(emptyPerf(), { ...rules, targetTl: 0 })).toBe(false);
    expect(stopRuleHit(STOP, rules)).toBe(true);
  });
});

describe("loadContentPerf", () => {
  type Call = { table: string; in: unknown[]; range: [number, number] | null };
  function fake(tables: Record<string, unknown[]>, calls: Call[]) {
    return {
      from(table: string) {
        const call: Call = { table, in: [], range: null };
        calls.push(call);
        const q = {
          select: () => q,
          order: () => q,
          in: (_col: string, values: unknown[]) => {
            call.in = values;
            return q;
          },
          range: (from: number, to: number) => {
            call.range = [from, to];
            return q;
          },
          then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
            const codes = new Set(call.in);
            const rows = (tables[table] ?? []).filter((r) => codes.has((r as { content_code: string }).content_code));
            const [f, t] = call.range ?? [0, rows.length];
            resolve({ data: rows.slice(f, t + 1), error: null });
          },
        };
        return q;
      },
    };
  }

  it("harcamayı mikrodan kuruşa, velileri ve randevuya döneni koda göre toplar", async () => {
    const calls: Call[] = [];
    const supabase = fake(
      {
        ad_spend_daily: [
          { content_code: "R-2643-B", cost_micros: 2_000_000_000, clicks: 100, platform_results: 4 },
          { content_code: "R-2643-B", cost_micros: 1_150_000_000, clicks: 112, platform_results: null },
        ],
        leads: [
          { id: "l1", content_code: "R-2643-B", is_qualified: false, appointments: [{ outcome: "iptal" }] },
          { id: "l2", content_code: "R-2643-B", is_qualified: true, appointments: [{ outcome: "bekliyor" }, { outcome: "geldi" }] },
        ],
      },
      calls,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = await loadContentPerf(supabase as any, ["R-2643-B", "S-2646-G"]);
    expect(map.get("R-2643-B")).toEqual({
      spendKurus: 315_000, clicks: 212, platformResults: 4, leads: 2, qualified: 1, appointments: 1,
    });
    expect(map.get("S-2646-G")).toEqual(emptyPerf());
    expect(calls.every((c) => c.range !== null)).toBe(true);
  });

  it("kod listesini 100'lük parçalarla sorar", async () => {
    const calls: Call[] = [];
    const codes = Array.from({ length: 250 }, (_, i) => `R-26${String(i).padStart(2, "0")}-A`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await loadContentPerf(fake({}, calls) as any, codes);
    const spendCalls = calls.filter((c) => c.table === "ad_spend_daily");
    expect(spendCalls.map((c) => c.in.length)).toEqual([100, 100, 50]);
    expect(calls.every((c) => c.in.length <= 100)).toBe(true);
  });
});

describe("canConfirmFace", () => {
  it("video adresi yoksa, yüklenmediyse ya da oynatılamadıysa kutu kapalı", () => {
    expect(canConfirmFace(null, "hazir")).toBe(false);
    expect(canConfirmFace("https://x/v.mp4", "yukleniyor")).toBe(false);
    expect(canConfirmFace("https://x/v.mp4", "oynatilamadi")).toBe(false);
  });
  it("video yüklenince kutu açılır", () => {
    expect(canConfirmFace("https://x/v.mp4", "hazir")).toBe(true);
  });
});
