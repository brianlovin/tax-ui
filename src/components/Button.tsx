import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger"
  | "danger-outline"
  | "pill";
type Size = "sm" | "md";

interface ButtonProps extends Omit<
  ComponentProps<typeof BaseButton>,
  "className"
> {
  variant?: Variant;
  size?: Size;
  iconOnly?: boolean;
  className?: string;
  children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-(--color-text) text-(--color-bg) hover:opacity-90",
  secondary:
    "bg-(--color-bg-muted) text-(--color-text) hover:bg-(--color-bg-muted-hover)",
  ghost:
    "text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-bg-muted)",
  outline:
    "border border-(--color-border) text-(--color-text-muted) hover:border-(--color-text-muted) hover:text-(--color-text)",
  danger: "bg-red-500 text-white hover:bg-red-600",
  "danger-outline":
    "border border-red-400/50 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500",
  pill: "rounded-full! dark:shadow-contrast bg-black text-white dark:bg-zinc-800 shadow-lg hover:scale-105 transition-transform",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

const iconOnlySizeStyles: Record<Size, string> = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
};

export function Button({
  variant = "primary",
  size = "md",
  iconOnly = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      className={cn(
        "font-medium select-none",
        "rounded-lg outline-none",
        "focus-visible:ring-2 focus-visible:ring-(--color-text-muted) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-bg)",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        iconOnly
          ? `${iconOnlySizeStyles[size]} flex items-center justify-center`
          : sizeStyles[size],
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </BaseButton>
  );
}
