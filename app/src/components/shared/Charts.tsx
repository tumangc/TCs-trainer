const ACCENT = '#9184d9';

/** A bar chart from normalized (0-1) values. One bar can be highlighted —
 * used for "this week" / "today" in the load ramp and volume charts. */
export function BarChart({
  values,
  highlightIndex,
  width = 300,
  height = 78,
  dimColor = '#423a6a',
  fadeColor = '#2b2741',
}: {
  values: number[];
  highlightIndex?: number;
  width?: number;
  height?: number;
  dimColor?: string;
  fadeColor?: string;
}) {
  const gap = width / values.length;
  const barWidth = gap * 0.72;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} role="presentation">
      {values.map((v, i) => {
        const h = Math.max(4, v * height);
        const x = i * gap + (gap - barWidth) / 2;
        const y = height - h;
        const fill = i === highlightIndex ? ACCENT : i < (highlightIndex ?? values.length) ? dimColor : fadeColor;
        return <rect key={i} x={x} y={y} width={barWidth} height={h} rx={2.5} fill={fill} />;
      })}
    </svg>
  );
}

export interface LineSeries {
  values: number[];
  stroke: string;
  dashed?: boolean;
  fill?: boolean;
}

/** A line chart from one or more normalized (0-1) series, evenly spaced on x.
 * Values are 0 (bottom) to 1 (top). Optionally fills the first series and
 * marks pinned points with a ring. */
export function LineChart({
  series,
  width = 300,
  height = 120,
  gridLines = 3,
  pinnedIndices,
  goalLine,
}: {
  series: LineSeries[];
  width?: number;
  height?: number;
  gridLines?: number;
  pinnedIndices?: number[];
  goalLine?: number;
}) {
  const toPoints = (values: number[]) => {
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    return values.map((v, i) => [i * step, height - v * height] as const);
  };
  const pointsToAttr = (pts: readonly (readonly [number, number])[]) =>
    pts.map(([x, y]) => `${x},${y}`).join(' ');

  const primary = series[0] ? toPoints(series[0].values) : [];
  const gradientId = 'chart-fill';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} role="presentation">
      {series[0]?.fill && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0].stroke} stopOpacity=".3" />
            <stop offset="100%" stopColor={series[0].stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      <g stroke="#292b31">
        {Array.from({ length: gridLines }, (_, i) => {
          const y = (height / (gridLines + 1)) * (i + 1);
          return <line key={i} x1={0} y1={y} x2={width} y2={y} />;
        })}
      </g>
      {goalLine !== undefined && (
        <line
          x1={0}
          y1={height - goalLine * height}
          x2={width}
          y2={height - goalLine * height}
          stroke={ACCENT}
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.55}
        />
      )}
      {series[0]?.fill && primary.length > 0 && (
        <path
          d={`M${pointsToAttr(primary)} L${width} ${height} L0 ${height} Z`}
          fill={`url(#${gradientId})`}
        />
      )}
      {series.map((s, i) => {
        const pts = i === 0 ? primary : toPoints(s.values);
        return (
          <polyline
            key={i}
            points={pointsToAttr(pts)}
            fill="none"
            stroke={s.stroke}
            strokeWidth={s.dashed ? 1.5 : 2}
            strokeDasharray={s.dashed ? '4 4' : undefined}
            strokeLinejoin="round"
          />
        );
      })}
      {pinnedIndices?.map((i) => {
        const pt = primary[i];
        if (!pt) return null;
        return <circle key={i} cx={pt[0]} cy={pt[1]} r={4} fill="#161826" stroke={series[0]?.stroke ?? ACCENT} strokeWidth={2} />;
      })}
    </svg>
  );
}
