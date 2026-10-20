import { describe, expect, it } from "vitest";
import { mergePatch, tabLabel, visibleTasks } from "@/lib/content/task-flow";

const t = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: "reels" as const, header: `R-2646-${id}`, status: "taslak", ...over,
});

describe("visibleTasks", () => {
  it("teslim edilen görev sunucudan düşse de teşekkür ekranı için tutulur", () => {
    const held = { a: t("a", { status: "teslim" }) };
    const out = visibleTasks([t("b")], held, { a: ["x"] });
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("sunucuda hâlâ varsa çift eklenmez", () => {
    expect(visibleTasks([t("a")], { a: t("a") }, { a: ["x"] }).map((x) => x.id)).toEqual(["a"]);
  });
  it("Tamam'dan sonra (done kaydı yok) görünmez", () => {
    expect(visibleTasks([], { a: t("a") }, {})).toEqual([]);
  });
});

describe("mergePatch", () => {
  it("başarısız yama geri konur, daha yeni yazı üstün gelir", () => {
    expect(mergePatch({ caption: "eski", pageFields: { baslik: "x" } }, { caption: "yeni" })).toEqual({
      caption: "yeni",
      pageFields: { baslik: "x" },
    });
  });
  it("bekleyen yoksa başarısız yama kalır", () => {
    expect(mergePatch({ caption: "a" }, {})).toEqual({ caption: "a" });
  });
});

describe("tabLabel", () => {
  it("tür adı; düzeltme varsa işaret", () => {
    expect(tabLabel(t("a"), 1)).toBe("Reels görevi");
    expect(tabLabel(t("a", { kind: "sayfa" }), 1)).toBe("Sayfa görevi");
    expect(tabLabel(t("a", { status: "duzeltme" }), 1)).toBe("Reels görevi · düzeltme");
  });
  it("aynı türden çok varsa kod", () => {
    expect(tabLabel({ ...t("a"), header: "R-2646-A · Reels" }, 2)).toBe("R-2646-A");
  });
});
