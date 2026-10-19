// Sunucu sayfası (Ödemeler lejantı) ile istemci hücresi aynı boyayı kullanır; "use client"
// dosyasından dışa aktarılan sabit sunucuda okunamadığından ortak modülde durur.

/**
 * Aidat defterinin boyaları: yeşil ödendi, mor nakit ödendi, kırmızı alınmadı,
 * gri kısmi, boyasız henüz vadesi gelmedi.
 */
export const EXCEL_FILLS = {
  odendi: "bg-[#92D050] text-zinc-900",
  nakit: "bg-[#7030A0] text-white",
  kismi: "bg-[#A6A6A6] text-zinc-900",
  // Excel kırmızısı #FF0000 beyaz yazıyla 4:1 kalıyordu; koyu kırmızı 6.5:1.
  gecikti: "bg-[#C00000] text-white",
  bekliyor: "text-foreground hover:bg-muted",
} as const;
