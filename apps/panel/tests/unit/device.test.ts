import { describe, expect, it } from "vitest";
import { isPhoneRequest } from "@/lib/device";

const request = (init: Record<string, string>) => new Headers(init);

describe("isPhoneRequest", () => {
  it("Chromium ipucunu kullanır", () => {
    expect(isPhoneRequest(request({ "sec-ch-ua-mobile": "?1" }))).toBe(true);
    expect(isPhoneRequest(request({ "sec-ch-ua-mobile": "?0", "user-agent": "Mobile" }))).toBe(false);
  });

  it("ipucu yoksa kullanıcı ajanına bakar", () => {
    expect(
      isPhoneRequest(
        request({
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        }),
      ),
    ).toBe(true);
    expect(
      isPhoneRequest(
        request({ "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36" }),
      ),
    ).toBe(true);
    expect(
      isPhoneRequest(
        request({ "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15" }),
      ),
    ).toBe(false);
    expect(isPhoneRequest(request({}))).toBe(false);
  });
});
