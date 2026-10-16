import { describe, it, expect } from "vitest";
import { notificationText } from "@/lib/notification-text";

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

  it("bilinmeyen türde genel metin döner", () => {
    expect(notificationText({ type: "baska", payload: {} })).toBe("Yeni bildirim var.");
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
