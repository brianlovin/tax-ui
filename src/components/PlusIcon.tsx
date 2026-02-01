import { cn } from "../lib/cn";

interface PlusIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function PlusIcon({
  size = 20,
  strokeWidth = 2,
  className,
}: PlusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      <path d="M12 5.75V18.25" />
      <path d="M18.25 12L5.75 12" />
    </svg>
  );
}
