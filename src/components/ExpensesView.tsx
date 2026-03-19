import { type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "../lib/cn";
import { formatCurrency } from "../lib/format";
import {
  type BankStatement,
  EXPENSE_CATEGORIES,
  type ExpenseCategoryId,
  type ExpenseEntry,
  getCategoryName,
} from "../lib/schema";
import { Button } from "./Button";
import { DatePicker } from "./DatePicker";
import { Input } from "./Input";
import { Menu, MenuItem } from "./Menu";
import { type ColumnMeta, Table } from "./Table";

interface Props {
  year?: number;
}

type TimeGranularity = "month" | "week";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getWeekLabels(): string[] {
  return Array.from({ length: 52 }, (_, i) => `W${i + 1}`);
}

function getCurrentMonth(): number {
  return new Date().getMonth(); // 0-indexed
}

function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}

interface ExpenseRow {
  id: string;
  label: string;
  category: ExpenseCategoryId | "total";
  parent: string;
  isHeader?: boolean;
  values: number[];
}

interface ExpenseData {
  [year: number]: {
    [category: string]: {
      [month: number]: number;
    };
  };
}

function collectExpenseRows(
  expenses: ExpenseData,
  granularity: TimeGranularity,
  selectedYear?: number,
): ExpenseRow[] {
  const rows: ExpenseRow[] = [];
  const periods = granularity === "month" ? 12 : 52;

  // Always show all categories, even if no data
  for (const [parentKey, parent] of Object.entries(EXPENSE_CATEGORIES)) {
    // Parent header
    rows.push({
      id: `header-${parentKey}`,
      label: parent.name,
      category: "total",
      parent: parentKey,
      isHeader: true,
      values: Array(periods).fill(0),
    });

    // Child categories
    for (const child of parent.children) {
      const periodValues: number[] = [];

      if (selectedYear !== undefined) {
        // Single year view
        const yearData = expenses[selectedYear];
        const catData = yearData?.[child.id];
        if (catData) {
          if (granularity === "month") {
            for (let m = 1; m <= 12; m++) {
              periodValues.push(catData[m] || 0);
            }
          } else {
            // For weeks, aggregate from monthly data (simplified)
            for (let w = 1; w <= 52; w++) {
              const month = Math.ceil(w / 4.33);
              periodValues.push((catData[month] || 0) / 4.33);
            }
          }
        } else {
          // No data for this category - fill with zeros
          periodValues.push(...Array(periods).fill(0));
        }
      } else {
        // Summary - total across all years
        let total = 0;
        for (const year of Object.keys(expenses).map(Number)) {
          const yearData = expenses[year];
          const catData = yearData?.[child.id];
          if (catData) {
            for (const monthVal of Object.values(catData)) {
              total += monthVal;
            }
          }
        }
        periodValues.push(total);
      }

      rows.push({
        id: child.id,
        label: child.name,
        category: child.id,
        parent: parentKey,
        values: periodValues,
      });
    }
  }

  // Add total row
  const totalValues: number[] = [];
  for (let i = 0; i < periods; i++) {
    let sum = 0;
    for (const row of rows) {
      if (!row.isHeader && row.category !== "total") {
        sum += row.values[i] || 0;
      }
    }
    totalValues.push(sum);
  }

  rows.push({
    id: "total",
    label: "Total Expenses",
    category: "total",
    parent: "",
    values: totalValues,
  });

  return rows;
}

