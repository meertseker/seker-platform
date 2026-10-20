import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Oturum middleware'i: düşürülen oturum /login'e nedenle gider (B7).
const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims: () => getClaims() } }) }));
vi.mock("@seker/auth/cookie", () => ({ authCookieOptions: () => ({ path: "/" }) }));

import { updateSession } from "@/lib/supabase/middleware";

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3001${path}`, { headers: cookie ? { cookie } : {} });
}

const location = (res: Response) => res.headers.get("location");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dummy";
});

describe("updateSession", () => {
  it("çerezli istekte oturum bulunamıyorsa /login?neden=baska-cihaz", async () => {
    getClaims.mockResolvedValue({ data: null, error: { code: "session_not_found", message: "x" } });
    const res = await updateSession(request("/bugun?x=1", "sb-abc-auth-token=eyJ"));
    expect(location(res)).toBe("http://localhost:3001/login?neden=baska-cihaz");
  });

  it("yenileme anahtarı bulunamıyorsa da başka cihaz; başka hata oturum bitti", async () => {
    getClaims.mockResolvedValue({ data: null, error: { code: "refresh_token_not_found", message: "x" } });
    expect(location(await updateSession(request("/bugun", "sb-abc-auth-token.0=a; sb-abc-auth-token.1=b")))).toBe(
      "http://localhost:3001/login?neden=baska-cihaz",
    );
    getClaims.mockResolvedValue({ data: null, error: { code: "bad_jwt", message: "x" } });
    expect(location(await updateSession(request("/bugun", "sb-abc-auth-token=eyJ")))).toBe(
      "http://localhost:3001/login?neden=oturum-bitti",
    );
  });

  it("çerezsiz ilk ziyaret nedensiz /login'e gider", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect(location(await updateSession(request("/bugun")))).toBe("http://localhost:3001/login");
  });

  it("oturum geçerliyse yönlendirme yok; /login'deyse /bugun'e", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
    expect(location(await updateSession(request("/bugun", "sb-abc-auth-token=eyJ")))).toBeNull();
    expect(location(await updateSession(request("/login", "sb-abc-auth-token=eyJ")))).toBe("http://localhost:3001/bugun");
  });
});
