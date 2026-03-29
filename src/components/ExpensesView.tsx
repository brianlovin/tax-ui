import { type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "../lib/cn";
import { formatCurrency } from "../lib/format";
import {
  aggregateByCategoryAndPeriod,
  type BankStatement,
  EXPENSE_CATEGORIES,
  type ExpenseCategoryId,
  type ExpenseEntry,
  getCategoryName,
  getPeriodLabel,
  getTotalPeriods,
  getWeekOfYear,
  normalizeExpenseCategory,
} from "../lib/schema";
import { Button } from "./Button";
import { DatePicker } from "./DatePicker";
import { Input } from "./Input";
import { Menu, MenuItem } from "./Menu";
import { type ColumnMeta, Table } from "./Table";

interface Props {
  year?: number;
  granularity?: "month" | "week";
}

type TimeGranularity = "month" | "week";

interface ExpenseRow {
  id: string;
  label: string;
  category: ExpenseCategoryId | "total";
  parent: string;
  isHeader?: boolean;
  values: number[];
}

interface TransactionData {
  date: string;
  category: string;
  amount: number;
  type: string;
}

interface ExpenseData {
  transactions: TransactionData[];
  manualExpenses: TransactionData[];
}

function collectExpenseRows(
  expenses: ExpenseData,
  granularity: TimeGranularity,
  selectedYear?: number,
): ExpenseRow[] {
  const rows: ExpenseRow[] = [];
  const periods = getTotalPeriods(granularity);

  // Combine all transactions
  const allTransactions = [...expenses.manualExpenses, ...expenses.transactions];

  // Aggregate by category and period
  const aggregated = aggregateByCategoryAndPeriod(allTransactions, granularity, selectedYear);

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
      const catData = aggregated[child.id] || {};

      for (let p = 1; p <= periods; p++) {
        periodValues.push(catData[p] || 0);
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
    parent: "total",
    values: totalValues,
  });

  return rows;
}

