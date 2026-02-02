import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  useMemo,
  createContext,
  useContext,
  useSyncExternalStore,
} from "react";
import { Tabs } from "@base-ui/react/tabs";
import { ContextMenu } from "@base-ui/react/context-menu";
import { LayoutGroup, motion } from "motion/react";
import { cn } from "../lib/cn";
import type { TaxReturn, PendingUpload } from "../lib/schema";
import type { NavItem } from "../lib/types";
import { ReceiptView } from "./ReceiptView";
import { StatsHeader } from "./StatsHeader";
import { SummaryTable } from "./SummaryTable";
import { SummaryReceiptView } from "./SummaryReceiptView";
import { LoadingView } from "./LoadingView";
import { BrailleSpinner } from "./BrailleSpinner";
import { Button } from "./Button";
import { Menu, MenuItem, popupBaseClassName, itemBaseClassName } from "./Menu";
import { TrashIcon } from "./TrashIcon";
import { PlusIcon } from "./PlusIcon";
import { FilePlusIcon } from "./FilePlusIcon";

interface CommonProps {
  isChatOpen: boolean;
  isChatLoading?: boolean;
  onToggleChat: () => void;
  showChatButton?: boolean;
  navItems: NavItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenStart: () => void;
  onOpenReset: () => void;
  onDeleteYear?: (year: string) => void;
  isDemo: boolean;
  hasUserData: boolean;
  hasStoredKey: boolean;
  returns: Record<number, TaxReturn>;
  selectedYear: "summary" | number;
}

interface ReceiptProps extends CommonProps {
  view: "receipt";
  data: TaxReturn;
  title: string;
}

interface SummaryProps extends CommonProps {
  view: "summary";
}

interface LoadingProps extends CommonProps {
  view: "loading";
  pendingUpload: PendingUpload;
}

type Props = ReceiptProps | SummaryProps | LoadingProps;

type SummaryViewMode = "table" | "receipt";

const ITEM_WIDTH = 78; // 70px + 8px gap
const OVERFLOW_BUTTON_WIDTH = 48; // 40px + gap
const ADD_BUTTON_WIDTH = 48; // 40px + gap

// Animated tab highlight context and helpers (same pattern as Menu)
interface TabHighlightContextValue {
  layoutId: string;
  subscribe: (callback: () => void) => () => void;
  getHoveredId: () => string | null;
  setHovered: (id: string | null) => void;
}

const TabHighlightContext = createContext<TabHighlightContextValue | null>(
  null,
);

function useTabHighlightStore() {
  const hoveredRef = useRef<string | null>(null);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const subscribe = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  const getHoveredId = useCallback(() => {
    return hoveredRef.current;
  }, []);

  const setHovered = useCallback((id: string | null) => {
    if (hoveredRef.current !== id) {
      hoveredRef.current = id;
      listenersRef.current.forEach((cb) => cb());
    }
  }, []);

  return { subscribe, getHoveredId, setHovered };
}

interface AnimatedTabProps {
  id: string;
  label: string;
  isSelected: boolean;
  wrapper?: (tab: React.ReactElement) => React.ReactNode;
}

