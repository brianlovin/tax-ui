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
import { IncomeView } from "./IncomeView";
import { InvestmentsView } from "./InvestmentsView";
import { LoadingView } from "./LoadingView";
import { StatsHeader } from "./StatsHeader";
import { TaxesView } from "./TaxesView";
import { TransactionsView } from "./TransactionsView";
import { YearSelector } from "./YearSelector";

export type ContentTab = "income" | "taxes" | "expenses" | "investments" | "transactions";

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
  granularity?: "month" | "week";
  onGranularityChange?: (granularity: "month" | "week") => void;
}

interface ReceiptProps extends CommonProps {
  view: "receipt";
  data?: TaxReturn;
  year: number;
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

      const tabs: ContentTab[] = ["income", "taxes", "expenses", "investments", "transactions"];
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

    // Single year view (with or without data)
    if (props.view === "receipt") {
      const year = props.year;
      if (props.activeTab === "income") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear={year} />
            <IncomeView data={props.data} year={year} granularity={props.granularity} />
          </div>
        );
      } else if (props.activeTab === "taxes") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear={year} />
            <TaxesView data={props.data} year={year} granularity={props.granularity} />
          </div>
        );
      } else if (props.activeTab === "expenses") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear={year} />
            <ExpensesView year={year} granularity={props.granularity} />
          </div>
        );
      } else if (props.activeTab === "investments") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear={year} />
            <InvestmentsView year={year} />
          </div>
        );
      } else {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <TransactionsView year={year} />
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
            <IncomeView returns={props.returns} granularity={props.granularity} />
          </div>
        );
      } else if (props.activeTab === "taxes") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear="summary" />
            <TaxesView returns={props.returns} granularity={props.granularity} />
          </div>
        );
      } else if (props.activeTab === "expenses") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear="summary" />
            <ExpensesView granularity={props.granularity} />
          </div>
        );
      } else if (props.activeTab === "investments") {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <StatsHeader returns={props.returns} selectedYear="summary" />
            <InvestmentsView />
          </div>
        );
      } else {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <TransactionsView />
          </div>
        );
      }
    }

    // This should never happen
    return null;
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
              <Tabs.Tab
                value="transactions"
                className={cn(
                  "relative shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium outline-none",
                  props.activeTab === "transactions"
                    ? "text-(--color-text)"
                    : "text-(--color-text-muted) hover:text-(--color-text)",
                )}
              >
                {props.activeTab === "transactions" && (
                  <motion.div
                    layoutId={tabLayoutId.current}
                    className="absolute inset-0 rounded-lg bg-(--color-bg-muted)"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Transactions</span>
              </Tabs.Tab>
              <Tabs.Tab
                value="investments"
                disabled
                className={cn(
                  "relative shrink-0 cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-medium opacity-50 outline-none",
                  "text-(--color-text-muted)",
                )}
              >
                <span className="relative z-10">Investments</span>
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
        granularity={props.granularity}
        onGranularityChange={props.onGranularityChange}
      />
    </div>
  );
}
