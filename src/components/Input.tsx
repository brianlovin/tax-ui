import * as React from "react";

import { cn } from "../lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  prefix?: React.ReactNode;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, prefix, ...props }, ref) => {
    if (prefix) {
      return (
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 text-sm text-(--color-text-muted)">
            {prefix}
          </span>
          <input
            type={type}
            className={cn(
              "flex h-8 w-full rounded-lg border border-(--color-border) bg-(--color-bg) py-1 pr-3 pl-7 text-sm text-(--color-text)",
              "placeholder:text-(--color-text-muted)",
              "focus:border-(--color-brand) focus:ring-2 focus:ring-(--color-brand)/50 focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              // Hide number spinners
              "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              "[appearance:textfield]",
              "[-moz-appearance:textfield]",
              className,
            )}
            ref={ref}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-1 text-sm text-(--color-text)",
          "placeholder:text-(--color-text-muted)",
          "focus:border-(--color-brand) focus:ring-2 focus:ring-(--color-brand)/50 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Hide number spinners
          "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          "[appearance:textfield]",
          "[-moz-appearance:textfield]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
