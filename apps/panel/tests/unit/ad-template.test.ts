import { describe, it, expect } from "vitest";
import {
  AD_TEMPLATE_KEY,
  DEFAULT_AD_TEMPLATE,
  WEEKLY_NEW_AD_LIMIT_DEFAULT,
  getAdTemplate,
  monthlyCapCheck,
  parseAdTemplate,
  percentSuffix,
  remainingDaysInMonth,
  templateGaps,
  validateAdTemplate,
  type AdTemplateInput,
} from "@/lib/ads/ad-template";

const validInput = (): AdTemplateInput => ({
  okulAdres: "Atatürk Cad. No 12, Kadıköy",
  lat: 40.99,
  lng: 29.03,
  yaricapKm: 8,
  yasMin: 25,
  yasMax: 45,
  testGunlukTl: 200,
  buyutmeGunlukTl: 400,
  mevcutVelileriHaricTut: true,
  haftalikYeniReklam: 4,
});

describe("parseAdTemplate", () => {
  it("varsayılan şablon K27", () => {
    const t = parseAdTemplate({});
    expect(t).toMatchObject({
      okulAdres: "",
      lat: null,
      lng: null,
      yaricapKm: 8,
      yasMin: 25,
      yasMax: 45,
      testGunlukTl: 200,
      buyutmeGunlukTl: 400,
      mevcutVelileriHaricTut: true,
      haftalikYeniReklam: 4,
      updatedBy: null,
      updatedAt: null,
    });
    expect(parseAdTemplate(null)).toEqual(DEFAULT_AD_TEMPLATE);
    expect(AD_TEMPLATE_KEY).toBe("reklam_sablonu");
    expect(WEEKLY_NEW_AD_LIMIT_DEFAULT).toBe(4);
  });

  it("bozuk alanlar varsayılana düşer, geçerliler kalır", () => {
    const t = parseAdTemplate({
      okulAdres: "Atatürk Cad. 12",
      lat: 41,
      lng: 29,
      yaricapKm: 0,
      yasMin: "30",
      yasMax: 70,
      testGunlukTl: 300,
      buyutmeGunlukTl: 10,
      mevcutVelileriHaricTut: "evet",
      haftalikYeniReklam: 0,
      updatedBy: "Mert",
      updatedAt: "2026-10-23T10:00:00Z",
    });
    expect(t).toMatchObject({
      okulAdres: "Atatürk Cad. 12",
      lat: 41,
      lng: 29,
      yaricapKm: 8,
      yasMin: 25,
      yasMax: 45,
      testGunlukTl: 300,
      buyutmeGunlukTl: 400,
      mevcutVelileriHaricTut: true,
      haftalikYeniReklam: 4,
      updatedBy: "Mert",
      updatedAt: "2026-10-23T10:00:00Z",
    });
  });

  it("haftalikYeniReklam geçerliyse korunur, değilse 4", () => {
    expect(parseAdTemplate({ haftalikYeniReklam: 6 }).haftalikYeniReklam).toBe(6);
    expect(parseAdTemplate({ haftalikYeniReklam: 2.5 }).haftalikYeniReklam).toBe(4);
    expect(parseAdTemplate({ haftalikYeniReklam: 21 }).haftalikYeniReklam).toBe(4);
    expect(parseAdTemplate({ haftalikYeniReklam: "5" }).haftalikYeniReklam).toBe(4);
  });

  it("konum yarım ya da aralık dışıysa ikisi de null", () => {
    expect(parseAdTemplate({ lat: 41, lng: null })).toMatchObject({ lat: null, lng: null });
    expect(parseAdTemplate({ lat: 91, lng: 29 })).toMatchObject({ lat: null, lng: null });
  });

  it("yasMax yasMin'den küçükse iki yaş da varsayılana döner", () => {
    expect(parseAdTemplate({ yasMin: 40, yasMax: 30 })).toMatchObject({ yasMin: 25, yasMax: 45 });
    expect(parseAdTemplate({ yasMin: 30, yasMax: 50 })).toMatchObject({ yasMin: 30, yasMax: 50 });
  });
});

