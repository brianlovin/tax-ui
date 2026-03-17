import { Tabs } from "@base-ui/react/tabs";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/cn";
import { isElectron } from "../lib/electron";
import type { PendingUpload, TaxReturn } from "../lib/schema";
import type { NavItem } from "../lib/types";
import { BrailleSpinner } from "./BrailleSpinner";
import { Button } from "./Button";
import { ExpensesView } from "./ExpensesView";
import { FilePlusIcon } from "./FilePlusIcon";
import { IncomeView } from "./IncomeView";
import { LoadingView } from "./LoadingView";
import { Menu, MenuItem } from "./Menu";
import { StatsHeader } from "./StatsHeader";
import { SummaryReceiptView } from "./SummaryReceiptView";
import { SummaryTable } from "./SummaryTable";
import { TaxesView } from "./TaxesView";
import { TrashIcon } from "./TrashIcon";
import { YearSelector } from "./YearSelector";

export type ContentTab = "income" | "taxes" | "expenses";

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
  activeTab: ContentTab;
  onTabChange: (tab: ContentTab) => void;
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

export function MainPanel(props: Props) {
  const [summaryViewMode, setSummaryViewMode] = useState<"table" | "receipt">("table");
  const tabLayoutId = useRef<string>(`tab-highlight-${Date.now()}`);
  const tabListRef = useRef<HTMLDivElement>(null);

  // Global arrow key handler for tab navigation
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

      const tabs: ContentTab[] = ["income", "taxes", "expenses"];
      const currentIndex = tabs.indexOf(props.activeTab);
      const direction = e.key === "ArrowLeft" ? -1 : 1;
      const nextIndex = Math.max(0, Math.min(tabs.length - 1, currentIndex + direction));
      props.onTabChange(tabs[nextIndex]!);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  const renderContent = () => {
    // Loading view takes precedence
    if (props.view === "loading") {
      return (
        <LoadingView
          filename={props.pendingUpload.filename}
          year={props.pendingUpload.year}
          status={props.pendingUpload.status}
        />
      );
    }

    // Get the data for the selected view
    if (props.view === "receipt" && props.data) {
      // Single year view - show the selected tab content
      if (props.activeTab === "income") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear={props.selectedYear as number} />
            <IncomeView data={props.data} />
          </div>
        );
      } else if (props.activeTab === "taxes") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear={props.selectedYear as number} />
            <TaxesView data={props.data} />
          </div>
        );
      } else {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear={props.selectedYear as number} />
            <ExpensesView year={props.data.year} />
          </div>
        );
      }
    }

    // Summary view (all years)
    if (props.view === "summary") {
      if (props.activeTab === "income") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear="summary" />
            <IncomeView returns={props.returns} />
          </div>
        );
      } else if (props.activeTab === "taxes") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear="summary" />
            <TaxesView returns={props.returns} />
          </div>
        );
      } else {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear="summary" />
            <ExpensesView />
          </div>
        );
      }
    }

    // Legacy fallback (shouldn't reach here)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <StatsHeader returns={props.returns} selectedYear="summary" />
        {summaryViewMode === "table" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <SummaryTable returns={props.returns} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <SummaryReceiptView returns={props.returns} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-(--color-bg)">
      {/* Header with content tabs */}
      <header
        className={cn(
          "flex h-12 shrink-0 items-center justify-between border-b border-(--color-border) pr-3 pl-[calc(0.75rem+var(--electron-traffic-left))] sm:pr-3 sm:pl-[calc(1.5rem+var(--electron-traffic-left))]",
          isElectron() && "app-window-drag",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
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
              onClick={() => window.open("https://github.com/oscardobsonbrown/pennywise", "_blank")}
            >
              <div className="flex h-5 w-5 items-center justify-center">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
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

          {/* Content Tabs */}
          <Tabs.Root
            value={props.activeTab}
            onValueChange={(val) => val && props.onTabChange(val as ContentTab)}
            className="min-w-0 flex-1"
          >
            <Tabs.List ref={tabListRef} className="flex min-w-0 items-center gap-1" activateOnFocus>
              <Tabs.Tab
                value="income"
                className={cn(
                  "relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium outline-none",
                  props.activeTab === "income"
                    ? "text-(--color-text)"
                    : "text-(--color-text-muted) hover:text-(--color-text)",
                )}
              >
                {props.activeTab === "income" && (
                  <motion.div
                    layoutId={tabLayoutId.current}
                    className="absolute inset-0 rounded-lg bg-(--color-bg-muted)"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Income</span>
              </Tabs.Tab>
              <Tabs.Tab
                value="taxes"
                className={cn(
                  "relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium outline-none",
                  props.activeTab === "taxes"
                    ? "text-(--color-text)"
                    : "text-(--color-text-muted) hover:text-(--color-text)",
                )}
              >
                {props.activeTab === "taxes" && (
                  <motion.div
                    layoutId={tabLayoutId.current}
                    className="absolute inset-0 rounded-lg bg-(--color-bg-muted)"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Taxes</span>
              </Tabs.Tab>
              <Tabs.Tab
                value="expenses"
                className={cn(
                  "relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium outline-none",
                  props.activeTab === "expenses"
                    ? "text-(--color-text)"
                    : "text-(--color-text-muted) hover:text-(--color-text)",
                )}
              >
                {props.activeTab === "expenses" && (
                  <motion.div
                    layoutId={tabLayoutId.current}
                    className="absolute inset-0 rounded-lg bg-(--color-bg-muted)"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Expenses</span>
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        </div>

        {props.showChatButton !== false && !props.isChatOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onToggleChat}
            className="flex shrink-0 items-center gap-2"
          >
            Chat
            {props.isChatLoading && <BrailleSpinner className="text-xs" />}
          </Button>
        )}
      </header>

      {/* Main content */}
      {renderContent()}

      {/* Year selector at bottom */}
      <YearSelector
        navItems={props.navItems}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
      />
    </div>
  );
}
