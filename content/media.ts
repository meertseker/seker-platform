export type MediaAsset = {
  /** public/ köküne göre yol. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /**
   * 'stok'   — çekim sonrası değiştirilecek geçici görsel
   * 'gercek' — okulun kendi çekimi
   * Çekim geldiğinde src, boyutlar ve status birlikte güncellenir.
   */
  status: 'stok' | 'gercek';
};

export const MEDIA = {
  classroomWide: { src: '/cocukklar.webp', alt: 'Şeker Anaokulu sınıfında çocuklar ve öğretmenleri', width: 1500, height: 890, status: 'stok' },
  montessori: { src: '/montesori.webp', alt: 'Montessori materyaliyle çalışan çocuk', width: 1500, height: 1100, status: 'gercek' },
  art: { src: '/art.webp', alt: 'Sanat atölyesinde resim çalışması', width: 1500, height: 1100, status: 'gercek' },
  ceramics: { src: '/seramik.webp', alt: 'Seramik atölyesinde çamur çalışması', width: 1500, height: 1101, status: 'gercek' },
  robotics: { src: '/robotic.webp', alt: 'Robotik ve kodlama atölyesi', width: 1500, height: 1101, status: 'gercek' },
  chess: { src: '/satranc.webp', alt: 'Satranç dersinde çocuklar', width: 1500, height: 1101, status: 'gercek' },
  swimming: { src: '/yuzme.webp', alt: 'Yüzme etkinliği', width: 1500, height: 1101, status: 'gercek' },
  music: { src: '/muzik.webp', alt: 'Müzik dersinde enstrüman çalışması', width: 1500, height: 1101, status: 'gercek' },
  drama: { src: '/drama.webp', alt: 'Drama atölyesinde canlandırma', width: 1500, height: 1100, status: 'gercek' },
  dance: { src: '/dans.webp', alt: 'Dans dersinde çocuklar', width: 1500, height: 1101, status: 'gercek' },
  riding: { src: '/binincilik.webp', alt: 'Binicilik etkinliği', width: 1500, height: 1101, status: 'gercek' },
  psychologist: { src: '/psikolog.webp', alt: 'Uzman psikolog eşliğinde bireysel çalışma', width: 1500, height: 1101, status: 'gercek' },
  motorSkills: { src: '/motorskills.webp', alt: 'İnce motor becerileri çalışması', width: 1500, height: 944, status: 'gercek' },
  sports: { src: '/sportiffaaliyetler.webp', alt: 'Sportif faaliyetler', width: 1500, height: 1101, status: 'gercek' },
  physicalEducation: { src: '/beden.webp', alt: 'Beden eğitimi dersi', width: 1500, height: 1101, status: 'gercek' },
  summer: { src: '/yazaktiviteleri.webp', alt: 'Yaz dönemi etkinlikleri', width: 1500, height: 1070, status: 'gercek' },
} satisfies Record<string, MediaAsset>;

export type MediaKey = keyof typeof MEDIA;

/** Çekim sonrası değiştirilmesi gereken görseller. */
export function pendingShootAssets(): MediaKey[] {
  return (Object.keys(MEDIA) as MediaKey[]).filter((key) => MEDIA[key].status === 'stok');
}
