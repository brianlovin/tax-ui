import { cn } from "../lib/cn";
import { formatCurrency } from "../lib/format";

interface RowProps {
  label: string;
  amount: number;
  showSign?: boolean;
  isTotal?: boolean;
  isMuted?: boolean;
}

export function Row({ label, amount, showSign, isTotal, isMuted }: RowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5 text-sm",
        isTotal && "font-medium",
        isMuted && "text-(--color-text-muted)",
      )}
    >
      <span>{label}</span>
      <span className="slashed-zero tabular-nums">{formatCurrency(amount, showSign)}</span>
    </div>
  );
}

interface RateRowProps {
  label: string;
  marginal: string;
  effective: string;
}

export function RateRow({ label, marginal, effective }: RateRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="flex-1">{label}</span>
      <span className="w-20 text-right slashed-zero tabular-nums">{marginal}</span>
      <span className="w-20 text-right slashed-zero tabular-nums">{effective}</span>
    </div>
  );
}
