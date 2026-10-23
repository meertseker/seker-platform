import { describe, expect, it } from "vitest";
import { archiveSummary, buildTimeline, statusPill, type MyContentItem } from "@/lib/queries/my-content";

const NOW = new Date("2026-10-23T09:00:00+03:00");

const reels: MyContentItem = {
  id: "c1",
  code: "R-2644-A",
  kind: "reels",
  platform: "instagram",
  topic: "İlk gün uyumu",
  status: "onaylandi",
  stage: "test",
  submittedAt: "2026-10-15T16:40:00+03:00",
  approvedAt: "2026-10-16T09:12:00+03:00",
  igPublishedAt: "2026-10-16T09:31:00+03:00",
  stageChangedAt: "2026-10-19T10:05:00+03:00",
  learnedNote: null,
  page: null,
  summary: {
    contentId: "c1",
    leads: 7,
    appointments: 2,
    enrolled: 0,
    lastSyncAt: "2026-10-23T06:02:00+03:00",
    approvedByName: "Zehra",
  },
};

const page: MyContentItem = {
  ...reels,
  id: "c2",
  code: "S-2644-I",
  kind: "sayfa",
  topic: "İlk hafta uyum programı",
  igPublishedAt: null,
  page: { slug: "ilk-hafta-uyum", status: "yayinda", publishedAt: "2026-10-17T11:00:00+03:00" },
  summary: { ...reels.summary!, contentId: "c2", leads: 0, appointments: 0 },
};

describe("buildTimeline", () => {
  it("onaylanmış ve testteki Reels olay sırası", () => {
    const events = buildTimeline(reels, NOW);
    expect(events.map((e) => e.title)).toEqual([
      "Teslim ettin",
      "Zehra onayladı",
      "Instagram'da yayınlandı",
      "Reklam testine girdi",
      "7 veli aradı, 2 randevu verdi",
    ]);
    expect(events.slice(0, 4).every((e) => e.tone === "done")).toBe(true);
    const last = events[events.length - 1];
    expect(last.tone).toBe("now");
    expect(last.detail).toMatch(/^Reklamdan senin içeriğinle gelenler\. Güncellendi: /);
    expect(events[0].detail).toMatch(/16:40$/);
  });

  it("kayıt varsa son satır kayıtla biter", () => {
    const events = buildTimeline({ ...reels, summary: { ...reels.summary!, enrolled: 1 } }, NOW);
    expect(events[events.length - 1].title.endsWith(", 1 kayıt oldu")).toBe(true);
  });

  it("özet yoksa sayı satırı yok", () => {
    const events = buildTimeline({ ...reels, summary: null }, NOW);
    expect(events.some((e) => e.tone === "now")).toBe(false);
    expect(events).toHaveLength(4);
  });

  it("onaylayan adı yoksa Onaylandı", () => {
    const events = buildTimeline({ ...reels, summary: { ...reels.summary!, approvedByName: null } }, NOW);
    expect(events[1].title).toBe("Onaylandı");
  });

  it("son eşitleme yoksa yalnız ilk cümle", () => {
    const events = buildTimeline({ ...reels, summary: { ...reels.summary!, lastSyncAt: null } }, NOW);
    expect(events[events.length - 1].detail).toBe("Reklamdan senin içeriğinle gelenler.");
  });

  it("yayındaki sayfa", () => {
    const events = buildTimeline(page, NOW);
    const live = events.find((e) => e.title === "Sayfa yayına girdi");
    expect(live?.detail).toBe("/lp/ilk-hafta-uyum");
    expect(events.some((e) => e.title === "Reklam testine girdi")).toBe(false);
    expect(events[events.length - 1].title).toBe("Henüz bu içerikten veli gelmedi");
  });

  it("arşivdeki sayfa: yayına girdi ve arşive alındı satırları", () => {
    const archived = { ...page, page: { ...page.page!, status: "arsiv" as const } };
    const titles = buildTimeline(archived, NOW).map((e) => e.title);
    expect(titles).toContain("Sayfa yayına girdi");
    expect(titles.indexOf("Sayfa arşive alındı")).toBe(titles.indexOf("Sayfa yayına girdi") + 1);
    expect(buildTimeline(page, NOW).map((e) => e.title)).not.toContain("Sayfa arşive alındı");
  });

  it("teslimde bekleyen içerikte sayı satırı yok", () => {
    const events = buildTimeline(
      { ...reels, status: "teslim", stage: "kontrol", approvedAt: null, igPublishedAt: null, summary: { ...reels.summary!, leads: 0 } },
      NOW,
    );
    expect(events.map((e) => e.title)).toEqual(["Teslim ettin"]);
  });

  it("bugünkü saat Bugün diye yazılır", () => {
    const events = buildTimeline({ ...reels, submittedAt: "2026-10-23T08:20:00+03:00" }, NOW);
    expect(events[0].detail).toBe("Bugün 08:20");
  });

  it("kazanan ve arşiv", () => {
    expect(buildTimeline({ ...reels, stage: "kazanan" }, NOW).map((e) => e.title)).toContain("Büyütmeye taşındı");
    expect(buildTimeline({ ...reels, stage: "arsiv" }, NOW).map((e) => e.title)).toContain("Arşive alındı");
  });

  it("hiçbir olayda para yok", () => {
    for (const item of [reels, page, { ...reels, stage: "kazanan" }, { ...reels, summary: { ...reels.summary!, enrolled: 3 } }]) {
      for (const e of buildTimeline(item, NOW)) {
        expect(`${e.title} ${e.detail ?? ""}`).not.toMatch(/TL|₺/);
      }
    }
  });
});

describe("statusPill", () => {
  it("durumlar", () => {
    expect(statusPill({ ...reels, status: "teslim", stage: "kontrol" })).toEqual({ text: "Onay bekliyor", tone: "warn" });
    expect(statusPill({ ...reels, status: "duzeltme", stage: "gorev" })).toEqual({ text: "Düzeltme istendi", tone: "warn" });
    expect(statusPill({ ...reels, stage: "organik" })).toEqual({ text: "Instagram'da", tone: "ok" });
    expect(statusPill({ ...page, page: { slug: null, status: "taslak", publishedAt: null } })).toEqual({
      text: "Yayın bekliyor",
      tone: "warn",
    });
    expect(statusPill({ ...page, page: null })).toEqual({ text: "Yayın bekliyor", tone: "warn" });
    expect(statusPill(page)).toEqual({ text: "Reklam testinde", tone: "ok" });
    expect(statusPill({ ...page, page: { ...page.page!, status: "arsiv" } })).toEqual({ text: "Arşivde", tone: "muted" });
    expect(statusPill(reels)).toEqual({ text: "Reklam testinde", tone: "ok" });
    expect(statusPill({ ...reels, stage: "kazanan" })).toEqual({ text: "Büyütmede", tone: "ok" });
    expect(statusPill({ ...reels, stage: "arsiv" })).toEqual({ text: "Arşivde", tone: "muted" });
    expect(statusPill({ ...reels, stage: "kontrol" })).toEqual({ text: "Onaylandı", tone: "ok" });
  });
});

describe("archiveSummary", () => {
  it("sayılar ya da tek cümle", () => {
    expect(archiveSummary({ ...reels, stage: "arsiv" })).toBe("7 veli aradı, 2 randevu verdi");
    expect(archiveSummary({ ...reels, stage: "arsiv", summary: null })).toBe("Arşive alındı");
  });
});
