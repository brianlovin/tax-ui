import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  sideOffset?: number;
  delay?: number;
}

export function Tooltip({ content, children, sideOffset = 6, delay }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger
        delay={delay}
        className="text-(--color-text-muted) hover:text-(--color-text)"
      >
        {children}
      </BaseTooltip.Trigger>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={sideOffset}>
          <BaseTooltip.Popup className="rounded-lg bg-white px-2.5 py-1.5 text-xs text-(--color-text) shadow-sm ring-[0.5px] ring-black/10 dark:bg-neutral-800 dark:ring-white/20">
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