export function ExpensesView({ year, granularity = "month" }: Props) {
  const [expenses, setExpenses] = useState<ExpenseData>({ transactions: [], manualExpenses: [] });
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
          const transformed: ExpenseData = { transactions: [], manualExpenses: [] };

          // Process manual expenses
          for (const [yearKey, yearData] of Object.entries(expenseData)) {
            for (const entry of yearData.entries) {
              const date = new Date(entry.year, entry.month - 1, 15); // Use middle of month
              transformed.manualExpenses.push({
                date: date.toISOString().slice(0, 10),
                category: entry.category,
                amount: entry.amount,
                type: "expense",
              });
            }
          }

          // Process bank statement transactions
          for (const statement of statements) {
            for (const txn of statement.transactions) {
              // Skip credits (income)
              if (txn.type === "credit") continue;

              const category = normalizeExpenseCategory(txn.category || txn.description);
              transformed.transactions.push({
                date: txn.date,
                category,
                amount: Math.abs(txn.amount),
                type: txn.type,
              });
            }
          }
          setExpenses(transformed);
        },
      )
      .catch(console.error);
  }, []);

  const rows = useMemo(
    () => collectExpenseRows(expenses, granularity, year),
    [expenses, granularity, year],
  );

  const periodLabels = useMemo(
    () =>
      Array.from({ length: getTotalPeriods(granularity) }, (_, i) =>
        getPeriodLabel(i + 1, granularity),
      ),
    [granularity],
  );

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
      const transformed: ExpenseData = { transactions: expenses.transactions, manualExpenses: [] };
      for (const [yearKey, yearData] of Object.entries(data)) {
        for (const e of (yearData as { entries: ExpenseEntry[] }).entries) {
          const date = new Date(e.year, e.month - 1, 15);
          transformed.manualExpenses.push({
            date: date.toISOString().slice(0, 10),
            category: e.category,
            amount: e.amount,
            type: "expense",
          });
        }
      }
      setExpenses(transformed);
      setAmount("");
    } catch (err) {
      console.error("Failed to add expense:", err);
    }
  }, [selectedCategory, amount, year, selectedDate, expenses.transactions]);

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(() => {
    const cols: ColumnDef<ExpenseRow>[] = [
      {
        accessorKey: "label",
        header: granularity === "month" ? "Expenses" : "Week",
        cell: (info) => {
          const row = info.row.original;
          if (row.isHeader) {
            return (
              <span className="flex items-center gap-2 font-semibold">
                {row.label}
                {row.category !== "total" && (
                  <span className="text-xs text-(--color-text-muted)">({row.parent})</span>
                )}
              </span>
            );
          }
          return <span className="text-(--color-text)">{row.label}</span>;
        },
        size: 220,
        enableResizing: true,
      },
    ];

    // Add period columns dynamically
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentWeek = getWeekOfYear(now);
    const currentYear = now.getFullYear();
    const selectedOrCurrentYear = year ?? currentYear;
    const isCurrentYear = selectedOrCurrentYear === currentYear;

    for (let i = 0; i < periodLabels.length; i++) {
      const periodIndex = i;
      let isCurrentPeriod = false;
      if (isCurrentYear) {
        if (granularity === "month") {
          isCurrentPeriod = i === currentMonth;
        } else {
          // week granularity - i is 0-based, so add 1 to match week number
          isCurrentPeriod = i + 1 === currentWeek;
        }
      }

      cols.push({
        accessorKey: `period-${i}`,
        header: () => (
          <span className={cn(isCurrentPeriod && "text-(--color-text)")}>{periodLabels[i]}</span>
        ),
        cell: (info) => {
          const row = info.row.original;
          const value = row.values[periodIndex] || 0;
          if (row.category === "total") {
            return (
              <span className={cn("font-medium tabular-nums", isCurrentPeriod && "font-bold")}>
                {value > 0 ? formatCurrency(value) : "—"}
              </span>
            );
          }
          return (
            <span
              className={cn(
                "tabular-nums",
                isCurrentPeriod ? "font-medium text-(--color-text)" : "text-(--color-text-muted)",
              )}
            >
              {value > 0 ? formatCurrency(value) : "—"}
            </span>
          );
        },
        meta: {
          align: "right" as const,
          className: cn(
            isCurrentPeriod && "bg-(--color-bg-muted)/50",
            i === 0 && "border-l",
            i === periodLabels.length - 1 && "border-r",
          ),
        } satisfies ColumnMeta,
        size: 80,
      });
    }

    return cols;
  }, [granularity, periodLabels]);

  const categories = Object.entries(EXPENSE_CATEGORIES).flatMap(([parentKey, parent]) => [
    { id: parentKey, name: parent.name, isParent: true },
    ...parent.children.map((c) => ({ id: c.id, name: `  ${c.name}`, isParent: false })),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Add expense form */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-(--color-border) px-3 py-1.5">
        <Menu
          triggerClassName="px-3 py-1.5 text-sm font-medium rounded-lg border border-(--color-border) bg-(--color-bg) text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-bg-muted)"
          popupClassName="min-w-[180px]"
          side="right"
          trigger={selectedCategory ? getCategoryName(selectedCategory) : "Category"}
        >
          {categories.map((cat) => (
            <MenuItem
              key={cat.id}
              onClick={() => !cat.isParent && setSelectedCategory(cat.id as ExpenseCategoryId)}
              selected={selectedCategory === cat.id}
              className={cat.isParent ? "cursor-default font-medium text-(--color-text-muted)" : ""}
            >
              {cat.name}
            </MenuItem>
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
      </div>

      {/* Expenses table */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <Table
          data={rows}
          columns={columns}
          storageKey={`expenses-table-${year ?? "all"}-${granularity}`}
          getRowClassName={(row) => (row.isHeader ? "bg-(--color-bg-muted) font-semibold" : "")}
        />
      </div>
    </div>
  );
}
