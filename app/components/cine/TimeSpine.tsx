import Timecode from './Timecode';
import { chapterLabel, type DayChapter } from '@/content/day';

/**
 * Zaman omurgası — indexing. Kaydırmayla ilerleyen kamera konumu,
 * aynı zamanda bölüm navigasyonu.
 *
 * Gösterge her zaman `chapterLabel()` üzerinden okunur — saat doğrulanana
 * kadar bu, gerçek bir saat değil sahne sırasıdır (bkz. content/day.ts).
 */
export default function TimeSpine({ chapters }: { chapters: DayChapter[] }) {
  return (
    <nav
      aria-label="Günün bölümleri"
      className="hidden lg:block sticky top-24 h-fit border-l border-rule pl-5"
    >
      <ol className="space-y-3">
        {chapters.map((chapter) => (
          <li key={chapter.id} className="cine-spine-item">
            <a href={`#${chapter.id}`} className="group block hover:opacity-100">
              <Timecode className="block group-hover:text-ink">
                {chapterLabel(chapter)}
              </Timecode>
              <span className="text-sm text-ink-soft group-hover:text-ink">
                {chapter.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