export function ExpensesView({ year }: Props) {
  const [granularity, setGranularity] = useState<TimeGranularity>("month");
  const [expenses, setExpenses] = useState<ExpenseData>({});
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategoryId | null>(null);
  const [amount, setAmount] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Fetch expenses and bank statements on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/expenses").then((res) => res.json()),
      fetch("/api/bank-statements").then((res) => res.json()),
    ])
      .then(
        ([expenseData, statements]: [
          Record<number, { entries: ExpenseEntry[] }>,
          BankStatement[],
        ]) => {
          const transformed: ExpenseData = {};
          // Process manual expenses
          for (const [yearKey, yearData] of Object.entries(expenseData)) {
            const yr = Number(yearKey);
            transformed[yr] = transformed[yr] || {};
            for (const entry of yearData.entries) {
              const yearEntry = transformed[yr]!;
              if (!yearEntry[entry.category]) {
                yearEntry[entry.category] = {};
              }
              const catData = yearEntry[entry.category]!;
              catData[entry.month] = (catData[entry.month] || 0) + entry.amount;
            }
          }
          // Process bank statement transactions
          for (const statement of statements) {
            for (const txn of statement.transactions) {
              // Try to categorize transactions based on description or category
              const category = txn.category || inferCategory(txn.description);
              const month = new Date(txn.date).getMonth() + 1;
              const yr = new Date(txn.date).getFullYear();
              const amount = Math.abs(txn.amount); // Use absolute value for expenses
              if (!transformed[yr]) transformed[yr] = {};
              const yearEntry = transformed[yr]!;
              if (!yearEntry[category]) yearEntry[category] = {};
              const catData = yearEntry[category]!;
              catData[month] = (catData[month] || 0) + amount;
            }
          }
          setExpenses(transformed);
        },
      )
      .catch(console.error);
  }, []);

  // Helper to infer category from transaction description
  function inferCategory(description: string): ExpenseCategoryId {
    const desc = description.toLowerCase();
    if (
      desc.includes("woolworth") ||
      desc.includes("coles") ||
      desc.includes("iga") ||
      desc.includes("aldi")
    ) {
      return "groceries";
    }
    if (
      desc.includes("shell") ||
      desc.includes("bp ") ||
      desc.includes("ampol") ||
      desc.includes("fuel")
    ) {
      return "fuel";
    }
    if (desc.includes("uber") || desc.includes("didi") || desc.includes("taxi")) {
      return "taxis-share-cars";
    }
    if (desc.includes("netflix") || desc.includes("spotify") || desc.includes("disney")) {
      return "tv-music-streaming";
    }
    if (
      desc.includes("grab") ||
      desc.includes("menulog") ||
      desc.includes("doordash") ||
      desc.includes("uber eats")
    ) {
      return "takeaway";
    }
    return "life-admin"; // Default category
  }

  const rows = useMemo(
    () => collectExpenseRows(expenses, granularity, year),
    [expenses, granularity, year],
  );

  const periodLabels = granularity === "month" ? MONTHS : getWeekLabels();

  const handleAddExpense = useCallback(async () => {
    if (!selectedCategory || !amount || !year) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return;

    const entry: ExpenseEntry = {
      id: crypto.randomUUID(),
      year,
      month: selectedDate.getMonth() + 1,
      category: selectedCategory,
      amount: numAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await fetch("/api/expenses/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });

      // Refresh expenses
      const res = await fetch("/api/expenses");
      const data = await res.json();
      const transformed: ExpenseData = {};
      for (const [yearKey, yearData] of Object.entries(data)) {
        const y = Number(yearKey);
        transformed[y] = {};
        const entries = (yearData as { entries: ExpenseEntry[] }).entries;
        for (const entry of entries) {
          const yearEntry = transformed[y];
          if (!yearEntry) continue;
          if (!yearEntry[entry.category]) {
            yearEntry[entry.category] = {};
          }
          const catData = yearEntry[entry.category]!;
          catData[entry.month] = (catData[entry.month] || 0) + entry.amount;
        }
      }
      setExpenses(transformed);
      setAmount("");
    } catch (err) {
      console.error("Failed to add expense:", err);
    }
  }, [selectedCategory, amount, year, selectedDate]);

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(() => {
    const cols: ColumnDef<ExpenseRow>[] = [
      {
        accessorKey: "label",
        header: granularity === "month" ? "Expenses" : "Week",
        cell: (info) => {
          const row = info.row.original;
          if (row.isHeader) {
            return (
              <div className="pt-2">
                <span className="text-xs font-medium text-(--color-text-muted)">{row.label}</span>
              </div>
            );
          }
          const isTotal = row.id === "total";
          return (
            <span className={cn("truncate", isTotal && "font-medium")}>
              {String(info.getValue())}
            </span>
          );
        },
        meta: {
          sticky: true,
        } satisfies ColumnMeta,
        size: 160,
      },
    ];

    if (year !== undefined) {
      const currentYear = new Date().getFullYear();
      const isCurrentYear = year === currentYear;
      const currentMonth = getCurrentMonth();
      const currentWeek = getCurrentWeek();
      const numPeriods = granularity === "month" ? 12 : 52;

      for (let i = 0; i < numPeriods; i++) {
        const isCurrentPeriod =
          isCurrentYear && (granularity === "month" ? i === currentMonth : i === currentWeek - 1);
        cols.push({
          id: `period-${i}`,
          header: () => (
            <span className={isCurrentPeriod ? "rounded bg-(--color-brand)/10 px-1.5 py-0.5" : ""}>
              {periodLabels[i]}
            </span>
          ),
          cell: (info) => {
            const row = info.row.original;
            if (row.isHeader) return null;
            const value = row.values[i] || 0;
            const isTotal = row.id === "total";
            return (
              <span className={cn("slashed-zero tabular-nums", isTotal && "font-medium")}>
                {value === 0 ? "—" : formatCurrency(value)}
              </span>
            );
          },
          meta: {
            align: "right" as const,
            headerAlign: "left" as const,
          } satisfies ColumnMeta,
          size: 100,
        });
      }
    } else {
      cols.push({
        id: "total",
        header: "Total",
        cell: (info) => {
          const row = info.row.original;
          if (row.isHeader) return null;
          const total = row.values[0] || 0;
          const isTotal = row.id === "total";
          return (
            <span className={cn("slashed-zero tabular-nums", isTotal && "font-medium")}>
              {total === 0 ? "—" : formatCurrency(total)}
            </span>
          );
        },
        meta: {
          align: "right" as const,
        } satisfies ColumnMeta,
        size: 120,
      });
    }

    return cols;
  }, [granularity, year, periodLabels]);

  const getRowClassName = (row: ExpenseRow) => {
    if (row.isHeader) {
      return "border-t border-(--color-border)";
    }
    return "";
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Add expense UI for single year view */}
      {year !== undefined && (
        <div className="flex items-center gap-2 border-b border-(--color-border) px-4 py-2">
          <Menu
            triggerClassName="px-3 py-1.5 text-sm font-medium rounded-lg border border-(--color-border) bg-(--color-bg) text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-bg-muted)"
            popupClassName="min-w-[180px]"
            side="bottom"
            trigger={selectedCategory ? getCategoryName(selectedCategory) : "Select category"}
          >
            {Object.entries(EXPENSE_CATEGORIES).map(([parentKey, parent]) => (
              <div key={parentKey}>
                <div className="px-2 py-1 text-xs font-medium text-(--color-text-muted)">
                  {parent.name}
                </div>
                {parent.children.map((child) => (
                  <MenuItem
                    key={child.id}
                    onClick={() => setSelectedCategory(child.id)}
                    selected={selectedCategory === child.id}
                  >
                    {child.name}
                  </MenuItem>
                ))}
              </div>
            ))}
          </Menu>

          <Input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            prefix="$"
            className="w-28"
          />

          <DatePicker
            value={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            placeholder="Date"
          />

          <Button
            variant={!selectedCategory || !amount ? "outline" : "secondary"}
            size="sm"
            onClick={handleAddExpense}
            disabled={!selectedCategory || !amount}
          >
            Add
          </Button>

          <div className="flex-1" />

          <span className="text-xs text-(--color-text-muted)">View by:</span>
          <Button
            variant={granularity === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setGranularity("month")}
          >
            Month
          </Button>
          <Button
            variant={granularity === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setGranularity("week")}
          >
            Week
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-(--color-text-muted)">
          No expenses recorded yet
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <Table
            data={rows}
            columns={columns}
            storageKey={`expenses-table-${year ?? "summary"}`}
            isRowHoverDisabled={(row) => row.isHeader === true}
            getRowClassName={getRowClassName}
          />
        </div>
      )}
    </div>
  );
}
