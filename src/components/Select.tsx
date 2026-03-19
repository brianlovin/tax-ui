import * as React from "react";

import { cn } from "../lib/cn";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-8 w-full rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-1 text-sm text-(--color-text)",
          "focus:border-(--color-brand) focus:ring-2 focus:ring-(--color-brand)/50 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "cursor-pointer",
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = "Select";

export { Select };
