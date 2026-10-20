import { describe, expect, it } from "vitest";
import { dueLabel, sortMyTasks, taskHeaderLabel, type MyTask } from "@/lib/queries/content";

function task(over: Partial<MyTask>): MyTask {
  return {
    id: "1", code: "R-2646-A", kind: "reels", platform: "instagram", topic: "t", audience: null, brief: null,
    dueAt: null, status: "taslak", caption: null, pageFields: {}, mediaPath: null, mediaMeta: null,
    faceAnswer: null, reviewNote: null, submittedAt: null, ...over,
  };
}

describe("taskHeaderLabel", () => {
  it("Reels", () => expect(taskHeaderLabel(task({}))).toBe("R-2646-A · Reels"));
  it("Google sayfası", () =>
    expect(taskHeaderLabel(task({ code: "S-2646-G", kind: "sayfa", platform: "google" }))).toBe("S-2646-G · Google sayfası"));
  it("Instagram sayfası", () =>
    expect(taskHeaderLabel(task({ code: "S-2646-I", kind: "sayfa", platform: "instagram" }))).toBe("S-2646-I · Instagram sayfası"));
});

describe("dueLabel", () => {
  it("Perşembe 17:00 (İstanbul)", () =>
    expect(dueLabel("2026-11-12T14:00:00Z", new Date("2026-11-10T10:00:00Z"))).toBe("Teslim: Perşembe 17:00"));
  it("tarih yoksa boş", () => expect(dueLabel(null, new Date())).toBe(""));
});

describe("sortMyTasks", () => {
  it("açıklar önce son tarihe göre, sonra teslim edilenler yeniden eskiye", () => {
    const out = sortMyTasks([
      task({ id: "teslim-eski", status: "teslim", submittedAt: "2026-10-01T10:00:00Z" }),
      task({ id: "acik-gec", status: "taslak", dueAt: "2026-11-12T14:00:00Z" }),
      task({ id: "teslim-yeni", status: "onaylandi", submittedAt: "2026-10-08T10:00:00Z" }),
      task({ id: "acik-erken", status: "duzeltme", dueAt: "2026-11-10T14:00:00Z" }),
      task({ id: "acik-tarihsiz", status: "taslak", dueAt: null }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["acik-erken", "acik-gec", "acik-tarihsiz", "teslim-yeni", "teslim-eski"]);
  });
});
