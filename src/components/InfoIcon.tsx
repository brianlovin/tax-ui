import { cn } from "../lib/cn";

interface InfoIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function InfoIcon({
  size = 20,
  strokeWidth = 2,
  className,
}: InfoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        d="M12 13V15"
      />
      <circle cx="12" cy="9" r="1" fill="currentColor" />
      <circle
        cx="12"
        cy="12"
        r="7.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