describe("validateAdTemplate", () => {
  it("geçerli girdi ok", () => {
    expect(validateAdTemplate(validInput())).toEqual({ ok: true, value: validInput() });
  });

  it("adres kırpılır", () => {
    const r = validateAdTemplate({ ...validInput(), okulAdres: "  Atatürk Cad. 12  " });
    expect(r).toMatchObject({ ok: true, value: { okulAdres: "Atatürk Cad. 12" } });
  });

  it("yarıçap 0 → hata", () => {
    expect(validateAdTemplate({ ...validInput(), yaricapKm: 0 })).toEqual({ error: "Yarıçap 1–80 km olmalı." });
    expect(validateAdTemplate({ ...validInput(), yaricapKm: 8.5 })).toHaveProperty("error");
  });

  it("yasMax 70 → hata", () => {
    expect(validateAdTemplate({ ...validInput(), yasMax: 70 })).toHaveProperty("error");
  });

  it("yasMin 30, yasMax 25 → hata", () => {
    expect(validateAdTemplate({ ...validInput(), yasMin: 30, yasMax: 25 })).toHaveProperty("error");
  });

  it("yasMin 17 → hata", () => {
    expect(validateAdTemplate({ ...validInput(), yasMin: 17 })).toHaveProperty("error");
  });

  it("bütçe metin ya da aralık dışı → hata", () => {
    expect(validateAdTemplate({ ...validInput(), testGunlukTl: "200" })).toHaveProperty("error");
    expect(validateAdTemplate({ ...validInput(), buyutmeGunlukTl: 49 })).toHaveProperty("error");
    expect(validateAdTemplate({ ...validInput(), buyutmeGunlukTl: 100_001 })).toHaveProperty("error");
  });

  it("adres kısa ya da uzun → hata", () => {
    expect(validateAdTemplate({ ...validInput(), okulAdres: "abc" })).toHaveProperty("error");
    expect(validateAdTemplate({ ...validInput(), okulAdres: "a".repeat(201) })).toHaveProperty("error");
  });

  it("konum eksik ya da aralık dışı → hata", () => {
    expect(validateAdTemplate({ ...validInput(), lat: null })).toHaveProperty("error");
    expect(validateAdTemplate({ ...validInput(), lng: 181 })).toHaveProperty("error");
    expect(validateAdTemplate({ ...validInput(), lat: -91 })).toHaveProperty("error");
  });

  it("mevcutVelileriHaricTut boolean değilse hata", () => {
    expect(validateAdTemplate({ ...validInput(), mevcutVelileriHaricTut: "true" })).toHaveProperty("error");
  });

  it("haftalikYeniReklam 1–20 tam sayı", () => {
    const msg = { error: "Haftalık yeni reklam sınırı 1–20 olmalı." };
    expect(validateAdTemplate({ ...validInput(), haftalikYeniReklam: 0 })).toEqual(msg);
    expect(validateAdTemplate({ ...validInput(), haftalikYeniReklam: 21 })).toEqual(msg);
    expect(validateAdTemplate({ ...validInput(), haftalikYeniReklam: 2.5 })).toEqual(msg);
    expect(validateAdTemplate({ ...validInput(), haftalikYeniReklam: 1 })).toHaveProperty("ok", true);
    expect(validateAdTemplate({ ...validInput(), haftalikYeniReklam: 20 })).toHaveProperty("ok", true);
  });

  it("nesne değilse hata", () => {
    expect(validateAdTemplate(null)).toHaveProperty("error");
  });
});

describe("templateGaps", () => {
  it("boş adres ve null konum → iki eksik", () => {
    expect(templateGaps(DEFAULT_AD_TEMPLATE)).toEqual(["Okul adresi", "Okul konumu"]);
  });
  it("dolu şablon → eksik yok", () => {
    expect(templateGaps({ ...DEFAULT_AD_TEMPLATE, ...validInput() })).toEqual([]);
  });
});

