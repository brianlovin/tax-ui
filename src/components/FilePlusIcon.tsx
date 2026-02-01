import { cn } from "../lib/cn";

interface FilePlusIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function FilePlusIcon({
  size = 20,
  strokeWidth = 2,
  className,
}: FilePlusIconProps) {
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
      <path d="M12.75 4.75H7.75C6.64543 4.75 5.75 5.64543 5.75 6.75V17.25C5.75 18.3546 6.64543 19.25 7.75 19.25H12.25M12.75 4.75V8.25C12.75 9.35457 13.6454 10.25 14.75 10.25H18.25L12.75 4.75Z" />
      <path d="M17 14.75V19.25" />
      <path d="M19.25 17H14.75" />
    </svg>
  );
}
