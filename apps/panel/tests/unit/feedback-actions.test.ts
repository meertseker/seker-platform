import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionProfile = vi.fn();
const revalidatePath = vi.fn();
const insert = vi.fn();
const select = vi.fn();
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ insert, update }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));

import { createFeedback, updateFeedbackStatus } from "@/actions/feedback";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const valid = { kind: "hata", title: "Takvim açılmıyor", body: "Takvime tıklayınca beyaz ekran geliyor", page: "Takvim" };

describe("createFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfile.mockResolvedValue({ id: "u1", role: "danisman" });
    insert.mockResolvedValue({ error: null });
  });

  it("geçerli girdiyi kullanıcı kimliğiyle ekler ve sayfayı tazeler", async () => {
    expect(await createFeedback(valid)).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("feedback");
    expect(insert).toHaveBeenCalledWith({ kind: "hata", title: "Takvim açılmıyor", body: valid.body, page: "Takvim", created_by: "u1" });
    expect(revalidatePath).toHaveBeenCalledWith("/geri-bildirim");
  });

  it("boş ekran alanını null yapar, kırpar", async () => {
    await createFeedback({ ...valid, title: "  Başlık  ", page: "   " });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title: "Başlık", page: null }));
  });

  it("geçersiz girdiyi Türkçe hatayla reddeder, yazmaz", async () => {
    const short = await createFeedback({ ...valid, title: "ab" });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error).toMatch(/başlık/i);
    expect((await createFeedback({ ...valid, kind: "x" })).ok).toBe(false);
    expect((await createFeedback({ ...valid, body: "   " })).ok).toBe(false);
    expect((await createFeedback({ ...valid, body: "a".repeat(4001) })).ok).toBe(false);
    expect((await createFeedback(null)).ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("veritabanı hatasında ve istisnada fırlatmaz", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    expect(await createFeedback(valid)).toEqual({ ok: false, error: "Geri bildiriminiz gönderilemedi, lütfen tekrar deneyin" });
    insert.mockRejectedValue(new Error("net"));
    expect((await createFeedback(valid)).ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateFeedbackStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfile.mockResolvedValue({ id: "y1", role: "yonetici" });
    select.mockResolvedValue({ data: [{ id: ID }], error: null });
  });

  it("yönetici olmayanı reddeder", async () => {
    getSessionProfile.mockResolvedValue({ id: "d", role: "danisman" });
    expect(await updateFeedbackStatus({ id: ID, status: "tamamlandi", adminNote: "" })).toEqual({
      ok: false,
      error: "Bu işlem için yönetici yetkisi gerekir",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("durum ve notu günceller", async () => {
    expect(await updateFeedbackStatus({ id: ID, status: "inceleniyor", adminNote: " Bakıyoruz " })).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ status: "inceleniyor", admin_note: "Bakıyoruz" });
    expect(eq).toHaveBeenCalledWith("id", ID);
    expect(revalidatePath).toHaveBeenCalledWith("/geri-bildirim");
  });

  it("boş notu null yapar", async () => {
    await updateFeedbackStatus({ id: ID, status: "yeni", adminNote: "  " });
    expect(update).toHaveBeenCalledWith({ status: "yeni", admin_note: null });
  });

  it("geçersiz kimlik, durum ve uzun notu reddeder", async () => {
    expect((await updateFeedbackStatus({ id: "x", status: "yeni", adminNote: "" })).ok).toBe(false);
    expect((await updateFeedbackStatus({ id: ID, status: "bilinmez", adminNote: "" })).ok).toBe(false);
    expect((await updateFeedbackStatus({ id: ID, status: "yeni", adminNote: "a".repeat(2001) })).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("satır güncellenmediyse Türkçe hata verir; istisnada fırlatmaz", async () => {
    select.mockResolvedValue({ data: [], error: null });
    expect(await updateFeedbackStatus({ id: ID, status: "yeni", adminNote: "" })).toEqual({ ok: false, error: "Kayıt bulunamadı" });
    select.mockRejectedValue(new Error("net"));
    expect((await updateFeedbackStatus({ id: ID, status: "yeni", adminNote: "" })).ok).toBe(false);
  });
});
