import { useState, useRef, useEffect, useCallback } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { ContextMenu } from "@base-ui/react/context-menu";
import { cn } from "../lib/cn";
import type { TaxReturn, PendingUpload } from "../lib/schema";
import type { NavItem } from "../lib/types";
import { ReceiptView } from "./ReceiptView";
import { SummaryStats } from "./SummaryStats";
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
}

interface ReceiptProps extends CommonProps {
  view: "receipt";
  data: TaxReturn;
  title: string;
}

interface SummaryProps extends CommonProps {
  view: "summary";
  returns: Record<number, TaxReturn>;
}

interface LoadingProps extends CommonProps {
  view: "loading";
  pendingUpload: PendingUpload;
}

type Props = ReceiptProps | SummaryProps | LoadingProps;

type SummaryViewMode = "table" | "receipt";

const ITEM_WIDTH = 70;
const OVERFLOW_BUTTON_WIDTH = 40;

export function MainPanel(props: Props) {
  const [summaryViewMode, setSummaryViewMode] =
    useState<SummaryViewMode>("table");
  const [visibleCount, setVisibleCount] = useState(props.navItems.length);
  const navRef = useRef<HTMLElement>(null);

  const calculateVisibleItems = useCallback(() => {
    if (!navRef.current) return;
    const availableWidth = navRef.current.offsetWidth;
    const maxItems = Math.floor(
      (availableWidth - OVERFLOW_BUTTON_WIDTH) / ITEM_WIDTH,
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
            {!props.isDemo && props.hasUserData && (
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
              className="flex items-center gap-0.5 flex-1 min-w-0"
            >
              <Tabs.List className="flex items-center gap-0.5">
                {visibleItems.map((item) => {
                  const isYear = item.id !== "summary";
                  const canDelete =
                    isYear && !props.isDemo && props.onDeleteYear;

                  const tabElement = (
                    <Tabs.Tab
                      key={item.id}
                      value={item.id}
                      className={cn(
                        "px-2.5 py-1 text-sm font-medium rounded-lg shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-(--color-text-muted)",
                        props.selectedId === item.id
                          ? "text-(--color-text) bg-(--color-bg-muted)"
                          : "text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-bg-muted)",
                      )}
                    >
                      {item.label}
                    </Tabs.Tab>
                  );

                  if (canDelete) {
                    return (
                      <ContextMenu.Root key={item.id}>
                        <ContextMenu.Trigger render={tabElement} />
                        <ContextMenu.Portal>
                          <ContextMenu.Positioner
                            className="z-50"
                            sideOffset={4}
                          >
                            <ContextMenu.Popup
                              className={cn(popupBaseClassName, "z-50")}
                            >
                              <ContextMenu.Item
                                className={cn(itemBaseClassName, "data-[highlighted]:bg-(--color-bg-muted)")}
                                onClick={() => props.onDeleteYear?.(item.id)}
                              >
                                <TrashIcon />
                                Remove {item.label} data
                              </ContextMenu.Item>
                            </ContextMenu.Popup>
                          </ContextMenu.Positioner>
                        </ContextMenu.Portal>
                      </ContextMenu.Root>
                    );
                  }

                  return tabElement;
                })}
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
        summaryViewMode === "table" ? (
          <div className="flex-1 flex flex-col min-h-0">
            <SummaryStats returns={props.returns} />
            <div className="flex-1 min-h-0">
              <SummaryTable returns={props.returns} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <SummaryReceiptView returns={props.returns} />
          </div>
        )
      ) : props.view === "receipt" ? (
        <div className="flex-1 overflow-y-auto">
          <ReceiptView data={props.data} />
        </div>
      ) : null}
    </div>
  );
}
