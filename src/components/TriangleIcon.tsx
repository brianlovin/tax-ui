import { cn } from "../lib/cn";

interface TriangleIconProps {
  size?: number;
  className?: string;
  direction?: "up" | "down";
}

export function TriangleIcon({
  size = 20,
  className,
  direction = "up",
}: TriangleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn(
        "shrink-0",
        direction === "down" && "rotate-180",
        className
      )}
    >
      <path d="M4.96873 16.3536L10.2052 5.85659C10.9418 4.38482 13.0388 4.38521 13.7748 5.85724L19.0391 16.3543C19.704 17.6842 18.7388 19.25 17.2541 19.25H6.75335C5.26832 19.25 4.30314 17.6835 4.96873 16.3536Z" />
    </svg>
  );
}
