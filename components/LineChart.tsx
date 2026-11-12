import { money } from "@/lib/dashboard";

// Simple SVG line chart for money-over-time on the dashboard. No chart
// library and no new dependency: each series is a line with a dot at
// every data point, a real x-axis (dates/months below) and y-axis
// (money values with a label, light gridlines at the y ticks). This
// replaced the bar chart: the bar chart put a money label above every
// bar, and with 13 weekly bars the labels ran into each other. Here
// exact values live in the table above the chart and on each dot's
// <title> (a native hover tooltip) — no text label is drawn above a
// dot, so nothing can overlap. The same numbers also stay in the table
// above the chart, so the chart is a visual aid, not the only copy of
// the data.
export type LineSeries = {
  label: string;
  color: string;
  values: number[];
};

const W = 720;
const H = 280;
const LEFT = 64; // room for the y tick labels and the y-axis title
const RIGHT = 16;
const TOP = 16;
const BOTTOM = 36;
const PLOT_W = W - LEFT - RIGHT;
const PLOT_H = H - TOP - BOTTOM;

// Money values on the y-axis, without cents: "$5,435" reads better on
// an axis than "$5,435.00".
function axisMoney(v: number): string {
  return "$" + Math.round(v).toLocaleString("en-US");
}

// Series colours are theme-aware. The dashboard passes the light-mode
// hexes (rose #a05a66, gold #8a6d1f); they map to the CSS variables
// --chart-rose/--chart-gold, which are the same colours in light mode
// and lighter, readable variants in dark mode. Unknown colours pass
// through unchanged. The variables are applied via inline style (not
// SVG attributes) so the chart re-colours the moment the theme flips.
function seriesColor(hex: string): string {
  if (hex === "#a05a66") return "var(--chart-rose)";
  if (hex === "#8a6d1f") return "var(--chart-gold)";
  return hex;
}

// "Nice" y ticks: a round step (1 / 2 / 5 / 10 x a power of ten) that
// gives about 4 intervals, spanning the data (0 at the bottom unless a
// value is negative — profits can be, in principle).
function niceTicks(lo: number, hi: number): number[] {
  if (hi <= lo) return [lo];
  const raw = (hi - lo) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (
    let v = Math.ceil(lo / step) * step;
    v <= hi + step / 2;
    v += step
  ) {
    ticks.push(Math.round(v));
  }
  return ticks.length > 0 ? ticks : [Math.round(lo)];
}

export default function LineChart({
  title,
  yLabel,
  labels,
  series,
}: {
  title: string;
  yLabel: string;
  labels: string[];
  series: LineSeries[];
}) {
  const allValues = series.flatMap((s) => s.values);
  const lo = Math.min(0, ...allValues);
  const hi = Math.max(1, ...allValues);
  const ticks = niceTicks(lo, hi);
  const n = Math.max(1, labels.length);

  const x = (i: number) => LEFT + (i / Math.max(1, n - 1)) * PLOT_W;
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * PLOT_H;

  // Highest point, for the screen-reader summary.
  let peak = -Infinity;
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
                style={{ background: seriesColor(s.color) }}
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
        aria-label={`Line chart: ${title}. Highest ${money(peak)}${peakLabel ? ` (${peakLabel})` : ""}. Values are also in the table above.`}
      >
        {/* Horizontal gridlines + y tick labels. */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={LEFT}
              y1={y(t)}
              x2={W - RIGHT}
              y2={y(t)}
              style={{ stroke: "var(--chart-grid)" }}
              strokeWidth={1}
            />
            <text
              x={LEFT - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              style={{ fill: "var(--chart-axis)" }}
            >
              {axisMoney(t)}
            </text>
          </g>
        ))}
        {/* Axes. */}
        <line
          x1={LEFT}
          y1={TOP + PLOT_H}
          x2={W - RIGHT}
          y2={TOP + PLOT_H}
          style={{ stroke: "var(--chart-axis-line)" }}
          strokeWidth={1}
        />
        <line
          x1={LEFT}
          y1={TOP}
          x2={LEFT}
          y2={TOP + PLOT_H}
          style={{ stroke: "var(--chart-axis-line)" }}
          strokeWidth={1}
        />
        {/* Y-axis title, rotated. */}
        <text
          transform={`rotate(-90 ${14} ${TOP + PLOT_H / 2})`}
          x={14}
          y={TOP + PLOT_H / 2}
          textAnchor="middle"
          fontSize={12}
          style={{ fill: "var(--chart-axis)" }}
        >
          {yLabel}
        </text>
        {/* X labels below the axis. */}
        {labels.map((label, i) => (
          <text
            key={label}
            x={x(i)}
            y={TOP + PLOT_H + 20}
            textAnchor="middle"
            fontSize={12}
            style={{ fill: "var(--chart-axis)" }}
          >
            {label}
          </text>
        ))}
        {/* One line + dots per series. The <title> on each dot is the
            native hover tooltip carrying the exact value. It MUST
            be a single string child (one template literal): React
            18's server renderer drops the children of a <title>
            with several children ({label}: {money} as separate
            text nodes), emitting an empty <title></title> in the
            server HTML while the client render has the text — a
            hydration mismatch ("Expected server HTML to contain a
            matching text node for 'Jul 27' in <title>") on every
            chart. A single string child renders identically on
            server and client. Do not split it back into parts. */}
        {series.map((s) => (
          <g key={s.label}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              style={{ stroke: seriesColor(s.color) }}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r={4.5}
                style={{ fill: seriesColor(s.color), stroke: "var(--chart-dot-stroke)" }}
                strokeWidth={1.5}
              >
                <title>{`${labels[i]}: ${money(v)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
    </figure>
  );
}
