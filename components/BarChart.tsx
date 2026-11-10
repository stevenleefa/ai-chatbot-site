import { money } from "@/lib/dashboard";

// Simple SVG bar chart for money-over-time on the dashboard. No chart
// library and no new dependency: bars scale to the largest value, each
// bar is labelled with its money value on top and its date below. The
// same numbers also stay in the table above the chart, so the chart is
// a visual aid, not the only copy of the data.
export type BarSeries = {
  label: string;
  color: string;
  values: number[];
};

const W = 720;
const H = 250;
const TOP_PAD = 26;
const BOTTOM_PAD = 26;
const BAR_AREA = H - TOP_PAD - BOTTOM_PAD;
const BASELINE = TOP_PAD + BAR_AREA;

export default function BarChart({
  title,
  labels,
  series,
}: {
  title: string;
  labels: string[];
  series: BarSeries[];
}) {
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(1, ...allValues.map((v) => Math.max(0, v)));
  const groupW = W / Math.max(1, labels.length);
  const barW = (groupW * 0.62) / series.length;
  const gap = (groupW * 0.38) / (series.length + 1);

  // Highest bar, for the screen-reader summary.
  let peak = 0;
  let peakLabel = "";
  series.forEach((s) => {
    s.values.forEach((v, i) => {
      if (v > peak) {
        peak = v;
        peakLabel = labels[i] ?? "";
      }
    });
  });

  return (
    <figure className="dash-chart">
      <figcaption>{title}</figcaption>
      {series.length > 1 && (
        <div className="dash-chart-legend">
          {series.map((s) => (
            <span key={s.label}>
              <span
                className="dash-chart-swatch"
                style={{ background: s.color }}
              />{" "}
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Bar chart: ${title}. Highest ${money(peak)}${peakLabel ? ` (${peakLabel})` : ""}. Values are also in the table above.`}
      >
        <line x1={0} y1={BASELINE} x2={W} y2={BASELINE} stroke="#eee2d6" strokeWidth={1} />
        {labels.map((label, i) => {
          const groupX = i * groupW;
          return (
            <g key={label}>
              {series.map((s, j) => {
                const value = Math.max(0, s.values[i] ?? 0);
                const h = (value / max) * BAR_AREA;
                const x = groupX + gap + j * (barW + gap);
                const y = BASELINE - h;
                return (
                  <g key={s.label}>
                    <rect x={x} y={y} width={barW} height={h} rx={4} fill={s.color} />
                    <text
                      x={x + barW / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize={12}
                      fill="#3d2433"
                    >
                      {money(value)}
                    </text>
                  </g>
                );
              })}
              <text
                x={groupX + groupW / 2}
                y={BASELINE + 18}
                textAnchor="middle"
                fontSize={12}
                fill="#6b5560"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
