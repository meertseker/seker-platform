export type MediaAsset = {
  /** public/ köküne göre yol. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /**
   * 'okul' — okulun kendi çekimi, sınırsız kullanılabilir
   * 'stok' — lisanssız Shutterstock önizlemesi; değiştirilene kadar
   *          yayında kalmamalı (bkz. IMAGE-LICENSES.md)
   */
  status: 'okul' | 'stok';
  /** true ise karede çocuk yüzü var; gözler kalıcı olarak yumuşak blurlandı. */
  hasChildFaces?: boolean;
};

/**
 * Sitenin kullandığı bütün görseller. Hepsi okulun kendi çekimidir —
 * 11 Eylül 2026'da okul sahibi tarafından gönderildi.
 *
 * Daha önce burada 16 adet lisanssız Shutterstock önizlemesi duruyordu
 * (IMAGE-LICENSES.md her birinin Image ID'sini listeler); filigranları
 * silinmiş hâlde yayındaydılar. Hepsi kaldırıldı. Buraya stok görsel
 * eklenmesi content/__tests__/media.test.ts tarafından engellenir.
 */
export const MEDIA = {
  gardenWide: {
    src: '/bahce-genis.webp',
    alt: 'Şeker Anaokulu bahçesi: çim alan, ağaçlar, ahşap oyun evi ve piknik masası',
    width: 1600,
    height: 1200,
    status: 'okul',
  },
  gardenWorkshops: {
    src: '/bahce-atolyeler.webp',
    alt: 'Bahçedeki ahşap mutfak atölyesi, açık hava sınıfı ve ağacı çevreleyen oturma bankı',
    width: 1100,
    height: 1467,
    status: 'okul',
  },
  mudKitchen: {
    src: '/mutfak-atolyesi.webp',
    alt: 'Bahçedeki ahşap oyun mutfağı: tencereler, kepçeler ve "Küçük Şeflerin Mutfağı" yazılı kara tahta',
    width: 1100,
    height: 1467,
    status: 'okul',
  },
  outdoorClass: {
    src: '/acik-hava-sinifi.webp',
    alt: 'Açık hava sınıfında oltayla balık tutma oyunu oynayan çocuk, arkada tamir köşesi',
    width: 1100,
    height: 1467,
    status: 'okul',
    hasChildFaces: true,
  },
  candyCorner: {
    src: '/seker-kosesi.webp',
    alt: 'Şeker Anaokulu yazılı fotoğraf köşesi: kırmızı beyaz çizgili tente ve dev lolipoplar',
    width: 1100,
    height: 1467,
    status: 'okul',
    hasChildFaces: true,
  },
  giraffes: {
    src: '/zurafalar.webp',
    alt: 'Bahçedeki iki zürafa heykelinin yanında duran çocuklar',
    width: 1100,
    height: 1467,
    status: 'okul',
    hasChildFaces: true,
  },
  giraffesGarden: {
    src: '/zurafalar-bahce.webp',
    alt: 'Çam ağaçlarının altındaki zürafa heykelleri ve bahçede oynayan çocuklar',
    width: 1100,
    height: 1467,
    status: 'okul',
    hasChildFaces: true,
  },
} satisfies Record<string, MediaAsset>;

export type MediaKey = keyof typeof MEDIA;

/**
 * Okulun kendi çekimiyle değiştirilmesi gereken lisanssız stok görseller.
 * Şu an boş; biri kataloğa 'stok' kayıt eklerse burada görünür ve
 * content/__tests__/media.test.ts kırmızıya döner.
 */
export function pendingShootAssets(): MediaKey[] {
  return (Object.entries(MEDIA) as [MediaKey, MediaAsset][])
    .filter(([, asset]) => asset.status === 'stok')
    .map(([key]) => key);
}

/** Çocuk yüzü olan kareler — gözler scripts/blur-child-faces.mjs ile yumuşak blurlandı. */
export function assetsWithChildFaces(): MediaKey[] {
  return (Object.entries(MEDIA) as [MediaKey, MediaAsset][])
    .filter(([, asset]) => asset.hasChildFaces === true)
    .map(([key]) => key);
}
