import { describe, expect, it } from "vitest";
import { probeResult } from "@/lib/content/video-probe";

describe("probeResult", () => {
  it("süre ve boyut okunur", () =>
    expect(probeResult({ duration: 34.2, videoWidth: 1080, videoHeight: 1920 })).toEqual({ durationS: 34.2, width: 1080, height: 1920 }));
  it("NaN süre → null", () => expect(probeResult({ duration: NaN, videoWidth: 1080, videoHeight: 1920 })).toBeNull());
  it("Infinity süre → null", () => expect(probeResult({ duration: Infinity, videoWidth: 1080, videoHeight: 1920 })).toBeNull());
  it("genişlik 0 → null", () => expect(probeResult({ duration: 10, videoWidth: 0, videoHeight: 1920 })).toBeNull());
});
