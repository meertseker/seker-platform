export type ProofPoint = { value: string; label: string };

export default function ProofStrip({ points }: { points: ProofPoint[] }) {
  return (
    <section className="border-y border-rule bg-paper-warm">
      <dl className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
        {points.map((point) => (
          <div key={point.label}>
            <dt className="font-display text-3xl text-ink md:text-4xl">{point.value}</dt>
            <dd className="timecode mt-1 text-ink-soft">{point.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
