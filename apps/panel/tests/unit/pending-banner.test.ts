import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let pathname = "/pipeline";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { PendingApplicationsBanner } from "@/components/pending-applications-banner";
import { queueBannerSummary, type QueueLead } from "@/lib/queries/call-queue";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/lead-flow/business-hours";

function lead(id: string, name: string, startedAt: string): QueueLead {
  return {
    id, parentName: name, phone: "+905005550001", source: "instagram", channel: "ig_dm", contentCode: null,
    childAge: null, district: null, startWindow: null, startedAt, claimedByName: null, claimUntil: null,
  };
}

const now = new Date("2026-10-20T10:20:00+03:00");
const leads = [
  lead("a", "Ayşe Kaya", new Date("2026-10-20T10:03:00+03:00").toISOString()),
  lead("b", "Burak Demir", new Date("2026-10-20T10:18:00+03:00").toISOString()),
];

describe("queueBannerSummary", () => {
  it("sayı ortak listeyle aynı; en eski veli ve mesai dakikası", () => {
    expect(queueBannerSummary(leads, now, DEFAULT_BUSINESS_HOURS)).toEqual({
      count: 2,
      oldestName: "Ayşe Kaya",
      oldestMinutes: 17,
    });
  });
  it("liste boşsa null", () => {
    expect(queueBannerSummary([], now, DEFAULT_BUSINESS_HOURS)).toBeNull();
  });
});

describe("PendingApplicationsBanner", () => {
  const summary = { count: 2, oldestName: "Ayşe Kaya", oldestMinutes: 17 };

  it("başka sayfalarda Bugün'e götürür, doğrudan aramaz", () => {
    pathname = "/pipeline";
    const html = renderToStaticMarkup(createElement(PendingApplicationsBanner, { summary }));
    expect(html).toContain("2 yeni veli aranmayı bekliyor");
    expect(html).toContain("Ayşe Kaya");
    expect(html).toContain('href="/bugun"');
    expect(html).toContain("Bugün&#x27;e git");
    expect(html).not.toContain("tel:");
  });

  it("Bugün ekranında görünmez", () => {
    pathname = "/bugun";
    expect(renderToStaticMarkup(createElement(PendingApplicationsBanner, { summary }))).toBe("");
  });

  it("liste boşsa görünmez", () => {
    pathname = "/pipeline";
    expect(renderToStaticMarkup(createElement(PendingApplicationsBanner, { summary: null }))).toBe("");
  });
});
