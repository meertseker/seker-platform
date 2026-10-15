import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionProfile = vi.fn();
const upsertSpend = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({}) }));
vi.mock("@/lib/ads/store", () => ({ supabaseAdsStore: () => ({ upsertSpend }) }));

import { importSpendCsv } from "@/actions/marketing";

const HEADER = "Gün,Kampanya kimliği,Kampanya,Maliyet,Tıklamalar,Gösterimler";

function formWith(content: string, name = "rapor.csv"): FormData {
  const fd = new FormData();
  fd.append("file", new File([content], name, { type: "text/csv" }));
  return fd;
}

describe("importSpendCsv", () => {
  beforeEach(() => {
    getSessionProfile.mockReset();
    upsertSpend.mockReset();
    revalidatePath.mockReset();
    getSessionProfile.mockResolvedValue({ id: "a", role: "yonetici" });
    upsertSpend.mockResolvedValue(undefined);
  });

  it("yönetici olmayan kullanıcıyı CSV işlemeden reddeder", async () => {
    getSessionProfile.mockResolvedValue({ id: "d", role: "danisman" });
    const res = await importSpendCsv(formWith(`${HEADER}\n2026-10-12,555,A,\"10,00\",1,2`));
    expect(res.ok).toBe(false);
    expect(upsertSpend).not.toHaveBeenCalled();
  });

  it("geçerli CSV'yi yazar ve kayıt sayısını döner", async () => {
    const res = await importSpendCsv(formWith(`${HEADER}\n2026-10-12,555,A,\"10,00\",1,2`));
    expect(res).toEqual({ ok: true, count: 1, warnings: [] });
    expect(upsertSpend).toHaveBeenCalledWith([
      { date: "2026-10-12", campaignId: "555", campaignName: "A", costMicros: 10000000, clicks: 1, impressions: 2 },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/pazarlama");
  });

  it("CSV olmayan uzantıyı reddeder", async () => {
    const res = await importSpendCsv(formWith(`${HEADER}`, "rapor.exe"));
    expect(res.ok).toBe(false);
    expect(upsertSpend).not.toHaveBeenCalled();
  });

  it("2 MB'tan büyük dosyayı reddeder", async () => {
    const big = `${HEADER}\n` + "x".repeat(2 * 1024 * 1024 + 1);
    const res = await importSpendCsv(formWith(big));
    expect(res).toEqual({ ok: false, error: "Dosya 2 MB'tan büyük olamaz" });
  });

  it("yazma hatasında fırlatmadan Türkçe hata döner", async () => {
    upsertSpend.mockRejectedValue(new Error("secret db detail"));
    const res = await importSpendCsv(formWith(`${HEADER}\n2026-10-12,555,A,\"10,00\",1,2`));
    expect(res).toEqual({ ok: false, error: "CSV içe aktarılamadı, lütfen tekrar deneyin" });
  });

  it("oturum yönlendirmesini (NEXT_REDIRECT) yutmaz", async () => {
    const redirectErr = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    getSessionProfile.mockRejectedValue(redirectErr);
    await expect(importSpendCsv(formWith(HEADER))).rejects.toBe(redirectErr);
  });
});
