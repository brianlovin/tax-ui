import { Popover } from "@base-ui/react/popover";
import * as React from "react";

import { cn } from "../lib/cn";
import { Calendar } from "./Calendar";

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const formatValue = (date: Date) => {
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleSelect = (date: Date) => {
    onChange(date);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "inline-flex items-center justify-start rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-1.5 text-left text-sm font-normal text-(--color-text) outline-none hover:bg-(--color-bg-muted) focus-visible:ring-2 focus-visible:ring-(--color-text-muted) focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          !value && "text-(--color-text-muted)",
          className,
        )}
      >
        {value ? formatValue(value) : placeholder}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} style={{ zIndex: 40 }}>
          <Popover.Popup
            className="rounded-lg border border-(--color-border) bg-(--color-bg) shadow-lg"
            style={{ zIndex: 40 }}
          >
            <Popover.Description>
              <Calendar selected={value} onSelect={handleSelect} />
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
