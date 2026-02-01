import { Menu as BaseMenu } from "@base-ui/react/menu";
import { LayoutGroup, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

type TriggerVariant = "button" | "inline";

interface MenuProps {
  trigger: ReactNode;
  triggerClassName?: string;
  triggerVariant?: TriggerVariant;
  children: ReactNode;
  popupClassName?: string;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  alignOffset?: number;
}

interface MenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  selected?: boolean;
}

interface MenuContextValue {
  layoutId: string;
  subscribe: (callback: () => void) => () => void;
  getHasHighlight: () => boolean;
  setHighlighted: (id: string, value: boolean) => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

const triggerButtonClassName =
  "p-1.5 rounded-lg text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-bg-muted) data-[popup-open]:text-(--color-text) data-[popup-open]:bg-(--color-bg-muted)";

const triggerInlineClassName =
  "text-(--color-text-muted) flex items-center gap-1 hover:text-(--color-text) data-[popup-open]:text-(--color-text) cursor-pointer";

export const popupBaseClassName =
  "menu-popup bg-(--color-bg) border border-(--color-border) rounded-xl shadow-lg shadow-black/5 dark:shadow-black/20 py-1.5";

// Note: No data-[highlighted] style here - we use motion for the animated highlight
export const itemBaseClassName =
  "menu-item relative mx-1.5 px-2.5 py-1.5 text-sm cursor-pointer rounded-lg outline-none text-(--color-text) flex items-center gap-2.5 select-none";

function useHighlightStore() {
  const highlightedRef = useRef<Set<string>>(new Set());
  const listenersRef = useRef<Set<() => void>>(new Set());

  const subscribe = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  const getHasHighlight = useCallback(() => {
    return highlightedRef.current.size > 0;
  }, []);

  const setHighlighted = useCallback((id: string, value: boolean) => {
    const prev = highlightedRef.current.size > 0;
    if (value) {
      highlightedRef.current.add(id);
    } else {
      highlightedRef.current.delete(id);
    }
    const next = highlightedRef.current.size > 0;
    if (prev !== next) {
      listenersRef.current.forEach((cb) => cb());
    }
  }, []);

  const reset = useCallback(() => {
    highlightedRef.current.clear();
  }, []);

  return { subscribe, getHasHighlight, setHighlighted, reset };
}

export function Menu({
  trigger,
  triggerClassName,
  triggerVariant = "button",
  children,
  popupClassName,
  side,
  align,
  sideOffset,
  alignOffset,
}: MenuProps) {
  const layoutId = useId();
  const { reset, ...store } = useHighlightStore();

  const contextValue = useMemo(
    () => ({
      layoutId,
      ...store,
    }),
    [layoutId, store],
  );

  const baseClassName =
    triggerVariant === "inline"
      ? triggerInlineClassName
      : triggerButtonClassName;

  const positionerProps = {
    className: "z-50",
    ...(side !== undefined && { side }),
    ...(align !== undefined && { align }),
    ...(sideOffset !== undefined && { sideOffset }),
    ...(alignOffset !== undefined && { alignOffset }),
  };

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        reset();
      }
    },
    [reset],
  );

  return (
    <BaseMenu.Root onOpenChange={handleOpenChange}>
      <BaseMenu.Trigger className={cn(baseClassName, triggerClassName)}>
        {trigger}
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner {...positionerProps}>
          <BaseMenu.Popup className={cn(popupBaseClassName, popupClassName)}>
            <LayoutGroup>
              <MenuContext.Provider value={contextValue}>
                {children}
              </MenuContext.Provider>
            </LayoutGroup>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export function MenuItem({
  children,
  onClick,
  className,
  selected,
}: MenuItemProps) {
  const ctx = useContext(MenuContext);
  const itemId = useId();
  const prevHighlightedRef = useRef(false);

  // Track if any item is highlighted (for showing selected state)
  const hasAnyHighlight = useSyncExternalStore(
    ctx?.subscribe ?? (() => () => {}),
    ctx?.getHasHighlight ?? (() => false),
  );

  return (
    <BaseMenu.Item
      onClick={onClick}
      className={cn(itemBaseClassName, selected && "font-medium", className)}
      render={(props) => {
        const dataProps = props as Record<string, unknown>;
        const isHighlighted = dataProps["data-highlighted"] !== undefined;

        // Synchronously update the external store when highlight changes
        if (ctx && isHighlighted !== prevHighlightedRef.current) {
          prevHighlightedRef.current = isHighlighted;
          ctx.setHighlighted(itemId, isHighlighted);
        }

        // Show static background for selected items when nothing is highlighted
        const showSelectedBackground = selected && !hasAnyHighlight && !isHighlighted;

        return (
          <div {...props}>
            {/* Static background for selected items (no animation) */}
            {showSelectedBackground && (
              <div className="absolute inset-0 bg-(--color-bg-muted) rounded-lg" />
            )}
            {/* Animated highlight - only ONE of these exists at a time across all items */}
            {isHighlighted && ctx && (
              <motion.div
                layoutId={ctx.layoutId}
                className="absolute inset-0 bg-(--color-bg-muted) rounded-lg"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2.5">
              {children}
            </span>
          </div>
        );
      }}
    />
  );
}

export function MenuItemSeparator() {
  return (
    <BaseMenu.Separator className="my-2 w-full h-px bg-(--color-border)" />
  );
}
