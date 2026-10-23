import { describe, it, expect } from "vitest";
import {
  MIN_REASON,
  REELS_AD_MAX_S,
  REELS_MIN_HOURS,
  preflightBlockText,
  runPreflight,
  type PreflightInput,
  type PreflightKey,
} from "@/lib/ads/preflight";
import type { ContentForAd, LandingForAd } from "@/lib/ads/preflight-sources";
import { DEFAULT_AD_TEMPLATE } from "@/lib/ads/ad-template";

const NOW = new Date("2026-10-23T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function reels(over: Partial<ContentForAd> = {}): ContentForAd {
  return {
    id: "c1",
    code: "R-2643-A",
    topic: "Bir günümüz",
    kind: "reels",
    platform: "instagram",
    stage: "organik",
    status: "onaylandi",
    approverFaceCheck: true,
    caption: "Bahçede sabah oyunu ve kahvaltı",
    igMediaId: "1789",
    igPermalink: "https://instagram.com/p/x",
    igPublishedAt: hoursAgo(74),
    igPublishStatus: "yayinda",
    mediaMeta: { vertical: true, durationS: 34, subtitled: true },
    ...over,
  };
}

function baseInput(over: Partial<PreflightInput> = {}): PreflightInput {
  return {
    content: reels(),
    landing: null,
    adName: "R-2643-A · Bir günümüz",
    link: "https://sekeranaokulu.com/lp/az-mevcutlu-anaokulu?utm_source=instagram&utm_medium=paid_social&utm_content=R-2643-A",
    urlTags: "utm_campaign={{campaign.id}}",
    pixelId: "123",
    capiEnabled: true,
    template: { ...DEFAULT_AD_TEMPLATE, okulAdres: "Ataşehir Mah. 1. Sokak No 5", lat: 40.99, lng: 29.1 },
    cap: { ok: true, needTl: 1000, leftTl: 5000, leftPct: 64, message: "Bütçe şablondan; aylık bütçenin %64'ü kaldı" },
    banned: ["en iyi", "garanti"],
    studentNames: [],
    account: { readable: true, active: true, status: 1, currency: "TRY", text: "Sağlıklı" },
    setup: {
      testCampaignId: "1",
      testAdsetId: "2",
      scaleCampaignId: "3",
      scaleAdsetId: "4",
      exclusionAudienceId: null,
      createdAt: "",
      createdBy: "",
    },
    testCampaignStatus: "ACTIVE",
    pageId: "999",
    igUserId: "888",
    now: NOW,
    skip72hReason: null,
    ...over,
  };
}

const item = (r: ReturnType<typeof runPreflight>, key: PreflightKey) => r.items.find((i) => i.key === key)!;

const landing: LandingForAd = {
  status: "yayinda",
  slug: "ilk-gun",
  headline: "İlk gün nasıl geçer?",
  primaryText: "Uyum haftası planımız",
  imageUrl: "https://sekeranaokulu.com/media/x.webp",
};

function page(over: Partial<ContentForAd> = {}): ContentForAd {
  return reels({
    code: "S-2643-I",
    kind: "sayfa",
    caption: null,
    igMediaId: null,
    igPermalink: null,
    igPublishedAt: null,
    igPublishStatus: "yok",
    mediaMeta: { vertical: null, durationS: null, subtitled: null },
    ...over,
  });
}

function pageInput(over: Partial<PreflightInput> = {}): PreflightInput {
  return baseInput({
    content: page(),
    landing,
    adName: "S-2643-I · İlk gün",
    link: "https://sekeranaokulu.com/lp/ilk-gun?utm_source=instagram&utm_medium=paid_social&utm_content=S-2643-I",
    ...over,
  });
}

