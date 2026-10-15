import type { Reader } from '@/lib/content/types';

type Point = { id: string; value: string; label: string };

export default function ProofStrip({ c, listKey }: { c: Reader; listKey: string }) {
  const points = c.list<Point>(listKey);
  return (
    <section className="border-y border-rule bg-paper-warm">
      <dl className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4" {...c.listAttrs(listKey)}>
        {points.map((point) => (
          <div key={point.id}>
            <dt className="font-display text-3xl text-ink md:text-4xl" {...c.attrs(listKey, `${point.id}.value`)}>
              {c.fill(point.value)}
            </dt>
            <dd className="timecode mt-1 text-ink-soft" {...c.attrs(listKey, `${point.id}.label`)}>
              {c.fill(point.label)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
