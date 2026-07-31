import Image from 'next/image';
import { MEDIA, type MediaKey } from '@/content/media';

export type Grade = 'dawn' | 'morning' | 'midday' | 'golden' | 'dusk' | 'none';

const GRADE_TINT: Record<Grade, string> = {
  dawn: 'var(--color-dawn)',
  morning: 'var(--color-morning)',
  midday: 'var(--color-midday)',
  golden: 'var(--color-golden)',
  dusk: 'var(--color-dusk)',
  none: 'transparent',
};

const GRADE_OPACITY: Record<Grade, string> = {
  dawn: '0.22',
  morning: '0.16',
  midday: '0.14',
  golden: '0.18',
  dusk: '0.26',
  none: '0',
};

/**
 * Kadraj — bracketing. Fotoğrafı sinema oranında çerçeveler ve o sahnenin
 * ışığına göre derecelendirir.
 * Mobilde 4:5 kullanılır; 2.39:1 bir 375 px ekranda 157 px'lik şerit olur.
 */
export default function Frame({
  mediaKey,
  grade = 'none',
  ratio = 'cinema',
  priority = false,
  sizes = '(max-width: 768px) 100vw, 1100px',
}: {
  mediaKey: MediaKey;
  grade?: Grade;
  ratio?: 'cinema' | 'portrait';
  priority?: boolean;
  sizes?: string;
}) {
  const asset = MEDIA[mediaKey];
  const ratioClass =
    ratio === 'cinema' ? 'aspect-[4/5] md:aspect-[2.39/1]' : 'aspect-[4/5] md:aspect-[3/2]';

  return (
    <div className={`relative w-full overflow-hidden bg-paper-warm ${ratioClass}`}>
      <Image
        src={asset.src}
        alt={asset.alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
      />
      {grade !== 'none' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 mix-blend-multiply"
          style={{ backgroundColor: GRADE_TINT[grade], opacity: GRADE_OPACITY[grade] }}
        />
      ) : null}
    </div>
  );
}