describe("remainingDaysInMonth", () => {
  it("bugün dahil", () => {
    expect(remainingDaysInMonth("2026-11-10")).toBe(21);
    expect(remainingDaysInMonth("2026-02-28")).toBe(1);
    expect(remainingDaysInMonth("2028-02-28")).toBe(2);
    expect(remainingDaysInMonth("2026-12-01")).toBe(31);
  });
});

describe("percentSuffix", () => {
  it.each([
    [64, "ü"],
    [60, "ı"],
    [70, "i"],
    [100, "ü"],
    [0, "ı"],
    [50, "si"],
    [9, "u"],
    [6, "sı"],
    [1, "i"],
    [2, "si"],
    [3, "ü"],
    [5, "i"],
    [7, "si"],
    [8, "i"],
    [10, "u"],
    [20, "si"],
    [30, "u"],
    [40, "ı"],
    [80, "i"],
    [90, "ı"],
    [99, "u"],
    [42, "si"],
    [33, "ü"],
  ])("%i → %s", (n, s) => {
    expect(percentSuffix(n)).toBe(s);
  });
});

describe("monthlyCapCheck", () => {
  const base = { monthSpendTl: 6000, testGunlukTl: 200, buyutmeGunlukTl: 400, today: "2026-11-10" };

  it("aşımda ok:false ve mesaj", () => {
    const r = monthlyCapCheck({ ...base, metaTl: 18000 });
    expect(r.ok).toBe(false);
    expect(r.needTl).toBe(18600);
    expect(r.leftTl).toBe(12000);
    expect(r.message).toBe("Aylık Meta bütçesi yetmiyor: ay sonuna 18.600 TL gerekiyor, bütçe 18.000 TL");
  });

  it("yetiyorsa ok:true, leftPct ve ekli mesaj", () => {
    expect(monthlyCapCheck({ ...base, metaTl: 20000 })).toEqual({
      ok: true,
      needTl: 18600,
      leftTl: 14000,
      leftPct: 70,
      message: "Bütçe şablondan; aylık bütçenin %70'i kaldı",
    });
  });

  it("tam sınırda ok", () => {
    expect(monthlyCapCheck({ ...base, metaTl: 18600 }).ok).toBe(true);
  });

  it("metaTl 0 → kırmızı", () => {
    const r = monthlyCapCheck({ ...base, metaTl: 0 });
    expect(r.ok).toBe(false);
    expect(r.leftPct).toBeNull();
    expect(r.message).toBe("Aylık Meta bütçesi Ayarlar'da 0");
  });
});

describe("getAdTemplate", () => {
  it("app_settings'ten reklam_sablonu okur", async () => {
    const calls: unknown[][] = [];
    const chain = {
      select: (...a: unknown[]) => {
        calls.push(["select", ...a]);
        return chain;
      },
      eq: (...a: unknown[]) => {
        calls.push(["eq", ...a]);
        return chain;
      },
      maybeSingle: async () => ({ data: { value: { yaricapKm: 12, haftalikYeniReklam: 3 } }, error: null }),
    };
    const supabase = {
      from: (t: string) => {
        calls.push(["from", t]);
        return chain;
      },
    };
    const t = await getAdTemplate(supabase as never);
    expect(t.yaricapKm).toBe(12);
    expect(t.haftalikYeniReklam).toBe(3);
    expect(t.yasMin).toBe(25);
    expect(calls).toContainEqual(["from", "app_settings"]);
    expect(calls).toContainEqual(["eq", "key", "reklam_sablonu"]);
  });

  it("satır yoksa varsayılan", async () => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: null, error: null }) };
    expect(await getAdTemplate({ from: () => chain } as never)).toEqual(DEFAULT_AD_TEMPLATE);
  });
});
