import { cn } from "../lib/cn";

interface XMarkIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function XMarkIcon({
  size = 20,
  strokeWidth = 2,
  className,
}: XMarkIconProps) {
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
      <path d="M17.25 6.75L6.75 17.25" />
      <path d="M6.75 6.75L17.25 17.25" />
    </svg>
  );
}
