import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Görev ver: yuva → tür/harf eşlemesi, hafta denetimi ve createContentTask'ın yeniden kullanımı.
type Me = { id: string; full_name: string; role: "yonetici" | "danisman" | "ogretmen"; can_edit_site: boolean };
let me: Me;
const requireRole = vi.fn(async (...roles: string[]) => {
  if (!roles.includes(me.role)) throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
  return me;
});
const createContentTask = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/auth", () => ({ requireRole: (...r: string[]) => requireRole(...r) }));
vi.mock("@/actions/content", () => ({ createContentTask: (i: unknown) => createContentTask(i) }));

import { assignContentTasks } from "@/actions/task-assign";
import { allowedTaskWeeks, defaultTaskDue } from "@/lib/content/slots";

const DAN: Me = { id: "00000000-0000-0000-0000-000000000002", full_name: "Zehra Hanım", role: "danisman", can_edit_site: false };
const OGR: Me = { id: "00000000-0000-0000-0000-000000000004", full_name: "Rüya Yılmaz", role: "ogretmen", can_edit_site: false };
const TEACHER = OGR.id;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T10:00:00+03:00")); // Çarşamba
  me = DAN;
  let n = 0;
  createContentTask.mockImplementation(async () => ({ id: `id-${++n}`, code: `R-2643-${n}`, waLink: null }));
});
afterEach(() => vi.useRealTimers());

describe("allowedTaskWeeks", () => {
  it("bu haftanın ve gelecek haftanın Pazartesi'si", () => {
    expect(allowedTaskWeeks(new Date("2026-10-21T10:00:00+03:00"))).toEqual(["2026-10-19", "2026-10-26"]);
    // Pazar gecesi İstanbul'da hâlâ önceki hafta.
    expect(allowedTaskWeeks(new Date("2026-10-25T23:30:00+03:00"))).toEqual(["2026-10-19", "2026-10-26"]);
  });
});

describe("defaultTaskDue", () => {
  it("haftanın Perşembesi 17:00; geçtiyse yarın 17:00", () => {
    expect(defaultTaskDue("2026-10-19", new Date("2026-10-21T10:00:00+03:00"))).toBe("2026-10-22T17:00");
    expect(defaultTaskDue("2026-10-26", new Date("2026-10-21T10:00:00+03:00"))).toBe("2026-10-29T17:00");
    expect(defaultTaskDue("2026-10-19", new Date("2026-10-23T09:00:00+03:00"))).toBe("2026-10-24T17:00");
  });
});

describe("assignContentTasks", () => {
  it("öğretmen çağıramaz", async () => {
    me = OGR;
    await expect(assignContentTasks({ weekStart: "2026-10-19", tasks: [] })).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledWith("yonetici", "danisman");
    expect(createContentTask).not.toHaveBeenCalled();
  });

  it("geçmiş ya da uzak hafta reddedilir", async () => {
    for (const weekStart of ["2026-10-12", "2026-11-02", "2026-10-20", "x"]) {
      expect(await assignContentTasks({ weekStart, tasks: [] })).toEqual({ error: "Hafta geçersiz." });
    }
    expect(createContentTask).not.toHaveBeenCalled();
  });

  it("her yuva createContentTask'a doğru tür, harf ve haftayla gider", async () => {
    const res = await assignContentTasks({
      weekStart: "2026-10-26",
      tasks: [
        { slot: "reels_b", ownerId: TEACHER, topic: "Bahçe saati", brief: "Neden bu hafta", dueAt: "2026-10-29T17:00" },
        { slot: "sayfa_instagram", ownerId: TEACHER, topic: "Servis", dueAt: "2026-10-29T17:00" },
      ],
    });
    expect(createContentTask).toHaveBeenNthCalledWith(1, {
      kind: "reels", reelsLetter: "B", pagePlatform: undefined, ownerId: TEACHER,
      topic: "Bahçe saati", brief: "Neden bu hafta", dueAt: "2026-10-29T17:00", weekOf: "2026-10-26",
    });
    expect(createContentTask).toHaveBeenNthCalledWith(2, expect.objectContaining({
      kind: "sayfa", pagePlatform: "instagram", reelsLetter: undefined, weekOf: "2026-10-26",
    }));
    expect(res).toEqual({
      ok: true,
      created: [
        { slot: "reels_b", code: "R-2643-1", waLink: null },
        { slot: "sayfa_instagram", code: "R-2643-2", waLink: null },
      ],
      errors: [],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/reklam/gorev-ver");
  });

  it("bir yuvanın hatası diğerlerini durdurmaz; tanınmayan ve çift yuva yok sayılır", async () => {
    createContentTask.mockImplementationOnce(async () => ({ error: "Bu hafta için Reels A görevi zaten açık" }));
    const res = await assignContentTasks({
      weekStart: "2026-10-19",
      tasks: [
        { slot: "reels_a", ownerId: TEACHER, topic: "A", dueAt: "2026-10-23T17:00" },
        { slot: "reels_a", ownerId: TEACHER, topic: "A2", dueAt: "2026-10-23T17:00" },
        { slot: "reels_c" as never, ownerId: TEACHER, topic: "C", dueAt: "2026-10-23T17:00" },
        { slot: "sayfa_google", ownerId: TEACHER, topic: "G", dueAt: "2026-10-23T17:00" },
      ],
    });
    expect(createContentTask).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({
      ok: true,
      errors: [{ slot: "reels_a", error: "Bu hafta için Reels A görevi zaten açık" }],
      created: [{ slot: "sayfa_google" }],
    });
  });

  it("görev listesi boşsa hata", async () => {
    expect(await assignContentTasks({ weekStart: "2026-10-19", tasks: [] })).toEqual({ error: "Gönderilecek görev yok." });
  });
});