describe("runPreflight", () => {
  it("sabitler", () => {
    expect(REELS_MIN_HOURS).toBe(72);
    expect(REELS_AD_MAX_S).toBe(60);
    expect(MIN_REASON).toBe(10);
  });

  it("hepsi yeşil", () => {
    const r = runPreflight(baseInput());
    expect(r.ok).toBe(true);
    expect(r.items.map((i) => i.key)).toEqual([
      "onay",
      "yayin",
      "ad",
      "utm",
      "piksel",
      "butce",
      "metin",
      "bicim",
      "hesap",
    ]);
    expect(r.items.every((i) => i.ok && i.fix === null)).toBe(true);
    expect(item(r, "onay").label).toBe("Onaylı, MEB kutusu işaretli");
    expect(item(r, "yayin").label).toBe("Instagram'da yayında 74 saat");
    expect(item(r, "ad").label).toBe("Ad içerik koduyla başlıyor");
    expect(item(r, "utm").label).toBe("Bağlantıda utm ve kod");
    expect(item(r, "piksel").label).toBe("Piksel bağlı, CAPI açık");
    expect(item(r, "butce").label).toBe("Bütçe şablondan; aylık bütçenin %64'ü kaldı");
    expect(item(r, "metin").label).toBe("Yasaklı ifade / öğrenci adı yok");
    expect(item(r, "bicim").label).toBe("Dikey, 34 sn, altyazılı");
    expect(item(r, "hesap").label).toBe("Reklam hesabı sağlıklı, Test kampanyası var");
    expect(preflightBlockText(r)).toBeNull();
  });

  it("70 saatte kırmızı ve kalan 2 saat; gerekçeyle geçer, kısa gerekçeyle geçmez", () => {
    const early = baseInput({ content: reels({ igPublishedAt: hoursAgo(70) }) });
    const r = runPreflight(early);
    expect(r.ok).toBe(false);
    expect(item(r, "yayin")).toEqual({
      key: "yayin",
      ok: false,
      label: "72 saatten önce teste alınamaz · kalan 2 saat",
      fix: "Bekle",
    });
    expect(preflightBlockText(r)).toBe("72 saatten önce teste alınamaz · kalan 2 saat");

    const skipped = runPreflight({ ...early, skip72hReason: "Erken başlamak istiyoruz, kontenjan az" });
    expect(item(skipped, "yayin")).toMatchObject({ ok: true, label: "72 saat beklenmedi · gerekçe yazıldı" });
    expect(skipped.ok).toBe(true);

    const short = runPreflight({ ...early, skip72hReason: "erken" });
    expect(item(short, "yayin").ok).toBe(false);
    const blank = runPreflight({ ...early, skip72hReason: "          x" });
    expect(item(blank, "yayin").ok).toBe(false);
  });

  it("kalan saat yukarı yuvarlanır (71,5 saat → kalan 1)", () => {
    const r = runPreflight(baseInput({ content: reels({ igPublishedAt: hoursAgo(71.5) }) }));
    expect(item(r, "yayin").label).toBe("72 saatten önce teste alınamaz · kalan 1 saat");
  });

  it("Instagram'da yayında değil (gerekçe de geçirmez)", () => {
    const r = runPreflight(
      baseInput({
        content: reels({ igPublishStatus: "kuyruk", igPublishedAt: null }),
        skip72hReason: "Erken başlamak istiyoruz, kontenjan az",
      }),
    );
    expect(item(r, "yayin")).toMatchObject({
      ok: false,
      label: "Instagram'da yayında değil",
      fix: "Önce Instagram'da yayınla",
    });
  });

  it("MEB kutusu işaretsiz → #1 kırmızı Onaya dön", () => {
    const r = runPreflight(baseInput({ content: reels({ approverFaceCheck: false }) }));
    expect(item(r, "onay")).toEqual({
      key: "onay",
      ok: false,
      label: "Onaylı değil ya da MEB kutusu işaretsiz",
      fix: "Onaya dön",
    });
    const r2 = runPreflight(baseInput({ content: reels({ status: "teslim" }) }));
    expect(item(r2, "onay").ok).toBe(false);
  });

  it("sayfa yayında; sayfada 72 saat kuralı yok", () => {
    const r = runPreflight(pageInput());
    expect(r.ok).toBe(true);
    expect(item(r, "yayin").label).toBe("Sayfa yayında · /lp/ilk-gun");
    expect(item(r, "bicim").label).toBe("Sayfa görseli seçili");
  });

  it("sayfa yayında değil", () => {
    const r = runPreflight(pageInput({ landing: { ...landing, status: "taslak" } }));
    expect(item(r, "yayin")).toMatchObject({
      ok: false,
      label: "Sayfa henüz yayında değil: önce Sayfayı yayınla.",
      fix: "Yayınla",
    });
    const none = runPreflight(pageInput({ landing: null }));
    expect(item(none, "yayin").label).toBe("Sayfa henüz yayında değil: önce Sayfayı yayınla.");
  });

  it("sayfa görseli yok", () => {
    const r = runPreflight(pageInput({ landing: { ...landing, imageUrl: null } }));
    expect(item(r, "bicim")).toMatchObject({ ok: false, label: "Sayfa görseli seçilmemiş", fix: "Düzeltme iste" });
  });

  it("sayfada başlık ve ana metin kontrol edilir", () => {
    const r = runPreflight(pageInput({ landing: { ...landing, primaryText: "Garantili uyum" } }));
    expect(item(r, "metin").label).toBe('"garanti" kanıt ister');
  });

  it('"En iyi okul" → "en iyi" kanıt ister', () => {
    const r = runPreflight(baseInput({ content: reels({ caption: "En iyi okul" }) }));
    expect(item(r, "metin")).toEqual({
      key: "metin",
      ok: false,
      label: '"en iyi" kanıt ister',
      fix: "Düzeltme iste",
    });
  });

  it("uzun metin #7'yi düşürmez (karakter sınırı burada yok)", () => {
    const r = runPreflight(baseInput({ content: reels({ caption: "a ".repeat(2000) }) }));
    expect(item(r, "metin").ok).toBe(true);
  });

  it("öğrenci adı tam kelime yakalanır", () => {
    const r = runPreflight(
      baseInput({ content: reels({ caption: "Elif ile ilk gün" }), studentNames: ["Elif Yılmaz"] }),
    );
    expect(item(r, "metin").label).toBe("Metinde öğrenci adı var: Elif");

    const notWord = runPreflight(
      baseInput({ content: reels({ caption: "Elifba öğreniyoruz" }), studentNames: ["Elif Yılmaz"] }),
    );
    expect(item(notWord, "metin").ok).toBe(true);
  });

  it("öğrenci adı Türkçe küçük harfle eşleşir, kısa adlar yok sayılır", () => {
    const r = runPreflight(
      baseInput({ content: reels({ caption: "Bugün İPEK ile resim yaptık" }), studentNames: ["ipek Kaya"] }),
    );
    expect(item(r, "metin").label).toBe("Metinde öğrenci adı var: ipek");
    const dotless = runPreflight(baseInput({ content: reels({ caption: "IŞIL'ın resmi" }), studentNames: ["Işıl"] }));
    expect(item(dotless, "metin").ok).toBe(false);
    const short = runPreflight(
      baseInput({ content: reels({ caption: "Al ile oyun" }), studentNames: ["Al", "Ay Deniz"] }),
    );
    expect(item(short, "metin").ok).toBe(true);
  });

  it("61 sn → kırmızı", () => {
    const r = runPreflight(
      baseInput({ content: reels({ mediaMeta: { vertical: true, durationS: 61, subtitled: true } }) }),
    );
    expect(item(r, "bicim")).toMatchObject({
      ok: false,
      label: "Video 61 sn; reklam için en çok 60 sn",
      fix: "Düzeltme iste",
    });
  });

  it("biçim kırmızıları", () => {
    const run = (m: ContentForAd["mediaMeta"]) =>
      item(runPreflight(baseInput({ content: reels({ mediaMeta: m }) })), "bicim").label;
    expect(run({ vertical: false, durationS: 30, subtitled: true })).toBe("Video dikey değil");
    expect(run({ vertical: true, durationS: 30, subtitled: false })).toBe("Altyazı işaretli değil");
    expect(run({ vertical: null, durationS: 34, subtitled: null })).toBe("Video biçim bilgisi yok");
    expect(run({ vertical: true, durationS: null, subtitled: true })).toBe("Video biçim bilgisi yok");
  });

  it("şablon eksik ya da tavan aşıldı → #6 kırmızı", () => {
    const capMsg = "Aylık Meta bütçesi yetmiyor: ay sonuna 9.000 TL gerekiyor, bütçe 5.000 TL";
    const r = runPreflight(baseInput({ cap: { ok: false, needTl: 9000, leftTl: 0, leftPct: 0, message: capMsg } }));
    expect(item(r, "butce")).toEqual({ key: "butce", ok: false, label: capMsg, fix: "Ayarlar'a git" });

    const gaps = runPreflight(baseInput({ template: DEFAULT_AD_TEMPLATE }));
    expect(item(gaps, "butce")).toMatchObject({
      ok: false,
      label: "Reklam şablonu eksik: Okul adresi, Okul konumu",
      fix: "Ayarlar'a git",
    });
  });

  it("reklam adı koddan başlamıyor → #3 kırmızı", () => {
    const r = runPreflight(baseInput({ adName: "Bir günümüz R-2643-A" }));
    expect(item(r, "ad")).toEqual({
      key: "ad",
      ok: false,
      label: "Reklam adı içerik koduyla başlamıyor",
      fix: "Panel hatası · Mert'e haber verin",
    });
  });

  it("utm_content başka kod → #4 kırmızı", () => {
    const r = runPreflight(
      baseInput({
        link: "https://sekeranaokulu.com/lp/x?utm_source=instagram&utm_medium=paid_social&utm_content=R-2643-B",
      }),
    );
    expect(item(r, "utm")).toMatchObject({ ok: false, fix: "Panel hatası · Mert'e haber verin" });
    expect(item(runPreflight(baseInput({ urlTags: "" })), "utm").ok).toBe(false);
    expect(item(runPreflight(baseInput({ link: "not a url" })), "utm").ok).toBe(false);
  });

  it("piksel ya da CAPI kapalı", () => {
    for (const over of [{ pixelId: null }, { capiEnabled: false }]) {
      const r = runPreflight(baseInput(over));
      expect(item(r, "piksel")).toMatchObject({
        ok: false,
        label: "Piksel ya da Conversions API kapalı",
        fix: "Mert açar",
      });
    }
  });

  it("hesap kırmızıları sırayla", () => {
    const h = (over: Partial<PreflightInput>) => item(runPreflight(baseInput(over)), "hesap");
    expect(h({ setup: null })).toMatchObject({
      ok: false,
      label: "Test kampanyası kurulmamış",
      fix: "Kampanyaları kur",
    });
    expect(h({ account: null })).toMatchObject({
      ok: false,
      label: "Reklam hesabı okunamadı",
      fix: "Mert'e haber verin",
    });
    expect(
      h({ account: { readable: false, active: false, status: null, currency: null, text: "Reklam hesabı okunamadı" } })
        .label,
    ).toBe("Reklam hesabı okunamadı");
    expect(h({ account: { readable: true, active: true, status: 1, currency: "USD", text: "Sağlıklı" } })).toMatchObject({
      ok: false,
      label: "Hesap para birimi TRY değil (USD)",
      fix: "Mert'e haber verin",
    });
    expect(
      h({ account: { readable: true, active: false, status: 3, currency: "TRY", text: "Ödenmemiş bakiye" } }).label,
    ).toBe("Reklam hesabı kısıtlı: Ödenmemiş bakiye");
    expect(h({ testCampaignStatus: "ARCHIVED" })).toMatchObject({
      ok: false,
      label: "Test kampanyası silinmiş ya da arşivde",
    });
    expect(h({ testCampaignStatus: null }).ok).toBe(false);
    expect(h({ testCampaignStatus: "PAUSED" }).ok).toBe(true);
    expect(h({ pageId: null }).label).toBe("Facebook sayfası bağlı değil · Mert ekler");
    expect(h({ igUserId: null }).label).toBe("Instagram gönderi kimliği yok");
    expect(h({ content: reels({ igMediaId: null }) }).label).toBe("Instagram gönderi kimliği yok");
  });

  it("sayfa reklamında Instagram kimliği aranmaz", () => {
    const r = runPreflight(pageInput({ igUserId: null }));
    expect(item(r, "hesap").ok).toBe(true);
  });

  it("preflightBlockText ilk kırmızıyı döner", () => {
    const r = runPreflight(baseInput({ pixelId: null, setup: null }));
    expect(preflightBlockText(r)).toBe("Piksel ya da Conversions API kapalı");
  });
});
