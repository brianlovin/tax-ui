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
    <span className={cn("relative inline-flex items-center", colorClass)}>
      <span className="absolute right-full mr-1 origin-right translate-y-px scale-90 text-xs font-medium whitespace-nowrap tabular-nums opacity-0 transition-all duration-100 ease-out group-hover:scale-100 group-hover:opacity-100">
        {formatPercentChange(current, previous)}
      </span>
      <TriangleIcon size={12} direction={isPositive ? "up" : "down"} />
    </span>
  );
}
