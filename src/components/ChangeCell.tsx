import { cn } from "../lib/cn";
import { formatPercentChange } from "../lib/format";

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

  return (
    <span
      className={cn(
        "text-xs font-medium px-1.5 py-0.5 rounded-full",
        isGood
          ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950"
          : "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950",
      )}
    >
      {formatPercentChange(current, previous)}
    </span>
  );
}
