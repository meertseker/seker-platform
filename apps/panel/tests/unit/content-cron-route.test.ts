import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runPublishQueue, supabasePublishStore } = vi.hoisted(() => ({
  runPublishQueue: vi.fn(),
  supabasePublishStore: vi.fn(() => ({ fake: true })),
}));
vi.mock("@/lib/content/publish-runner", () => ({ runPublishQueue }));
vi.mock("@/lib/content/publish-store", () => ({ supabasePublishStore }));
vi.mock("@seker/auth/admin", () => ({ createAdminSupabase: () => ({}) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/content/route";

const req = (auth?: string) =>
  new NextRequest("http://localhost/api/cron/content", auth ? { headers: { authorization: auth } } : undefined);

beforeEach(() => {
  vi.resetAllMocks();
  supabasePublishStore.mockReturnValue({ fake: true });
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.stubEnv("IG_PUBLISH_ENABLED", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/cron/content", () => {
  it("gizli anahtar yoksa ya da yanlışsa 401 ve koşucu çağrılmaz", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer yanlis"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(401);
    expect(runPublishQueue).not.toHaveBeenCalled();
  });

  it("koşucu sonucu yanıtta döner", async () => {
    runPublishQueue.mockResolvedValue({ processed: 2, published: 1, failed: 1 });
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, processed: 2, published: 1, failed: 1 });
  });

  it("koşucu 5 sınırıyla çağrılır ve env geçirilir (bayrak kapalıyken de)", async () => {
    runPublishQueue.mockResolvedValue({ processed: 0, published: 0, failed: 0 });
    await GET(req("Bearer s3cret"));
    expect(runPublishQueue).toHaveBeenCalledTimes(1);
    const [deps, limit] = runPublishQueue.mock.calls[0];
    expect(limit).toBe(5);
    expect(deps.store).toEqual({ fake: true });
    expect(deps.env).toBe(process.env);
  });

  it("koşucu patlarsa 500 ve anahtar sızmaz", async () => {
    runPublishQueue.mockRejectedValue(new Error("db koptu s3cret"));
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("s3cret");
  });
});
