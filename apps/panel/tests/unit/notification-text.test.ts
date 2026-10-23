import { describe, it, expect } from "vitest";
import { notificationText, notificationHint } from "@/lib/notification-text";
import { NOTIFICATION_TYPES, isNotificationType } from "@/lib/notifications/types";

describe("notificationText", () => {
  it("yeni web başvurusunu veli adı ve sayfayla yazar", () => {
    expect(
      notificationText({
        type: "web_basvuru",
        payload: { parentName: "Ayşe Yılmaz", landingPath: "/lp/kres-2-yas", duplicate: false },
      }),
    ).toBe("Yeni web başvurusu: Ayşe Yılmaz (/lp/kres-2-yas)");
  });

  it("tekrar başvuruyu ayırt eder", () => {
    expect(
      notificationText({ type: "web_basvuru", payload: { parentName: "Ayşe Yılmaz", landingPath: null, duplicate: true } }),
    ).toBe("Ayşe Yılmaz siteden tekrar başvurdu");
  });

  it("tekrar başvuruda source null olsa da çalışır", () => {
    expect(
      notificationText({
        type: "web_basvuru",
        payload: { leadId: "x", parentName: "Ayşe Yılmaz", source: null, landingPath: null, duplicate: true },
      }),
    ).toBe("Ayşe Yılmaz siteden tekrar başvurdu");
  });

  it("mevcut teklif bildirimlerini değiştirmez", () => {
    expect(notificationText({ type: "teklif_reddedildi", payload: {} })).toBe("Teklifiniz reddedildi.");
    expect(notificationText({ type: "teklif_onay_bekliyor", payload: { offered: 18000 } })).toContain("Onay bekleyen yeni teklif");
  });

  it("reklam senkron hatası için sabit metin döner", () => {
    expect(notificationText({ type: "ads_senkron_hata", payload: { message: "x", tarih: "2026-10-15" } })).toBe(
      "Google Ads senkronu bu sabah başarısız oldu. Pazarlama ekranına bakın.",
    );
  });

  it("bilinmeyen türde sistem bildirimi metni döner", () => {
    expect(notificationText({ type: "kayit_yenileme", payload: {} })).toBe("Yeni bir sistem bildirimi (kayit yenileme)");
  });
});

describe("notificationText geri_bildirim", () => {
  it("hata bildirimini yazan ve başlıkla gösterir", () => {
    expect(
      notificationText({ type: "geri_bildirim", payload: { kind: "hata", title: "Takvim açılmıyor", by: "Ayşe" } }),
    ).toBe("Ayşe hata bildirdi: Takvim açılmıyor");
  });
  it("öneriyi ayırt eder ve eksik veride çökmez", () => {
    expect(notificationText({ type: "geri_bildirim", payload: { kind: "oneri", title: "Excel aktarımı", by: "Can" } })).toBe(
      "Can öneri gönderdi: Excel aktarımı",
    );
    expect(notificationText({ type: "geri_bildirim", payload: {} })).toBe("Bir kullanıcı öneri gönderdi");
  });
});

describe("notificationText teklif_karsi_onaylandi", () => {
  it("karşı rakamla onayı tutarla yazar", () => {
    expect(
      notificationText({ type: "teklif_karsi_onaylandi", payload: { counterPrice: 18000 } }),
    ).toBe("Teklif karşı rakamla onaylandı: 18.000,00 ₺");
    expect(notificationText({ type: "teklif_karsi_onaylandi", payload: {} })).toBe(
      "Teklif karşı rakamla onaylandı.",
    );
  });
});

describe("notificationText tüm türler", () => {
  it("20 tür kayıtlı", () => {
    expect(NOTIFICATION_TYPES).toHaveLength(20);
    expect(isNotificationType("geciken_ozet")).toBe(true);
    expect(isNotificationType("baska")).toBe(false);
  });
  it.each(NOTIFICATION_TYPES)("%s boş payload ile anlamlı metin verir", (type) => {
    const text = notificationText({ type, payload: {} });
    expect(text).not.toBe("");
    expect(text).not.toBe("Yeni bildirim var.");
    expect(text).not.toMatch(/undefined|NaN|null/);
    const hint = notificationHint({ type, payload: {} });
    if (hint !== null) expect(hint).not.toMatch(/undefined|NaN|null/);
  });
});

