export type Teacher = {
  id: string;
  name: string;
  role: string;
  education: string;
  experience: string;
  photo: string;
};

// TODO: Gerçek kadro bilgileriyle doldurun. public/kadro/kurucu.webp şu an
// geçici bir görseldir (psikolog.webp kopyası); gerçek fotoğraf temin
// edildiğinde bu dosyanın üzerine yazılmalı. Her öğretmenden yazılı izin alın (KVKK).
export const TEACHERS: Teacher[] = [
  {
    id: 'kurucu',
    name: 'TODO: Kurucu adı',
    role: 'Kurucu ve Okul Müdürü',
    education: 'TODO: Üniversite ve bölüm',
    experience: 'TODO: Kaç yıllık deneyim, önceki kurumlar',
    photo: '/kadro/kurucu.webp',
  },
];
