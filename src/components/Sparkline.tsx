import { useId } from "react";
import { motion } from "motion/react";

interface Props {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  activeIndex?: number | null;
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  className = "",
  activeIndex,
}: Props) {
  const gradientId = useId();

  if (values.length < 2) {
    return <svg width={width} height={height} className={className} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 2;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = values.map((value, i) => {
    const x = padding + (i / (values.length - 1)) * innerWidth;
    const y = padding + innerHeight - ((value - min) / range) * innerHeight;
    return { x, y };
  });

  // Build smooth curve using cubic bezier with control points
  const lineD = (() => {
    if (points.length === 2) {
      return `M ${points[0]!.x},${points[0]!.y} L ${points[1]!.x},${points[1]!.y}`;
    }

    let d = `M ${points[0]!.x},${points[0]!.y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]!;
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const p3 = points[Math.min(points.length - 1, i + 2)]!;

      // Catmull-Rom to Cubic Bezier conversion
      const tension = 6;
      const cp1x = p1.x + (p2.x - p0.x) / tension;
      const cp1y = p1.y + (p2.y - p0.y) / tension;
      const cp2x = p2.x - (p3.x - p1.x) / tension;
      const cp2y = p2.y - (p3.y - p1.y) / tension;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    return d;
  })();

  const firstPoint = points[0]!;
  const lastPoint = points[points.length - 1]!;
  const bottom = height - padding;
  const areaD = `${lineD} L ${lastPoint.x},${bottom} L ${firstPoint.x},${bottom} Z`;

  const activePoint =
    activeIndex !== undefined && activeIndex !== null
      ? points[activeIndex]
      : null;

  const lineGradientId = `${gradientId}-line`;

  return (
    <svg width={width} height={height} className={className} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.25} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={lineGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0} />
          <stop offset="30%" stopColor="currentColor" stopOpacity={0.3} />
          <stop offset="70%" stopColor="currentColor" stopOpacity={0.3} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path
        d={lineD}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {activePoint && (
        <>
          <motion.line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={0}
            y2={height}
            stroke={`url(#${lineGradientId})`}
            strokeWidth={1}
            initial={false}
            animate={{ x1: activePoint.x, x2: activePoint.x }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
          <motion.circle
            r={3}
            fill="var(--color-bg)"
            stroke="currentColor"
            strokeWidth={1.5}
            initial={false}
            animate={{ cx: activePoint.x, cy: activePoint.y }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </>
      )}
    </svg>
  );
}
