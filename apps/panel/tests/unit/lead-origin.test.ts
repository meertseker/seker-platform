import { describe, it, expect } from "vitest";
import { originLines, type LeadOrigin } from "@/lib/lead-attribution";
import { fillTemplate } from "@/lib/lead-flow/template";
import { buildFollowupTimeline, type TimelineInput } from "@/lib/lead-flow/timeline";
import { formatDayTime } from "@/lib/lead-flow/business-hours";

const NOW = new Date("2026-11-03T10:00:00+03:00");

const base: LeadOrigin = {
  channel: null, content_code: null, source: "diger", gclid: null, landing_path: null,
  district: null, start_window: null, child_birth_month: null, child_birth_year: null, wants_whatsapp: null,
};

describe("originLines", () => {
  it("Instagram mesajı + Reels kodu için etiketleri döner", () => {
    expect(originLines({ ...base, channel: "ig_dm", source: "instagram", content_code: "R-2645-A" }, NOW)).toEqual({
      channelLabel: "Instagram mesajı",
      codeLabel: "R-2645-A · Reels",
      answers: [],
    });
  });

  it("sayfa kodu ve diğer kanallar", () => {
    expect(originLines({ ...base, channel: "form", content_code: "S-2645-G" }, NOW).codeLabel).toBe("S-2645-G · sayfa");
    expect(originLines({ ...base, channel: "ig_yorum" }, NOW).channelLabel).toBe("Instagram yorumu");
    expect(originLines({ ...base, channel: "whatsapp" }, NOW).channelLabel).toBe("WhatsApp");
    expect(originLines({ ...base, channel: "telefon" }, NOW).channelLabel).toBe("Telefon");
  });

  it("Google velisi için landing path'i yazar", () => {
    const r = originLines({ ...base, channel: "form", source: "reklam", gclid: "Cj0", landing_path: "/lp/beykent" }, NOW);
    expect(r.channelLabel).toBe("Google · /lp/beykent");
  });

  it("sayfa formu cevaplarını sırayla yazar", () => {
    const r = originLines(
      {
        ...base, channel: "form", source: "web_sitesi", district: "Beykent", start_window: "1_3_ay",
        child_birth_month: 3, child_birth_year: 2022, wants_whatsapp: true,
      },
      NOW,
    );
    expect(r.channelLabel).toBe("Sayfa formu");
    expect(r.codeLabel).toBeNull();
    expect(r.answers).toEqual(["4 yaş (Mart 2022)", "Beykent", "1–3 ay içinde", "\"WhatsApp'tan yazın\""]);
  });

  it("kanalı olmayan eski velide kaynak etiketine düşer", () => {
    expect(originLines({ ...base, source: "referans" }, NOW).channelLabel).toBe("Referans");
  });
});

describe("fillTemplate", () => {
  it("yer tutucuları doldurur, bilinmeyeni bırakır", () => {
    expect(fillTemplate("Merhaba {veli}, ben {danisman}. {x}", { veli: "Elif Hanım", danisman: "Zehra" })).toBe(
      "Merhaba Elif Hanım, ben Zehra. {x}",
    );
  });
});

const T = (n: number, status: string, due: string, created = "2026-11-02T07:00:00Z") => ({
  ruleKey: `takip:L1:${n}`, status, dueAt: due, createdAt: created,
});
const input = (over: Partial<TimelineInput>): TimelineInput => ({
  leadId: "L1", status: "yeni", lostReason: null, firstContactAt: null, lastReachAt: null, tasks: [], ...over,
});

