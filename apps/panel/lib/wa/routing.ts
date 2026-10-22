/** Hangi panel işleminin hangi WhatsApp grubuna gideceği. Tek kaynak burası;
 *  tests/unit/wa-routing.test.ts koddaki her olay türünün burada bir gruba atandığını denetler. */

/** kayit: ana grup (Kayıt Randevuları). finans: Ödeme ve fatura grubu. */
export type WaHedef = "kayit" | "finans";

export const WA_HEDEF_TURLERI: Record<WaHedef, readonly string[]> = {
  finans: [
    "plan_olusturuldu",
    "taksit_odendi",
    "odeme_alindi",
    "odeme_geri_alindi",
    "odeme_duzeltildi",
    "kalan_kapatildi",
    "odeme_hatirlatildi",
    "odeme_gunu_degisti",
    "iade_kaydedildi",
    "fiyat_listesi_guncellendi",
    "taksitlendirildi",
    "taksit_guncellendi",
    "zam_uygulandi",
    "tutar_kesinlesti",
    "veli_gorusmesi",
  ],
  kayit: [
    "lead_olusturuldu",
    "web_basvuru",
    "web_tekrar_basvuru",
    "durum_degisti",
    "not_eklendi",
    "arama_kaydi",
    "mesaj_tekrar",
    "ustlenildi",
    "lead_guncellendi",
    "lead_silindi",
    "beklemeye_alindi",
    "aileye_baglandi",
    "randevu_olusturuldu",
    "randevu_sonuclandi",
    "teklif_olusturuldu",
    "teklif_onaylandi",
    "teklif_reddedildi",
    "teklif_revize_edildi",
    "ogrenciye_donusturuldu",
    "ogrenci_ayrildi",
    "ogrenci_guncellendi",
    "ogrenci_silindi",
  ],
};

/** Her hedefin grubunun app_settings anahtarları. Satır yoksa (prod'da hiç seçilmemiş) grup boş sayılır. */
export const WA_GRUP_ANAHTARLARI: Record<WaHedef, { id: string; name: string }> = {
  kayit: { id: "wa_group_id", name: "wa_group_name" },
  finans: { id: "wa_finans_group_id", name: "wa_finans_group_name" },
};

export function parseWaHedef(value: unknown): WaHedef {
  return value === "finans" ? "finans" : "kayit";
}

/** Ayrıca listelenmeden ödeme grubuna giden tür önekleri (ileride eklenecek fatura olayları). */
const FINANS_ONEKLERI = ["fatura_"];

const HEDEF = new Map<string, WaHedef>(
  (Object.entries(WA_HEDEF_TURLERI) as [WaHedef, readonly string[]][]).flatMap(([hedef, turler]) =>
    turler.map((t) => [t, hedef] as const),
  ),
);

export function hedefFor(eventType: string): WaHedef {
  const hedef = HEDEF.get(eventType);
  if (hedef) return hedef;
  if (FINANS_ONEKLERI.some((p) => eventType.startsWith(p))) return "finans";
  // Bilinmeyen tür eskisi gibi ana gruba gider.
  return "kayit";
}

/** Olayın gönderileceği grup. Ödeme grubu seçili değilse her şey ana gruba gider. */
export function chatIdFor(eventType: string, settings: { groupId: string; finansGroupId?: string }): string {
  if (hedefFor(eventType) === "finans" && settings.finansGroupId) return settings.finansGroupId;
  return settings.groupId;
}
