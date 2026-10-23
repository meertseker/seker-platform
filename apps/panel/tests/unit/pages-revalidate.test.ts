import { describe, it, expect, vi } from "vitest";
import { revalidateWebPage } from "@/lib/pages/revalidate";

const SECRET = "gizli-sir-123";
const env = (extra: Record<string, string> = {}) =>
  ({ WEB_REVALIDATE_SECRET: SECRET, ...extra }) as unknown as NodeJS.ProcessEnv;
const asFetch = (f: unknown) => f as typeof fetch;

describe("revalidateWebPage", () => {
  it("sır yoksa istek atmaz, ayar-yok", async () => {
    const fetchFn = vi.fn();
    expect(await revalidateWebPage("ilk-hafta-uyum", { fetchFn: asFetch(fetchFn), env: {} as NodeJS.ProcessEnv })).toEqual({
      ok: false,
      reason: "ayar-yok",
    });
    expect(
      await revalidateWebPage("ilk-hafta-uyum", {
        fetchFn: asFetch(fetchFn),
        env: { WEB_REVALIDATE_SECRET: "  " } as unknown as NodeJS.ProcessEnv,
      }),
    ).toEqual({ ok: false, reason: "ayar-yok" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("200 → ok; gövde ve başlık doğru", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    const res = await revalidateWebPage("ilk-hafta-uyum", { fetchFn: asFetch(fetchFn), env: env({ SITE_PUBLIC_URL: "https://a.b/" }) });
    expect(res).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://a.b/api/revalidate");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"slug":"ilk-hafta-uyum"}');
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${SECRET}`);
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("SITE_PUBLIC_URL yoksa varsayılan adres", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    await revalidateWebPage("x-y-z", { fetchFn: asFetch(fetchFn), env: env() });
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe("https://yeni.sekeranaokulu.com/api/revalidate");
  });

  it("401 → reddedildi", async () => {
    const fetchFn = vi.fn(async () => new Response("no", { status: 401 }));
    expect(await revalidateWebPage("ilk-hafta-uyum", { fetchFn: asFetch(fetchFn), env: env() })).toEqual({
      ok: false,
      reason: "reddedildi",
    });
  });

  it("ağ hatası → ulasilamadi, sır günlüğe yazılmaz", async () => {
    const spies = [
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}),
    ];
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await revalidateWebPage("ilk-hafta-uyum", { fetchFn: asFetch(fetchFn), env: env() })).toEqual({
      ok: false,
      reason: "ulasilamadi",
    });
    for (const s of spies) {
      for (const call of s.mock.calls) expect(JSON.stringify(call)).not.toContain(SECRET);
      s.mockRestore();
    }
  });
});
