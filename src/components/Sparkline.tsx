import type { ChartPoint } from "@/lib/blocks";
import { fmtDay } from "@/lib/clock";

// Inline SVG trend line; highlighted points are the readings behind an alert.
export function Sparkline({ points, highlight = [], threshold, label }: {
  points: ChartPoint[];
  highlight?: number[];
  threshold?: number;
  label?: string;
}) {
  if (points.length < 2) return null;
  const W = 300, H = 64, P = 5;
  const values = points.map((p) => p.value).concat(threshold ?? []);
  const min = Math.min(...values), max = Math.max(...values);
  const x = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const hl = new Set(highlight);

  return (
    <figure>
      {/* Stretches to the card width; non-scaling strokes keep lines and dots crisp. */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full overflow-visible" role="img" aria-label={label ?? "trend"}>
        {threshold !== undefined && (
          <line x1={P} x2={W - P} y1={y(threshold)} y2={y(threshold)} className="stroke-amber-500" strokeDasharray="4 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
        <polyline fill="none" className="stroke-muted-foreground" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} />
        {/* Zero-length round-capped lines draw as true circles even when the SVG is stretched. */}
        {points.map((p, i) => hl.has(p.id) && (
          <line key={p.id} x1={x(i)} x2={x(i)} y1={y(p.value)} y2={y(p.value)} className="stroke-amber-600"
            strokeWidth={7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <figcaption className="flex justify-between text-[11px] text-muted-foreground">
        <span>{fmtDay(points[0].date)}</span>
        {label && <span>{label}</span>}
        <span>{fmtDay(points[points.length - 1].date)}</span>
      </figcaption>
    </figure>
  );
}
