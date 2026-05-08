"use client";

export interface PieSlice {
  label: string;
  value: number;
}

const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#6366f1",
];

function buildPaths(slices: PieSlice[]) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return [];

  let currentAngle = -Math.PI / 2; // 12時スタート
  const R = 80;
  const cx = 100, cy = 100;

  return slices.map((slice, i) => {
    const angle = (slice.value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(currentAngle);
    const y1 = cy + R * Math.sin(currentAngle);
    currentAngle += angle;
    const x2 = cx + R * Math.cos(currentAngle);
    const y2 = cy + R * Math.sin(currentAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const d = [
      `M ${cx} ${cy}`,
      `L ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      "Z",
    ].join(" ");

    return { d, color: PALETTE[i % PALETTE.length], label: slice.label, value: slice.value };
  });
}

interface PieChartProps {
  title: string;
  slices: PieSlice[];
  unit?: string;
}

export function PieChart({ title, slices, unit = "枚" }: PieChartProps) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const paths = buildPaths(slices);
  const fmt = (n: number) => new Intl.NumberFormat("ja-JP").format(n);

  if (total === 0) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">{title}</h3>
        <p className="text-sm text-[var(--muted-foreground)] text-center py-8">データなし</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">{title}</h3>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* SVGパイチャート */}
        <div className="shrink-0">
          <svg viewBox="0 0 200 200" width="160" height="160">
            {/* ドーナツ穴 */}
            {paths.map((p) => (
              <path key={p.label} d={p.d} fill={p.color} stroke="white" strokeWidth="1.5" />
            ))}
            {/* 中央テキスト */}
            <circle cx="100" cy="100" r="48" fill="var(--card)" />
            <text x="100" y="95" textAnchor="middle" fontSize="11" fill="var(--foreground)" fontWeight="600">
              合計
            </text>
            <text x="100" y="112" textAnchor="middle" fontSize="13" fill="var(--primary)" fontWeight="700">
              {fmt(total)}{unit}
            </text>
          </svg>
        </div>

        {/* 凡例 */}
        <div className="flex-1 space-y-1.5 w-full">
          {paths.map((p) => {
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0";
            return (
              <div key={p.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-xs text-[var(--foreground)] flex-1 truncate" title={p.label}>
                  {p.label}
                </span>
                <span className="text-xs font-semibold text-[var(--foreground)] tabular-nums whitespace-nowrap">
                  {fmt(p.value)}{unit}
                </span>
                <span className="text-xs text-[var(--muted-foreground)] w-10 text-right tabular-nums">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
