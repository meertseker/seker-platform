import { describe, expect, it } from "vitest";
import { MESSAGE_LEAD_HREF, NEW_LEAD_HREF } from "@/lib/lead-routes";

describe("yeni veli bağlantıları", () => {
  it("menüdeki Yeni veli önce elle ekleme formunu açar", () => {
    expect(NEW_LEAD_HREF).toBe("/leads/new");
  });

  it("mesajla gelen veli hızlı ekleme ekranına gider", () => {
    expect(MESSAGE_LEAD_HREF).toBe("/leads/mesaj");
  });
});
