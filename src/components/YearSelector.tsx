import { Tabs } from "@base-ui/react/tabs";
import { motion } from "motion/react";
import { createContext, useContext, useMemo, useRef, useSyncExternalStore } from "react";

import { cn } from "../lib/cn";
import type { NavItem } from "../lib/types";
import { Menu, MenuItem } from "./Menu";

interface YearSelectorProps {
  navItems: NavItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

// Animated highlight context (same pattern as MainPanel)
interface TabHighlightContextValue {
  layoutId: string;
  subscribe: (callback: () => void) => () => void;
  getHoveredId: () => string | null;
  setHovered: (id: string | null) => void;
}

const TabHighlightContext = createContext<TabHighlightContextValue | null>(null);

function useTabHighlightStore() {
  const hoveredRef = useRef<string | null>(null);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const subscribe = (callback: () => void) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  };

  const getHoveredId = () => hoveredRef.current;
  const setHovered = (id: string | null) => {
    if (hoveredRef.current !== id) {
      hoveredRef.current = id;
      listenersRef.current.forEach((cb) => cb());
    }
  };

  return { subscribe, getHoveredId, setHovered };
}

const ITEM_WIDTH = 70; // Approximate width of each year tab
const OVERFLOW_BUTTON_WIDTH = 48;

export function YearSelector({ navItems, selectedId, onSelect }: YearSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = React.useState(navItems.length);

  // Animated highlight setup
  const layoutId = React.useId();
  const highlightStore = useTabHighlightStore();
  const highlightContext = useMemo(
    () => ({
      layoutId,
      ...highlightStore,
    }),
    [layoutId, highlightStore],
  );

  // Calculate visible items based on container width
  React.useEffect(() => {
    const calculateVisible = () => {
      if (!containerRef.current) return;
      const availableWidth = containerRef.current.offsetWidth;
      const reservedWidth = OVERFLOW_BUTTON_WIDTH;
      const maxItems = Math.floor((availableWidth - reservedWidth) / ITEM_WIDTH);
      setVisibleCount(Math.max(1, Math.min(navItems.length, maxItems)));
    };

    calculateVisible();
    const observer = new ResizeObserver(calculateVisible);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [navItems.length]);

  const visibleItems = navItems.slice(0, visibleCount);
  const overflowItems = navItems.slice(visibleCount);
  const hasOverflow = overflowItems.length > 0;

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center gap-1 border-t border-(--color-border) bg-(--color-bg) px-4 py-2"
    >
      <Tabs.Root
        value={selectedId}
        onValueChange={(val) => val && onSelect(String(val))}
        className="flex min-w-0 items-center"
      >
        <Tabs.List
          className="flex items-center gap-1"
          onMouseLeave={() => highlightStore.setHovered(null)}
        >
          <TabHighlightContext.Provider value={highlightContext}>
            {visibleItems.map((item) => (
              <YearTab
                key={item.id}
                id={item.id}
                label={item.label}
                isSelected={selectedId === item.id}
              />
            ))}
          </TabHighlightContext.Provider>
        </Tabs.List>

        {hasOverflow && (
          <Menu
            triggerClassName="px-2 py-1 text-xs font-medium"
            popupClassName="min-w-[80px]"
            side="top"
            align="center"
            trigger="···"
          >
            {overflowItems.map((item) => (
              <MenuItem
                key={item.id}
                onClick={() => onSelect(item.id)}
                selected={selectedId === item.id}
              >
                {item.label}
              </MenuItem>
            ))}
          </Menu>
        )}
      </Tabs.Root>
    </div>
  );
}

interface YearTabProps {
  id: string;
  label: string;
  isSelected: boolean;
}

function YearTab({ id, label, isSelected }: YearTabProps) {
  const ctx = useContext(TabHighlightContext);

  const hoveredId = useSyncExternalStore(
    ctx?.subscribe ?? (() => () => {}),
    ctx?.getHoveredId ?? (() => null),
  );

  const hasAnyHover = hoveredId !== null;
  const showHighlight = hoveredId === id || (isSelected && !hasAnyHover);

  return (
    <Tabs.Tab
      value={id}
      className={cn(
        "relative rounded-md px-2.5 py-1 text-xs font-medium outline-none",
        isSelected ? "text-(--color-text)" : "text-(--color-text-muted) hover:text-(--color-text)",
      )}
      onMouseEnter={() => ctx?.setHovered(id)}
    >
      {showHighlight && ctx && (
        <motion.div
          layoutId={ctx.layoutId}
          className="absolute inset-0 rounded-md bg-(--color-bg-muted)"
          initial={false}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </Tabs.Tab>
  );
}

// Need to import React for useState/useEffect/useId
import React from "react";
