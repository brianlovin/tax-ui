import { cn } from "../lib/cn";

interface TrashIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function TrashIcon({
  size = 20,
  strokeWidth = 2,
  className,
}: TrashIconProps) {
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
      <path d="M5.75 7.75L6.59115 17.4233C6.68102 18.4568 7.54622 19.25 8.58363 19.25H14.4164C15.4538 19.25 16.319 18.4568 16.4088 17.4233L17.25 7.75H5.75Z" />
      <path d="M9.75 10.75V16.25" />
      <path d="M13.25 10.75V16.25" />
      <path d="M8.75 7.75V6.75C8.75 5.64543 9.64543 4.75 10.75 4.75H12.25C13.3546 4.75 14.25 5.64543 14.25 6.75V7.75" />
      <path d="M4.75 7.75H18.25" />
    </svg>
  );
}
