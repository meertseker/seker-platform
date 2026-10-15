import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionProfile = vi.fn();
const rpc = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ rpc }) }));

import { setCanEditSite } from "@/actions/site-editors";

describe("setCanEditSite", () => {
  beforeEach(() => {
    getSessionProfile.mockReset();
    rpc.mockReset();
    getSessionProfile.mockResolvedValue({ id: "a", role: "yonetici" });
  });

  it("yönetici değilse RPC çağrılmadan reddeder", async () => {
    getSessionProfile.mockResolvedValue({ id: "a", role: "danisman" });
    const res = await setCanEditSite("u1", true);
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("42501 için yetki mesajı döner", async () => {
    rpc.mockResolvedValue({ error: { code: "42501" } });
    expect(await setCanEditSite("u1", true)).toEqual({
      ok: false,
      error: "Bu ayarı yalnızca yönetici değiştirebilir.",
    });
  });
  it("diğer hatada genel mesaj döner", async () => {
    rpc.mockResolvedValue({ error: { code: "XX000" } });
    expect(await setCanEditSite("u1", true)).toEqual({ ok: false, error: "Kaydedilemedi, tekrar deneyin." });
  });
  it("başarıda ok döner ve RPC doğru parametrelerle çağrılır", async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await setCanEditSite("u1", false)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_can_edit_site", { p_user: "u1", p_value: false });
  });
});
