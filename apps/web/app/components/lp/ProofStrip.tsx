import type { Reader } from '@/lib/content/types';

type Point = { id: string; value: string; label: string };

/**
 * Okulun rakamları — reklam sayfasının ilk ekranında, başlığın altında kısa bir şerit.
 * Telefonda ilk üç rakam tek satırda; dördüncüsü (varsa) yalnız geniş ekranda görünür.
 */
export default function ProofStrip({ c, listKey }: { c: Reader; listKey: string }) {
  const points = c.list<Point>(listKey);
  if (points.length === 0) return null;
  return (
    <dl
      className="mt-6 grid grid-cols-3 border-y border-rule py-4 sm:grid-cols-4 lg:mt-7"
      {...c.listAttrs(listKey)}
    >
      {points.map((point, i) => (
        <div key={point.id} className={`min-w-0 border-l border-rule px-3 first:border-l-0 first:pl-0 ${i >= 3 ? 'hidden sm:block' : ''}`}>
          <dt className="font-display text-[1.375rem] leading-none font-semibold text-ink lg:text-[1.625rem]" {...c.attrs(listKey, `${point.id}.value`)}>
            {c.fill(point.value)}
          </dt>
          <dd className="mt-1.5 text-[13px] leading-snug text-ink-soft" {...c.attrs(listKey, `${point.id}.label`)}>
            {c.fill(point.label)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
