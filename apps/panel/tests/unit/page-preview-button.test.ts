import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/pages", () => ({ openPagePreview: vi.fn() }));

import { runPreview } from "@/components/page-preview-button";

describe("runPreview", () => {
  it("önce kaydeder, sonra önizlemeyi açar", async () => {
    const calls: string[] = [];
    const res = await runPreview(
      async () => {
        calls.push("flush");
        return { ok: true };
      },
      async () => {
        calls.push("open");
        return { url: "https://ornek.test/lp/onizleme/abc" };
      },
    );
    expect(calls).toEqual(["flush", "open"]);
    expect(res).toEqual({ url: "https://ornek.test/lp/onizleme/abc" });
  });

  it("kayıt reddedilirse önizleme açılmaz", async () => {
    const open = vi.fn(async () => ({ url: "x" }));
    const res = await runPreview(() => Promise.reject(new Error("ağ")), open);
    expect(open).not.toHaveBeenCalled();
    expect(res).toEqual({ error: "Kaydedilemedi, tekrar dene" });
  });

  it("kayıt hata döndürürse önizleme açılmaz", async () => {
    const open = vi.fn(async () => ({ url: "x" }));
    const res = await runPreview(async () => ({ ok: false, error: "Bağlantı yok" }), open);
    expect(open).not.toHaveBeenCalled();
    expect(res).toEqual({ error: "Kaydedilemedi, tekrar dene" });
  });

  it("eylem hatası aynen döner", async () => {
    const res = await runPreview(async () => ({ ok: true }), async () => ({ error: "İçerik bulunamadı" }));
    expect(res).toEqual({ error: "İçerik bulunamadı" });
  });
});
