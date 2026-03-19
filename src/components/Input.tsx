import * as React from "react";

import { cn } from "../lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-1 text-sm text-(--color-text)",
          "placeholder:text-(--color-text-muted)",
          "focus:border-(--color-brand) focus:ring-2 focus:ring-(--color-brand)/50 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
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
