import { describe, it, expect, vi, beforeEach } from "vitest";

let role: "yonetici" | "danisman" | "ogretmen";
const upsert = vi.fn(async () => ({ error: null as unknown }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/auth", () => ({
  getSessionProfile: async () => ({ id: "u1", full_name: "x", role, can_edit_site: false }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from: () => ({ upsert }) }),
}));

import { saveSchoolInfo } from "@/actions/school-info";

beforeEach(() => {
  vi.clearAllMocks();
  role = "yonetici";
});

describe("saveSchoolInfo", () => {
  it("yalnız yönetici kaydeder", async () => {
    for (const r of ["danisman", "ogretmen"] as const) {
      role = r;
      expect(await saveSchoolInfo("Bahçe")).toEqual({ error: "Okul bilgilerini yalnızca yönetici değiştirebilir." });
    }
    expect(upsert).not.toHaveBeenCalled();
  });

  it("20.000 karakteri aşan metin reddedilir", async () => {
    expect(await saveSchoolInfo("x".repeat(20_001))).toEqual({ error: "Okul bilgileri en fazla 20.000 karakter olabilir." });
  });

  it("okul_bilgileri anahtarına kırpılmış metni yazar; boş metin de kaydedilir", async () => {
    expect(await saveSchoolInfo("  Geniş bahçe\nServis var  ")).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith({ key: "okul_bilgileri", value: { metin: "Geniş bahçe\nServis var" } }, { onConflict: "key" });
    expect(await saveSchoolInfo("")).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/ayarlar");
  });

  it("veritabanı hatası", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "x" } });
    expect(await saveSchoolInfo("a")).toEqual({ error: "Kaydedilemedi, tekrar deneyin." });
  });
});
