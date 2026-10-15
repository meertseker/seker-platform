/**
 * Künye — bu sitenin imza öğesi.
 * Sınıftaki çocuk ve öğretmen sayısını işaret işaret gösterir, altında
 * MEB üst sınırını soluk konturla karşılaştırır. Argüman cümlede değil,
 * iki sıra arasındaki boşlukta.
 *
 * Jitter dizisi sabittir — Math.random SSR/CSR uyumsuzluğu yaratır.
 */
const JITTER = [0, 1.1, -0.8, 0.5, -1.3, 0.9, -0.4, 1.4, -1.0, 0.3];

function jitter(index: number): number {
  return JITTER[index % JITTER.length];
}

const PER_ROW = 5;
const GAP = 26;
const PADDING = 14;
const TEACHER_START_OFFSET = 12;
const TEACHER_GAP = 22;
const TEACHER_WIDTH = 13;
const TEACHER_HEIGHT = 22;

export default function Roster({
  childCount,
  teacherCount,
  limit,
  countLabel,
  limitLabel,
}: {
  childCount: number;
  teacherCount: number;
  /** MEB üst sınırı. Verilmezse karşılaştırma satırı çizilmez. */
  limit?: number;
  /** Düzenlenebilir sayfalarda altyazı metinleri içerik alanından gelir; verilmezse varsayılan yazım kullanılır. */
  countLabel?: string;
  limitLabel?: string;
}) {
  // En az 1 satır: childCount=0 durumunda `rows=0` olsaydı childHeight=0'a
  // düşer ve öğretmen işaretleri viewBox'ın üstüne (negatif y) taşardı.
  const rows = Math.max(1, Math.ceil(childCount / PER_ROW));
  const childBlockWidth = PER_ROW * GAP;
  const childHeight = rows * GAP;

  // Genişlik öğretmen sayısına göre hesaplanır. Sabit bir genişlik (ör. 220)
  // 3'ten fazla öğretmende son işareti viewBox kenarından taşırırdı
  // (142 + (n-1)*22 + 13 > 220 iken n=4'te taşma başlıyordu).
  const teacherAreaWidth =
    teacherCount > 0
      ? TEACHER_START_OFFSET + (teacherCount - 1) * TEACHER_GAP + TEACHER_WIDTH
      : 0;
  const width = childBlockWidth + teacherAreaWidth + PADDING * 2;

  const limitRows = limit ? Math.ceil(limit / 10) : 0;
  const height = childHeight + (limit ? limitRows * 18 + 34 : 0) + PADDING;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-sm" aria-hidden="true">
        {Array.from({ length: childCount }, (_, i) => (
          <circle
            key={`c${i}`}
            data-mark="child"
            className="roster-mark"
            style={{ animationDelay: `${i * 45}ms` }}
            cx={(i % PER_ROW) * GAP + PADDING + jitter(i)}
            cy={Math.floor(i / PER_ROW) * GAP + PADDING + jitter(i + 3)}
            r={8.2 + jitter(i) * 0.35}
            fill="var(--color-mark)"
          />
        ))}

        {Array.from({ length: teacherCount }, (_, i) => (
          <rect
            key={`t${i}`}
            data-mark="teacher"
            className="roster-mark"
            style={{ animationDelay: `${(childCount + i) * 45}ms` }}
            x={childBlockWidth + TEACHER_START_OFFSET + i * TEACHER_GAP}
            y={childHeight / 2 - TEACHER_HEIGHT / 2 + jitter(i) * 1.5}
            width={TEACHER_WIDTH}
            height={TEACHER_HEIGHT}
            rx={6.5}
            fill="var(--color-ink)"
          />
        ))}

        {limit ? (
          <g transform={`translate(0 ${childHeight + 26})`}>
            {Array.from({ length: limit }, (_, i) => (
              <circle
                key={`l${i}`}
                data-mark="limit"
                cx={(i % 10) * 15 + 8}
                cy={Math.floor(i / 10) * 18 + 8}
                r={5.4}
                fill="none"
                stroke="var(--color-rule)"
                strokeWidth={1.2}
              />
            ))}
          </g>
        ) : null}
      </svg>

      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <span className="timecode text-ink">
          {countLabel ?? `${childCount} çocuk, ${teacherCount} öğretmen`}
        </span>
        {limit ? <span className="timecode text-ink-soft">{limitLabel ?? `MEB üst sınırı ${limit}`}</span> : null}
      </figcaption>
    </figure>
  );
}
