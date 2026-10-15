import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionProfile = vi.fn();
const revalidatePath = vi.fn();
const select = vi.fn();
const eqStatus = vi.fn(() => ({ select }));
const eqId = vi.fn(() => ({ eq: eqStatus }));
const update = vi.fn(() => ({ eq: eqId }));
const from = vi.fn(() => ({ update }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({ from }) }));

import { retryConversionUpload } from "@/actions/marketing";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("retryConversionUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfile.mockResolvedValue({ id: "a", role: "yonetici" });
    select.mockResolvedValue({ data: [{ id: ID }], error: null });
  });

  it("yönetici olmayanı reddeder, yazmaz", async () => {
    getSessionProfile.mockResolvedValue({ id: "d", role: "danisman" });
    const res = await retryConversionUpload(ID);
    expect(res.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("geçersiz kimliği reddeder", async () => {
    const res = await retryConversionUpload("x'; drop");
    expect(res).toEqual({ ok: false, error: "Geçersiz kayıt" });
    expect(from).not.toHaveBeenCalled();
  });

  it("yalnızca hata satırını bekliyor yapar (atlandi'ya dokunmaz)", async () => {
    const res = await retryConversionUpload(ID);
    expect(res).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ status: "bekliyor", error: null });
    expect(eqId).toHaveBeenCalledWith("id", ID);
    expect(eqStatus).toHaveBeenCalledWith("status", "hata");
    expect(revalidatePath).toHaveBeenCalledWith("/pazarlama");
  });

  it("hata durumunda olmayan satırda Türkçe hata döner", async () => {
    select.mockResolvedValue({ data: [], error: null });
    const res = await retryConversionUpload(ID);
    expect(res).toEqual({ ok: false, error: "Yalnızca hatalı kayıtlar tekrar denenebilir" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("veritabanı hatasında fırlatmaz", async () => {
    select.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await retryConversionUpload(ID)).toEqual({ ok: false, error: "Kayıt güncellenemedi" });
  });

  it("beklenmeyen istisnada fırlatmaz", async () => {
    select.mockRejectedValue(new Error("net"));
    expect(await retryConversionUpload(ID)).toEqual({ ok: false, error: "Kayıt güncellenemedi" });
  });
});