describe("buildFollowupTimeline", () => {
  it("hiç aranmamış veli: 1. arama şimdi, gerisi sırada", () => {
    const t = buildFollowupTimeline(input({}));
    expect(t.state).toBe("active");
    if (t.state !== "active") return;
    expect(t.steps.map((s) => s.state)).toEqual(["now", "next", "next", "next", "next", "next", "next"]);
    expect(t.steps[2].sub).toBe("Ertesi gün 10:00");
    expect(t.steps[6].title).toBe("Kapanır: Ulaşılamadı");
  });

  it("bir başarısız denemeden sonra: 1 yapıldı, 2. deneme şimdi ve planlanan saat", () => {
    const first = "2026-11-03T07:00:00Z";
    const due = "2026-11-03T10:00:00Z";
    const t = buildFollowupTimeline(input({ firstContactAt: first, tasks: [T(2, "acik", due, first)] }));
    expect(t.state).toBe("active");
    if (t.state !== "active") return;
    expect(t.steps.map((s) => s.state)).toEqual(["done", "now", "next", "next", "next", "next", "next"]);
    expect(t.steps[0].sub).toBe(`${formatDayTime(new Date(first))} · açmadı`);
    expect(t.steps[1].title).toBe("2. deneme · şimdi");
    expect(t.steps[1].sub).toBe(formatDayTime(new Date(due)));
    expect(t.nextAttemptAt).toBe(due);
  });

  it("ilk aramada sıradaki deneme saati yoktur (Açmadı hep açık)", () => {
    const t = buildFollowupTimeline(input({}));
    if (t.state !== "active") throw new Error(t.state);
    expect(t.nextAttemptAt).toBeNull();
  });

  it("kapanan görevler yapıldı sayılır, açık olan şimdi", () => {
    const t = buildFollowupTimeline(
      input({
        firstContactAt: "2026-11-02T07:00:00Z",
        tasks: [T(2, "tamamlandi", "2026-11-02T10:00:00Z"), T(3, "acik", "2026-11-03T07:00:00Z")],
      }),
    );
    if (t.state !== "active") throw new Error(t.state);
    expect(t.steps.map((s) => s.state)).toEqual(["done", "done", "now", "next", "next", "next", "next"]);
    expect(t.steps[1].sub).toBe(`${formatDayTime(new Date("2026-11-02T10:00:00Z"))} · açmadı`);
  });

  it("7 günde ulaşılamadı: kapandı; kontenjan görevi varsa belirtilir", () => {
    const tasks = [2, 3, 4, 5, 6].map((n) => T(n, "tamamlandi", "2026-11-02T10:00:00Z"));
    const closed = input({ status: "kaybedildi", lostReason: "ulasilamadi", firstContactAt: "2026-10-27T07:00:00Z", tasks });
    const a = buildFollowupTimeline(closed);
    expect(a).toMatchObject({ state: "closed", kontenjanPlanned: false });
    if (a.state === "closed") expect(a.steps.every((s) => s.state === "done")).toBe(true);
    const kontenjan = { ruleKey: "kontenjan:L1", status: "acik", dueAt: "2026-12-03T07:00:00Z", createdAt: "2026-11-03T07:00:00Z" };
    const b = buildFollowupTimeline({ ...closed, tasks: [...tasks, kontenjan] });
    expect(b).toMatchObject({ state: "closed", kontenjanPlanned: true });
    // Gönderilmiş (kapanmış) kontenjan görevi için gelecek zaman cümlesi yazılmaz.
    const c = buildFollowupTimeline({ ...closed, tasks: [...tasks, { ...kontenjan, status: "tamamlandi" }] });
    expect(c).toMatchObject({ state: "closed", kontenjanPlanned: false });
  });

  it("başka nedenle kaybedilen ya da bekleyen velide gizlenir", () => {
    expect(buildFollowupTimeline(input({ status: "kaybedildi", lostReason: "fiyat" })).state).toBe("hidden");
    expect(buildFollowupTimeline(input({ status: "kaybedildi", lostReason: "ulasilamadi" })).state).toBe("hidden");
    expect(buildFollowupTimeline(input({ status: "beklemede" })).state).toBe("hidden");
  });

  it("ulaşılan velide takip durdu", () => {
    expect(buildFollowupTimeline(input({ status: "randevu", firstContactAt: "2026-11-02T07:00:00Z" })).state).toBe("stopped");
    expect(
      buildFollowupTimeline(input({
        status: "ulasildi", firstContactAt: "2026-11-02T07:00:00Z", lastReachAt: "2026-11-02T08:00:00Z",
        tasks: [T(2, "tamamlandi", "2026-11-02T10:00:00Z", "2026-11-02T07:00:00Z")],
      })).state,
    ).toBe("stopped");
    // Randevu verilmiş ama takip görevi elle açık kalmış: yine durdu.
    expect(buildFollowupTimeline(input({ status: "randevu", tasks: [T(2, "acik", "2026-11-03T10:00:00Z")] })).state).toBe("stopped");
  });

  it("ulaşıldıktan sonra yeni ulaşılamadı sırası baştan sayılır", () => {
    const t = buildFollowupTimeline(input({
      status: "ulasildi", firstContactAt: "2026-10-20T07:00:00Z", lastReachAt: "2026-10-21T07:00:00Z",
      tasks: [
        T(2, "tamamlandi", "2026-10-20T10:00:00Z", "2026-10-20T07:00:00Z"),
        T(2, "acik", "2026-11-03T10:00:00Z", "2026-11-03T07:00:00Z"),
      ],
    }));
    if (t.state !== "active") throw new Error(t.state);
    expect(t.steps.map((s) => s.state).slice(0, 3)).toEqual(["done", "now", "next"]);
    expect(t.steps[0].sub).toBe(`${formatDayTime(new Date("2026-11-03T07:00:00Z"))} · açmadı`);
  });
});
