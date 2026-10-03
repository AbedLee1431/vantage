/**
 * Lightweight SVG bar chart (no charting dependency — Phase 2 trends are simple
 * time buckets; Recharts stays deferred until richer charts are needed).
 * Includes a text summary for screen readers; exact values sit in the table below.
 */

export function TrendBars({
  title,
  labels,
  values,
  id,
}: {
  title: string;
  labels: string[];
  values: number[];
  id: string;
}) {
  const width = 640;
  const height = 180;
  const paddingBottom = 28;
  const paddingTop = 12;
  const max = Math.max(1, ...values);
  const n = values.length;
  const slot = width / n;
  const barWidth = Math.max(2, slot * 0.6);
  const plotHeight = height - paddingTop - paddingBottom;
  const peak = values.indexOf(max);
  const summary = `${title}: peak ${max} in week of ${labels[peak] ?? "—"}.`;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="w-full"
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{summary}</desc>
        {values.map((value, i) => {
          const barHeight = (value / max) * plotHeight;
          const x = i * slot + (slot - barWidth) / 2;
          const y = paddingTop + plotHeight - barHeight;
          const label = labels[i] ?? "";
          return (
            <g key={`${id}-${i}`}>
              <title>{`${label}: ${value}`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(value > 0 ? 2 : 0, barHeight)}
                rx={2}
                className="fill-accent-600"
              />
              {i % 2 === 0 ? (
                <text
                  x={i * slot + slot / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-slate-400"
                  fontSize={10}
                >
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-slate-500">{summary}</figcaption>
    </figure>
  );
}
