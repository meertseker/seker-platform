import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionProfile = vi.fn();
const revalidatePath = vi.fn();
const upsert = vi.fn();
const from = vi.fn(() => ({ upsert }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));

import { saveLeadLineSettings } from "@/actions/settings";
import { DEFAULT_CALL_SCRIPT, DEFAULT_PRICE_ANSWER, DEFAULT_TEMPLATES } from "@/lib/lead-flow/settings";

const valid = () => ({
  hours: { days: [1, 2, 3, 4, 5], start: "08:30", end: "18:00" },
  districts: ["Beykent", "Esenyurt"],
  callScript: DEFAULT_CALL_SCRIPT,
  priceAnswer: DEFAULT_PRICE_ANSWER,
  templates: DEFAULT_TEMPLATES.map((t) => ({ ...t })),
});

describe("saveLeadLineSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfile.mockResolvedValue({ id: "u1", role: "yonetici" });
    upsert.mockResolvedValue({ error: null });
  });

  it("danışman çağırırsa hata verir, yazmaz", async () => {
    getSessionProfile.mockResolvedValue({ id: "u2", role: "danisman" });
    const r = await saveLeadLineSettings(valid());
    expect("error" in r).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("geçersiz saati reddeder", async () => {
    const input = valid();
    input.hours.start = "25:00";
    const r = await saveLeadLineSettings(input);
    expect("error" in r && r.error).toMatch(/saat/i);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("başlangıç bitişten sonraysa reddeder", async () => {
    const input = valid();
    input.hours.start = "18:00";
    input.hours.end = "09:00";
    expect("error" in (await saveLeadLineSettings(input))).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("geçerli girdiyi app_settings'e upsert eder", async () => {
    expect(await saveLeadLineSettings(valid())).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("app_settings");
    const rows = upsert.mock.calls[0][0] as { key: string; value: unknown }[];
    expect(rows.map((r) => r.key).sort()).toEqual(
      ["arama_metni", "fiyat_cevabi", "mesai", "servis_semtleri", "wa_sablonlari"],
    );
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "key" });
    expect(revalidatePath).toHaveBeenCalledWith("/ayarlar");
    expect(revalidatePath).toHaveBeenCalledWith("/bugun");
    expect(revalidatePath).toHaveBeenCalledWith("/leads/[id]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/leads/[id]/ara", "page");
  });

  it("semtleri kırpar ve tekrarları atar", async () => {
    const input = valid();
    input.districts = [" Beykent ", "Beykent", "", "Esenyurt"];
    await saveLeadLineSettings(input);
    const rows = upsert.mock.calls[0][0] as { key: string; value: unknown }[];
    expect(rows.find((r) => r.key === "servis_semtleri")!.value).toEqual(["Beykent", "Esenyurt"]);
  });

  it("zorunlu şablon anahtarlarından biri eksikse reddeder", async () => {
    const input = valid();
    input.templates = input.templates.filter((t) => t.key !== "kontenjan");
    expect("error" in (await saveLeadLineSettings(input))).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("şablon anahtarlarını korur, boş metni reddeder", async () => {
    const input = valid();
    input.templates[0].text = "  ";
    expect("error" in (await saveLeadLineSettings(input))).toBe(true);
    const ok = valid();
    ok.templates[0].text = "Yeni {veli}";
    await saveLeadLineSettings(ok);
    const rows = upsert.mock.calls[0][0] as { key: string; value: { key: string; text: string }[] }[];
    const t = rows.find((r) => r.key === "wa_sablonlari")!.value;
    expect(t.map((x) => x.key)).toEqual(DEFAULT_TEMPLATES.map((x) => x.key));
    expect(t[0].text).toBe("Yeni {veli}");
  });

  it("konuşma sırası ve fiyat cevabı sınırlarını denetler", async () => {
    const a = valid(); a.callScript = [];
    const b = valid(); b.callScript = ["x".repeat(301)];
    const c = valid(); c.priceAnswer = " ";
    const d = valid(); d.priceAnswer = "x".repeat(501);
    for (const i of [a, b, c, d]) expect("error" in (await saveLeadLineSettings(i))).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("boş ve aralık dışı günleri reddeder", async () => {
    const a = valid(); a.hours.days = [];
    const b = valid(); b.hours.days = [0, 1];
    const c = valid(); c.hours.days = [1, 8];
    for (const i of [a, b, c]) expect("error" in (await saveLeadLineSettings(i))).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("30'dan fazla semti reddeder", async () => {
    const input = valid();
    input.districts = Array.from({ length: 31 }, (_, i) => `Semt ${i}`);
    expect("error" in (await saveLeadLineSettings(input))).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("1000 karakteri aşan şablon metnini reddeder", async () => {
    const input = valid();
    input.templates[1].text = "x".repeat(1001);
    expect("error" in (await saveLeadLineSettings(input))).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("boş şablon adını reddeder", async () => {
    const input = valid();
    input.templates[2].label = "  ";
    expect("error" in (await saveLeadLineSettings(input))).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });
});
