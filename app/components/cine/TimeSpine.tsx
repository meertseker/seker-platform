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
      className="sticky top-24 hidden h-fit rounded-3xl bg-paper-warm p-5 lg:block"
    >
      <ol className="space-y-1">
        {chapters.map((chapter) => (
          <li key={chapter.id} className="cine-spine-item">
            <a
              href={`#${chapter.id}`}
              className="group block rounded-xl px-3 py-2 transition-colors hover:bg-white"
            >
              <Timecode className="block">{chapterLabel(chapter)}</Timecode>
              <span className="text-sm font-semibold text-ink group-hover:text-grape">
                {chapter.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
