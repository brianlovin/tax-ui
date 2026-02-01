import { cn } from "../lib/cn";
import { formatPercentChange } from "../lib/format";
import { TriangleIcon } from "./TriangleIcon";

interface Props {
  current: number | undefined;
  previous: number | undefined;
  invertPolarity?: boolean;
}

export function ChangeCell({ current, previous, invertPolarity }: Props) {
  if (current === undefined || previous === undefined || previous === 0) {
    return null;
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = change >= 0;
  const isGood = invertPolarity ? !isPositive : isPositive;
  const colorClass = isGood
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";

  return (
    <span className={cn("inline-flex items-center relative", colorClass)}>
      <span className="absolute right-full mr-1 translate-y-px opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-100 ease-out origin-right text-xs font-medium tabular-nums whitespace-nowrap">
        {formatPercentChange(current, previous)}
      </span>
      <TriangleIcon size={12} direction={isPositive ? "up" : "down"} />
    </span>
  );
}