function AnimatedTab({ id, label, isSelected, wrapper }: AnimatedTabProps) {
  const ctx = useContext(TabHighlightContext);

  const hoveredId = useSyncExternalStore(
    ctx?.subscribe ?? (() => () => {}),
    ctx?.getHoveredId ?? (() => null),
  );

  const hasAnyHover = hoveredId !== null;
  // Show highlight if hovered, or if selected and nothing is hovered
  const showHighlight = hoveredId === id || (isSelected && !hasAnyHover);

  const tab = (
    <Tabs.Tab
      value={id}
      className={cn(
        "relative px-2.5 py-1 text-sm font-medium rounded-lg shrink-0 outline-none",
        isSelected
          ? "text-(--color-text)"
          : "text-(--color-text-muted) hover:text-(--color-text)",
      )}
      onMouseEnter={() => ctx?.setHovered(id)}
    >
      {/* Animated highlight - follows hover or selection */}
      {showHighlight && ctx && (
        <motion.div
          layoutId={ctx.layoutId}
          className="absolute inset-0 bg-(--color-bg-muted) dark:shadow-contrast rounded-lg"
          initial={false}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 35,
          }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </Tabs.Tab>
  );

  return wrapper ? wrapper(tab) : tab;
}

export function MainPanel(props: Props) {
  const [summaryViewMode, setSummaryViewMode] =
    useState<SummaryViewMode>("table");
  const [visibleCount, setVisibleCount] = useState(props.navItems.length);
  const navRef = useRef<HTMLElement>(null);

  // Animated tab highlight setup
  const tabLayoutId = useId();
  const tabHighlightStore = useTabHighlightStore();
  const tabHighlightContextValue = useMemo(
    () => ({
      layoutId: tabLayoutId,
      ...tabHighlightStore,
    }),
    [tabLayoutId, tabHighlightStore],
  );

  const calculateVisibleItems = useCallback(() => {
    if (!navRef.current) return;
    const availableWidth = navRef.current.offsetWidth;
    const reservedWidth = OVERFLOW_BUTTON_WIDTH + ADD_BUTTON_WIDTH;
    const maxItems = Math.floor(
      (availableWidth - reservedWidth) / ITEM_WIDTH,
    );
    setVisibleCount(Math.max(1, Math.min(props.navItems.length, maxItems)));
  }, [props.navItems.length]);

  useEffect(() => {
    calculateVisibleItems();
    const observer = new ResizeObserver(calculateVisibleItems);
    if (navRef.current) {
      observer.observe(navRef.current);
    }
    return () => observer.disconnect();
  }, [calculateVisibleItems]);

  // Global arrow key handler for tab navigation
  const tabListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      // Skip if focus is already in the tab list
      if (tabListRef.current?.contains(document.activeElement)) return;

      // Skip if focus is in an input, textarea, or contenteditable
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();

      const currentIndex = props.navItems.findIndex(
        (item) => item.id === props.selectedId,
      );
      const direction = e.key === "ArrowLeft" ? -1 : 1;
      const nextIndex = Math.max(
        0,
        Math.min(props.navItems.length - 1, currentIndex + direction),
      );
      const nextItem = props.navItems[nextIndex];

      if (nextItem && nextItem.id !== props.selectedId) {
        props.onSelect(nextItem.id);
      }

      // Focus the tab list so subsequent arrow keys work natively
      const tabToFocus = tabListRef.current?.querySelector(
        `[data-value="${nextItem?.id ?? props.selectedId}"]`,
      ) as HTMLElement | null;
      tabToFocus?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [props.navItems, props.selectedId, props.onSelect]);

  const visibleItems = props.navItems.slice(0, visibleCount);
  const overflowItems = props.navItems.slice(visibleCount);
  const hasOverflow = overflowItems.length > 0;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-(--color-bg)">
      {/* Header */}
      <header className="h-12 px-3 sm:pl-6 sm:pr-3 flex items-center justify-between shrink-0 border-b border-(--color-border)">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Hamburger Menu */}
          <Menu
            triggerClassName="-ml-1.5"
            popupClassName="min-w-[180px]"
            side="bottom"
            align="start"
            sideOffset={4}
            trigger={
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M2 5.5h12M2 10.5h12" />
              </svg>
            }
          >
            <MenuItem onClick={props.onOpenStart}>
              <FilePlusIcon />
              Get started
            </MenuItem>
            {!props.isDemo && (props.hasUserData || props.hasStoredKey) && (
              <MenuItem onClick={props.onOpenReset}>
                <TrashIcon />
                Reset data
              </MenuItem>
            )}

            <MenuItem
              onClick={() =>
                window.open("https://github.com/brianlovin/tax-ui", "_blank")
              }
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.5 0C3.35 0 0 3.35 0 7.5c0 3.32 2.15 6.14 5.13 7.13.38.07.51-.16.51-.36 0-.18-.01-.65-.01-.65-2.09.45-2.53-1.01-2.53-1.01-.34-.87-.84-1.1-.84-1.1-.68-.46.05-.46.05-.46.76.05 1.16.78 1.16.78.67 1.15 1.77.82 2.2.62.07-.48.26-.82.47-1.01-1.67-.19-3.43-.84-3.43-3.72 0-.82.3-1.5.78-2.02-.08-.19-.34-.96.07-2 0 0 .64-.2 2.08.77a7.24 7.24 0 013.78 0c1.44-.98 2.08-.77 2.08-.77.42 1.04.15 1.81.07 2 .49.52.78 1.2.78 2.02 0 2.89-1.76 3.53-3.44 3.71.27.24.51.69.51 1.39 0 1.01-.01 1.82-.01 2.07 0 .2.14.44.52.36A7.51 7.51 0 0015 7.5C15 3.35 11.65 0 7.5 0z"
                  />
                </svg>
              </div>
              Contribute
            </MenuItem>
          </Menu>
          <Tabs.Root
            value={props.selectedId}
            onValueChange={(val: string | number | null) =>
              val && props.onSelect(String(val))
            }
            className="flex-1 min-w-0"
          >
            <nav
              ref={navRef}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <Tabs.List
                ref={tabListRef}
                className="flex items-center gap-2 min-w-0 overflow-hidden pr-1"
                activateOnFocus
                onMouseLeave={() => tabHighlightStore.setHovered(null)}
              >
                <LayoutGroup>
                  <TabHighlightContext.Provider
                    value={tabHighlightContextValue}
                  >
                    {visibleItems.map((item) => {
                      const isYear = item.id !== "summary";
                      const canDelete =
                        isYear && !props.isDemo && props.onDeleteYear;

                      return (
                        <AnimatedTab
                          key={item.id}
                          id={item.id}
                          label={item.label}
                          isSelected={props.selectedId === item.id}
                          wrapper={
                            canDelete
                              ? (tab) => (
                                  <ContextMenu.Root>
                                    <ContextMenu.Trigger render={tab} />
                                    <ContextMenu.Portal>
                                      <ContextMenu.Positioner
                                        className="z-50"
                                        sideOffset={4}
                                      >
                                        <ContextMenu.Popup
                                          className={cn(
                                            popupBaseClassName,
                                            "z-50",
                                          )}
                                        >
                                          <ContextMenu.Item
                                            className={cn(
                                              itemBaseClassName,
                                              "data-[highlighted]:bg-(--color-bg-muted)",
                                            )}
                                            onClick={() =>
                                              props.onDeleteYear?.(item.id)
                                            }
                                          >
                                            <TrashIcon />
                                            Remove {item.label} data
                                          </ContextMenu.Item>
                                        </ContextMenu.Popup>
                                      </ContextMenu.Positioner>
                                    </ContextMenu.Portal>
                                  </ContextMenu.Root>
                                )
                              : undefined
                          }
                        />
                      );
                    })}
                  </TabHighlightContext.Provider>
                </LayoutGroup>
              </Tabs.List>

              {/* Overflow items */}
              {hasOverflow && (
                <Menu
                  triggerClassName="px-2.5 py-1 text-sm font-medium"
                  popupClassName="min-w-25"
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  trigger="···"
                >
                  {overflowItems.map((item) => (
                    <MenuItem
                      key={item.id}
                      onClick={() => props.onSelect(item.id)}
                      selected={props.selectedId === item.id}
                    >
                      {item.label}
                    </MenuItem>
                  ))}
                </Menu>
              )}

              {/* Add button */}
              {props.isDemo ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={props.onOpenStart}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1"
                >
                  <PlusIcon size={14} strokeWidth={2.5} />
                  Upload
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={props.onOpenStart}
                  title="Add tax returns"
                  className="shrink-0"
                >
                  <PlusIcon />
                </Button>
              )}
            </nav>
          </Tabs.Root>
        </div>
        {props.showChatButton !== false && !props.isChatOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onToggleChat}
            className="shrink-0 flex items-center gap-2"
          >
            Chat
            {props.isChatLoading && <BrailleSpinner className="text-xs" />}
          </Button>
        )}
      </header>

      {/* Content */}
      {props.view === "loading" ? (
        <LoadingView
          filename={props.pendingUpload.filename}
          year={props.pendingUpload.year}
          status={props.pendingUpload.status}
        />
      ) : props.view === "summary" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <StatsHeader returns={props.returns} selectedYear="summary" />
          {summaryViewMode === "table" ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <SummaryTable returns={props.returns} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <SummaryReceiptView returns={props.returns} />
            </div>
          )}
        </div>
      ) : props.view === "receipt" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <StatsHeader
            returns={props.returns}
            selectedYear={props.selectedYear as number}
          />
          <div className="flex-1 bg-neutral-50 dark:bg-neutral-950 overflow-y-auto">
            <ReceiptView data={props.data} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
