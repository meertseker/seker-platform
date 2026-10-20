import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionProfile = vi.fn();
const revalidatePath = vi.fn();
const is = vi.fn();
const eq2 = vi.fn(() => ({ is }));
const eq1 = vi.fn(() => ({ eq: eq2 }));
const update = vi.fn(() => ({ eq: eq1 }));
const from = vi.fn(() => ({ update }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/auth", () => ({ getSessionProfile: () => getSessionProfile() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from }) }));

import { markNotificationRead } from "@/actions/notifications";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("markNotificationRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionProfile.mockResolvedValue({ id: "u1" });
    is.mockResolvedValue({ error: null });
  });

  it("uuid olmayan id'yi DB'ye dokunmadan reddeder", async () => {
    const res = await markNotificationRead("abc");
    expect(res.error).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
    expect((await markNotificationRead(undefined as unknown as string)).error).toBeTruthy();
  });

  it("yalnızca kendi okunmamış bildirimini işaretler", async () => {
    expect(await markNotificationRead(ID)).toEqual({});
    expect(from).toHaveBeenCalledWith("notifications");
    expect(eq1).toHaveBeenCalledWith("id", ID);
    expect(eq2).toHaveBeenCalledWith("user_id", "u1");
    expect(is).toHaveBeenCalledWith("read_at", null);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("DB hatasında Türkçe hata döner", async () => {
    is.mockResolvedValue({ error: { message: "x" } });
    expect(await markNotificationRead(ID)).toEqual({ error: "Bildirim okundu işaretlenemedi" });
  });
});
