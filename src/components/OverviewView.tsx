import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatCurrency } from "../lib/format";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId, type Transaction } from "../lib/schema";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart";

const CATEGORY_COLORS: Record<ExpenseCategoryId | string, string> = {
  groceries: "#3b82f6",
  "homeware-appliances": "#60a5fa",
  internet: "#93c5fd",
  "maintenance-improvements": "#2563eb",
  pets: "#1d4ed8",
  "rates-insurance": "#1e40af",
  "rent-mortgage": "#1e3a8a",
  utilities: "#bfdbfe",
  "car-insurance-rego": "#f97316",
  cycling: "#fb923c",
  fuel: "#f87171",
  parking: "#ef4444",
  "public-transport": "#dc2626",
  repayments: "#b91c1c",
  "taxis-share-cars": "#991b1b",
  tolls: "#7f1d1d",
  "apps-games-software": "#ec4899",
  booze: "#f43f5e",
  "events-gigs": "#e11d48",
  hobbies: "#be185d",
  "holidays-travel": "#9d174d",
  "lottery-gambling": "#831843",
  "pubs-bars": "#fda4af",
  "restaurants-cafes": "#fb7185",
  takeaway: "#f43f5e",
  "tobacco-vaping": "#e11d48",
  "tv-music-streaming": "#be185d",
  adult: "#9d174d",
  "children-family": "#10b981",
  "clothing-accessories": "#34d399",
  "education-student-loans": "#6ee7b7",
  "fitness-wellbeing": "#059669",
  "gifts-charity": "#047857",
  "hair-beauty": "#065f46",
  "health-medical": "#a7f3d0",
  investments: "#86efac",
  "life-admin": "#4ade80",
  "mobile-phone": "#22c55e",
  technology: "#16a34a",
  "news-magazines-books": "#15803d",
};

const PARENT_CATEGORY_COLORS: Record<string, string> = {
  home: "#3b82f6",
  transport: "#f97316",
  goodlife: "#ec4899",
  personal: "#10b981",
};

interface MonthlyData {
  month: string;
  monthIndex: number;
  year: number;
  income: number;
  expenses: number;
  net: number;
  [category: string]: number | string;
}

interface OverviewViewProps {
  year?: number;
}

function getAllExpenseCategories(): { id: ExpenseCategoryId; name: string; parent: string }[] {
  const categories: { id: ExpenseCategoryId; name: string; parent: string }[] = [];
  for (const [parentKey, parent] of Object.entries(EXPENSE_CATEGORIES)) {
    for (const child of parent.children) {
      categories.push({
        id: child.id as ExpenseCategoryId,
        name: child.name,
        parent: parentKey,
      });
    }
  }
  return categories;
}

function aggregateMonthlyData(
  transactions: Transaction[],
  year: number | undefined,
  categories: { id: ExpenseCategoryId; name: string; parent: string }[],
): MonthlyData[] {
  if (transactions.length === 0) return [];

  const monthMap = new Map<string, MonthlyData>();

  for (const tx of transactions) {
    const date = new Date(tx.date);
    const txYear = date.getFullYear();

    if (year !== undefined && txYear !== year) continue;

    const monthKey = `${txYear}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    if (!monthMap.has(monthKey)) {
      const emptyData: MonthlyData = {
        month: monthLabel,
        monthIndex: date.getMonth(),
        year: txYear,
        income: 0,
        expenses: 0,
        net: 0,
      };
      for (const cat of categories) {
        emptyData[cat.id] = 0;
      }
      monthMap.set(monthKey, emptyData);
    }

    const data = monthMap.get(monthKey)!;

    if (tx.type === "income") {
      data.income += tx.amount;
    } else {
      data.expenses += tx.amount;
      if (tx.category) {
        const catId = tx.category as ExpenseCategoryId;
        if (typeof data[catId] === "number") {
          data[catId] += tx.amount;
        }
      }
    }
    data.net = data.income - data.expenses;
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => data);
}

function createIncomeExpenseChartConfig(): ChartConfig {
  return {
    income: {
      label: "Income",
      color: "#10b981",
    },
    expenses: {
      label: "Expenses",
      color: "#ef4444",
    },
  };
}

function createExpenseCategoryChartConfig(
  categories: { id: ExpenseCategoryId; name: string; parent: string }[],
): ChartConfig {
  const config: ChartConfig = {};
  for (const cat of categories) {
    config[cat.id] = {
      label: cat.name,
      color: CATEGORY_COLORS[cat.id],
    };
  }
  return config;
}

export function OverviewView({ year }: OverviewViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/transactions")
      .then((res) => res.json())
      .then((data: Transaction[]) => {
        setTransactions(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch transactions:", err);
        setIsLoading(false);
      });
  }, []);

  const allExpenseCategories = useMemo(() => getAllExpenseCategories(), []);

  const monthlyData = useMemo(
    () => aggregateMonthlyData(transactions, year, allExpenseCategories),
    [transactions, year, allExpenseCategories],
  );

  const incomeExpenseConfig = useMemo(() => createIncomeExpenseChartConfig(), []);
  const expenseCategoryConfig = useMemo(
    () => createExpenseCategoryChartConfig(allExpenseCategories),
    [allExpenseCategories],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-(--color-text-muted)">
        <p>Loading overview...</p>
      </div>
    );
  }

  if (monthlyData.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-(--color-text-muted)">
        <p>No transaction data available. Add transactions to see your overview.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-(--color-text)">Income & Expenses Over Time</h2>
        <div className="h-64 w-full rounded-xl border border-(--color-border) bg-(--color-bg-muted)/30 p-4">
          <ChartContainer config={incomeExpenseConfig} className="h-full w-full">
            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey="month"
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="income"
                stackId="1"
                stroke="var(--color-income)"
                fill="url(#incomeGradient)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stackId="1"
                stroke="var(--color-expenses)"
                fill="url(#expenseGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <h2 className="text-lg font-semibold text-(--color-text)">Monthly Expenses by Category</h2>
        <div className="min-h-96 w-full flex-1 rounded-xl border border-(--color-border) bg-(--color-bg-muted)/30 p-4">
          <ChartContainer config={expenseCategoryConfig} className="h-full w-full">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey="month"
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="dataKey"
                    formatter={(value, name) => {
                      const category = allExpenseCategories.find((c) => c.id === name);
                      return `${category?.name ?? name}: ${formatCurrency(Number(value))}`;
                    }}
                  />
                }
              />
              {allExpenseCategories.map((category) => (
                <Bar
                  key={category.id}
                  dataKey={category.id}
                  stackId="expenses"
                  fill={`var(--color-${category.id})`}
                  stroke={`var(--color-${category.id})`}
                  strokeWidth={1}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </div>

        <div className="flex flex-wrap gap-3 rounded-lg border border-(--color-border) bg-(--color-bg-muted)/30 p-3">
          {Object.entries(EXPENSE_CATEGORIES).map(([parentKey, parent]) => (
            <div key={parentKey} className="flex flex-col gap-1">
              <span
                className="text-xs font-semibold tracking-wide uppercase"
                style={{ color: PARENT_CATEGORY_COLORS[parentKey] }}
              >
                {parent.name}
              </span>
              <div className="flex flex-wrap gap-2">
                {parent.children.map((child) => (
                  <div key={child.id} className="flex items-center gap-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[child.id] }}
                    />
                    <span className="text-xs text-(--color-text-muted)">{child.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
