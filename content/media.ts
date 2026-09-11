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
  /** true ise karede yüzü görünen çocuk var; veli izni olmadan yayımlanamaz. */
  hasChildFaces?: boolean;
};

/**
 * Okulun kendi fotoğrafları — 11 Eylül 2026'da okul sahibi tarafından
 * gönderildi. Bahçe ve atölyeler okulun en güçlü farkı olduğu için
 * ana sayfa bu karelerin üzerine kuruludur.
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

  /* ------------------------------------------------------------------
     Aşağıdakilerin hepsi lisanssız Shutterstock önizlemesidir —
     IMAGE-LICENSES.md her birinin Image ID'sini ve fotoğrafçısını
     listeler. Okulun kendi çekimi geldikçe tek tek düşürülmeli.
  ------------------------------------------------------------------ */
  classroomWide: { src: '/cocukklar.webp', alt: 'Anaokulu sınıfında çocuklar ve öğretmenleri', width: 1500, height: 890, status: 'stok' },
  montessori: { src: '/montesori.webp', alt: 'Montessori materyaliyle çalışan çocuk', width: 1500, height: 1100, status: 'stok' },
  art: { src: '/art.webp', alt: 'Sanat atölyesinde resim çalışması', width: 1500, height: 1100, status: 'stok' },
  ceramics: { src: '/seramik.webp', alt: 'Seramik atölyesinde çamur çalışması', width: 1500, height: 1101, status: 'stok' },
  robotics: { src: '/robotic.webp', alt: 'Robotik ve kodlama atölyesi', width: 1500, height: 1101, status: 'stok' },
  chess: { src: '/satranc.webp', alt: 'Satranç dersinde çocuklar', width: 1500, height: 1101, status: 'stok' },
  swimming: { src: '/yuzme.webp', alt: 'Yüzme etkinliği', width: 1500, height: 1101, status: 'stok' },
  music: { src: '/muzik.webp', alt: 'Müzik dersinde enstrüman çalışması', width: 1500, height: 1101, status: 'stok' },
  drama: { src: '/drama.webp', alt: 'Drama atölyesinde canlandırma', width: 1500, height: 1100, status: 'stok' },
  dance: { src: '/dans.webp', alt: 'Dans dersinde çocuklar', width: 1500, height: 1101, status: 'stok' },
  riding: { src: '/binincilik.webp', alt: 'Binicilik etkinliği', width: 1500, height: 1101, status: 'stok' },
  psychologist: { src: '/psikolog.webp', alt: 'Uzman psikolog eşliğinde bireysel çalışma', width: 1500, height: 1101, status: 'stok' },
  motorSkills: { src: '/motorskills.webp', alt: 'İnce motor becerileri çalışması', width: 1500, height: 944, status: 'stok' },
  sports: { src: '/sportiffaaliyetler.webp', alt: 'Sportif faaliyetler', width: 1500, height: 1101, status: 'stok' },
  physicalEducation: { src: '/beden.webp', alt: 'Beden eğitimi dersi', width: 1500, height: 1101, status: 'stok' },
  summer: { src: '/yazaktiviteleri.webp', alt: 'Yaz dönemi etkinlikleri', width: 1500, height: 1070, status: 'stok' },
} satisfies Record<string, MediaAsset>;

export type MediaKey = keyof typeof MEDIA;

/** Okulun kendi çekimiyle değiştirilmesi gereken lisanssız stok görseller. */
export function pendingShootAssets(): MediaKey[] {
  return (Object.keys(MEDIA) as MediaKey[]).filter((key) => MEDIA[key].status === 'stok');
}

/** Veli izni gerektiren kareler — izin onayı alınmadan yayına çıkmamalı. */
export function assetsWithChildFaces(): MediaKey[] {
  return (Object.entries(MEDIA) as [MediaKey, MediaAsset][])
    .filter(([, asset]) => asset.hasChildFaces === true)
    .map(([key]) => key);
}
