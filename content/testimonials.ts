export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  context: string;
  source: 'google' | 'form' | 'yuz-yuze';
  /** false ise yorum henüz veliden yazılı onay ile alınmamıştır; hiçbir yerde render edilmez. */
  ready: boolean;
};

// TODO: Gerçek yorumlarla doldurun. Her veliden yayın için yazılı onay alın.
// Yorumu alırken "Beykent", "servis", "Montessori" gibi kelimelerin geçmesi
// hem sosyal kanıt hem yerel SEO değeri taşır.
export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'ornek-1',
    quote: 'TODO: Gerçek veli yorumu.',
    author: 'TODO A.',
    context: 'TODO: 4 yaş velisi, 2 yıldır',
    source: 'google',
    ready: false,
  },
];

/** Yayına hazır yorumlar — render edilecek tek liste budur. Gerçek onay alınmadan `ready: true` yapılmaz. */
export const PUBLISHED_TESTIMONIALS = TESTIMONIALS.filter((item) => item.ready);