describe("notificationText yeni türler", () => {
  it("geciken_ozet", () => {
    const want = "Ödemesi geciken 13 taksit var (toplam 302.250,00 ₺)";
    expect(notificationText({ type: "geciken_ozet", payload: { count: 13, totalFormatted: "302.250,00 ₺" } })).toBe(want);
    expect(notificationText({ type: "geciken_ozet", payload: { count: 13, totalKurus: 30225000 } })).toBe(want);
    expect(notificationText({ type: "geciken_ozet", payload: {} })).toBe("Ödemesi geciken taksitler var");
    expect(notificationHint({ type: "geciken_ozet", payload: {} })).toBe("Gecikenler listesinden velileri arayın.");
  });
  it("randevu_bugun yalnız saat", () => {
    expect(notificationText({ type: "randevu_bugun", payload: { at: "2026-10-20T14:19:00Z" } })).toBe("17:19 randevu");
  });
  it("geciken_ozet NaN/Infinity sayıyı reddeder", () => {
    expect(notificationText({ type: "geciken_ozet", payload: { count: Number.NaN } })).toBe("Ödemesi geciken taksitler var");
    expect(notificationText({ type: "geciken_ozet", payload: { count: Infinity } })).toBe("Ödemesi geciken taksitler var");
  });
  it("randevu_bugun", () => {
    const at = "2026-10-20T14:19:00+00:00";
    expect(notificationText({ type: "randevu_bugun", payload: { at, parentName: "Ayşe Yılmaz" } })).toBe("17:19 randevu: Ayşe Yılmaz");
    expect(notificationText({ type: "randevu_bugun", payload: { at }, leadName: "Ayşe Yılmaz" })).toBe("17:19 randevu: Ayşe Yılmaz");
    expect(notificationText({ type: "randevu_bugun", payload: { parentName: "Ayşe Yılmaz" } })).toBe("Randevu: Ayşe Yılmaz");
    expect(notificationText({ type: "randevu_bugun", payload: { at: "bozuk" } })).toBe("Randevu hatırlatması");
    expect(notificationText({ type: "randevu_bugun", payload: {} })).toBe("Randevu hatırlatması");
  });
  it("teklif metinleri ad ile", () => {
    expect(notificationText({ type: "teklif_onay_bekliyor", payload: { offered: 21000 }, leadName: "Ayşe Yılmaz" })).toBe(
      "Ayşe Yılmaz için teklif onay bekliyor: 21.000,00 ₺",
    );
    expect(notificationText({ type: "teklif_onay_bekliyor", payload: { offered: 21000 } })).toBe("Onay bekleyen yeni teklif: 21.000,00 ₺");
    expect(notificationHint({ type: "teklif_onay_bekliyor", payload: {} })).toBe("Onaylayın, reddedin ya da karşı rakam girin.");
    expect(notificationText({ type: "teklifiniz_onaylandi", payload: {}, leadName: "Ayşe Yılmaz" })).toBe("Ayşe Yılmaz için teklifiniz onaylandı");
    expect(notificationText({ type: "teklifiniz_onaylandi", payload: {} })).toBe("Teklifiniz onaylandı.");
    expect(notificationText({ type: "teklif_reddedildi", payload: {}, leadName: "Ayşe Yılmaz" })).toBe("Ayşe Yılmaz için teklifiniz reddedildi");
  });
  it("ad önceliği payload.parentName > leadName", () => {
    expect(notificationText({ type: "veli_bekliyor", payload: { parentName: "A" }, leadName: "B" })).toBe("A 15 dakikadır aranmadı");
    expect(notificationText({ type: "veli_bekliyor", payload: {}, leadName: "B" })).toBe("B 15 dakikadır aranmadı");
    expect(notificationText({ type: "web_basvuru", payload: {}, leadName: "B" })).toBe("Yeni web başvurusu: B");
  });
  it("santral", () => {
    expect(notificationText({ type: "cevapsiz_arama", payload: { parentName: "Ayşe" } })).toBe("Cevapsız arama: Ayşe");
    expect(notificationText({ type: "cevapsiz_arama", payload: { number: "05321234567" } })).toBe("Cevapsız arama: 05321234567");
    expect(notificationText({ type: "santral_senkron_hata", payload: {} })).toBe("Santral senkronu başarısız oldu.");
  });
  it("bilinmeyen türün ipucu yok", () => {
    expect(notificationHint({ type: "baska", payload: {} })).toBeNull();
  });
});

describe("teklif adlı metinler", () => {
  it("teklif_revize_edildi adı kullanır", () => {
    expect(
      notificationText({ type: "teklif_revize_edildi", payload: { counterPrice: 18000 }, leadName: "Ayşe Yılmaz" }),
    ).toBe("Ayşe Yılmaz teklifine karşı rakam girildi: 18.000,00 ₺");
    expect(notificationText({ type: "teklif_revize_edildi", payload: { counterPrice: 18000 } })).toBe(
      "Teklif için karşı rakam girildi: 18.000,00 ₺",
    );
  });
  it("teklif_karsi_onaylandi adı kullanır", () => {
    expect(
      notificationText({ type: "teklif_karsi_onaylandi", payload: { counterPrice: 18000, parentName: "Ayşe Yılmaz" } }),
    ).toBe("Ayşe Yılmaz teklifi karşı rakamla onaylandı: 18.000,00 ₺");
  });
});

describe("Instagram yayın bildirimleri", () => {
  it("yayınlandı ve hata metni", () => {
    expect(notificationText({ type: "ig_yayinlandi", payload: { code: "R-2644-A" } })).toBe("R-2644-A Instagram'da yayınlandı");
    expect(notificationText({ type: "ig_yayin_hata", payload: { code: "R-2644-A", error: "Onay geri alındı" } })).toBe(
      "R-2644-A Instagram'da yayınlanamadı: Onay geri alındı",
    );
    expect(notificationHint({ type: "ig_yayinlandi", payload: {} })).toBeNull();
    expect(notificationHint({ type: "ig_yayin_hata", payload: {} })).toBe("İçerik panosunda tekrar deneyin ya da bağlantıyı elle yapıştırın.");
  });
});
