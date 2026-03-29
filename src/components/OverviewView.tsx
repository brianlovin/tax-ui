import {
  ArrowsPointingOutIcon,
  HeartIcon,
  HomeIcon,
  TruckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategoryId,
  getPeriodLabel,
  getTotalPeriods,
  getWeekOfYear,
  normalizeExpenseCategory,
  type Transaction,
} from "../lib/schema";
import { Dialog } from "./Dialog";
import { type ChartConfig, ChartContainer, ChartTooltip } from "./ui/chart";

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

type TimeGranularity = "month" | "week";

interface PeriodData {
  period: string;
  periodIndex: number;
  year: number;
  income: number;
  expenses: number;
  savings: number;
  positiveSavings: number;
  negativeSavings: number;
  [category: string]: number | string;
}

interface CategorySpending {
  id: string;
  name: string;
  amount: number;
  color: string;
  parent: string;
}

interface OverviewViewProps {
  year?: number;
  granularity?: TimeGranularity;
}

function getCategoryIcon(parentKey: string) {
  switch (parentKey) {
    case "home":
      return HomeIcon;
    case "transport":
      return TruckIcon;
    case "goodlife":
      return HeartIcon;
    case "personal":
      return UserIcon;
    default:
      return UserIcon;
  }
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

function getPeriodFromDate(date: Date, granularity: TimeGranularity): number {
  if (granularity === "week") {
    return getWeekOfYear(date);
  }
  return date.getMonth() + 1;
}

function aggregatePeriodData(
  transactions: Transaction[],
  year: number | undefined,
  granularity: TimeGranularity,
  categories: { id: ExpenseCategoryId; name: string; parent: string }[],
): PeriodData[] {
  const targetYear = year ?? new Date().getFullYear();
  const currentPeriod =
    granularity === "month" ? new Date().getMonth() + 1 : getWeekOfYear(new Date());
  const periods = getTotalPeriods(granularity);

  const periodDataArray: PeriodData[] = [];
  for (let i = 11; i >= 0; i--) {
    let periodNum: number;
    let periodYear = targetYear;

    if (granularity === "month") {
      periodNum = currentPeriod - i;
      while (periodNum <= 0) {
        periodNum += 12;
        periodYear--;
      }
    } else {
      periodNum = currentPeriod - i;
      while (periodNum <= 0) {
        periodNum += periods;
        periodYear--;
      }
    }

    const periodLabel = getPeriodLabel(periodNum, granularity);
    periodDataArray.push({
      period: `${periodLabel} ${String(periodYear).slice(-2)}`,
      periodIndex: periodNum,
      year: periodYear,
      income: 0,
      expenses: 0,
      savings: 0,
      positiveSavings: 0,
      negativeSavings: 0,
    });
  }

  for (const tx of transactions) {
    const date = new Date(tx.date);
    const txYear = date.getFullYear();

    if (year !== undefined && txYear !== year) continue;

    const catId = normalizeExpenseCategory(tx.category);
    if (catId === "exclude" && tx.type === "expense") continue;

    const periodNum = getPeriodFromDate(date, granularity);

    const matchingPeriod = periodDataArray.find(
      (p) => p.year === txYear && p.periodIndex === periodNum,
    );

    if (matchingPeriod) {
      if (tx.type === "income") {
        matchingPeriod.income += tx.amount;
      } else {
        matchingPeriod.expenses += tx.amount;
      }
      matchingPeriod.savings = matchingPeriod.income - matchingPeriod.expenses;
      matchingPeriod.positiveSavings = matchingPeriod.savings >= 0 ? matchingPeriod.savings : 0;
      matchingPeriod.negativeSavings = matchingPeriod.savings < 0 ? matchingPeriod.savings : 0;
    }
  }

  return periodDataArray;
}

function aggregateCategorySpending(
  transactions: Transaction[],
  year: number | undefined,
): CategorySpending[] {
  const spendingByParent = new Map<string, number>();

  const allCategories = getAllExpenseCategories();

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const date = new Date(tx.date);
    if (year !== undefined && date.getFullYear() !== year) continue;

    const catId = normalizeExpenseCategory(tx.category);
    if (catId === "exclude") continue;

    const categoryInfo = allCategories.find((c) => c.id === catId);
    const parentKey = categoryInfo?.parent || "personal";

    const existing = spendingByParent.get(parentKey) || 0;
    spendingByParent.set(parentKey, existing + tx.amount);
  }

  return Array.from(spendingByParent.entries())
    .map(([parentKey, amount]) => {
      const parentNames: Record<string, string> = {
        home: "Home",
        transport: "Transport",
        goodlife: "Good Life",
        personal: "Personal",
      };
      return {
        id: parentKey,
        name: parentNames[parentKey] || parentKey,
        amount,
        color: PARENT_CATEGORY_COLORS[parentKey] || "#94a3b8",
        parent: parentKey,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

function MiniAreaChart({
  data,
  dataKey,
  color,
}: {
  data: PeriodData[];
  dataKey: string;
  color: string;
}) {
  const maxValue = Math.max(...data.map((d) => (d[dataKey] as number) || 0));
  const minValue = Math.min(...data.map((d) => (d[dataKey] as number) || 0));
  const yDomainMax = maxValue > 0 ? maxValue * 1.1 : 100;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`${dataKey}Gradient`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={[0, yDomainMax]} hide />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fill={`url(#${dataKey}Gradient)`}
          strokeWidth={2}
          baseLine={0}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface HorizontalStackedBarProps {
  data: CategorySpending[];
}

function HorizontalStackedBar({ data }: HorizontalStackedBarProps) {
  const [hoveredItem, setHoveredItem] = useState<CategorySpending | null>(null);
  const [mouseX, setMouseX] = useState(0);
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
  };

  return (
    <div className="relative">
      <div className="flex h-8 w-full overflow-hidden rounded-full" onMouseMove={handleMouseMove}>
        {data.map((item) => (
          <div
            key={item.id}
            className="h-full cursor-pointer transition-all duration-300 hover:opacity-80"
            style={{
              width: `${(item.amount / total) * 100}%`,
              backgroundColor: item.color,
            }}
            onMouseEnter={() => setHoveredItem(item)}
            onMouseLeave={() => setHoveredItem(null)}
          />
        ))}
      </div>
      {hoveredItem && (
        <div
          className="pointer-events-none absolute top-full z-10 mt-2 -translate-x-1/2 rounded-md border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm whitespace-nowrap shadow-lg"
          style={{ left: mouseX }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: hoveredItem.color }}
            />
            <span className="font-medium text-(--color-text)">{hoveredItem.name}</span>
          </div>
          <div className="mt-1 text-(--color-text)">
            {formatCurrency(hoveredItem.amount)}
            <span className="ml-1 text-xs text-(--color-text-muted)">
              ({((hoveredItem.amount / total) * 100).toFixed(1)}% of {formatCurrency(total)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function OverviewView({ year, granularity = "month" }: OverviewViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fullscreenChart, setFullscreenChart] = useState<"income" | "spending" | "cashflow" | null>(
    null,
  );

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

  const periodData = useMemo(
    () => aggregatePeriodData(transactions, year, granularity, allExpenseCategories),
    [transactions, year, granularity, allExpenseCategories],
  );

  const categorySpending = useMemo(
    () => aggregateCategorySpending(transactions, year),
    [transactions, year],
  );

  const totals = useMemo(() => {
    if (periodData.length === 0) return { income: 0, expenses: 0, savings: 0 };
    return {
      income: periodData.reduce((sum, p) => sum + p.income, 0),
      expenses: periodData.reduce((sum, p) => sum + p.expenses, 0),
      savings: periodData.reduce((sum, p) => sum + p.savings, 0),
    };
  }, [periodData]);

  const recentTransactions = useMemo(() => {
    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  const cashFlowConfig: ChartConfig = useMemo(() => {
    return {
      positiveSavings: { label: "Net Positive", color: "#10b981" },
      negativeSavings: { label: "Net Negative", color: "#ef4444" },
    };
  }, []);

  const currentPeriodTotal = useMemo(() => {
    if (periodData.length === 0) return 0;
    return periodData[periodData.length - 1]?.income || 0;
  }, [periodData]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-(--color-text-muted)">
        <p>Loading overview...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-(--color-text-muted)">
        <p>No transaction data available. Add transactions to see your overview.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg-muted)/30 p-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-(--color-text-muted)">
                Income ({granularity === "month" ? "12 months" : "12 weeks"})
              </span>
              <span className="text-2xl font-semibold text-(--color-text)">
                {formatCurrency(currentPeriodTotal)}
              </span>
              <span className="text-xs text-(--color-text-muted)">Current {granularity}</span>
            </div>
            <button
              onClick={() => setFullscreenChart("income")}
              className="rounded-lg p-2 text-(--color-text-muted) transition-colors hover:bg-(--color-bg-muted) hover:text-(--color-text)"
              title="View fullscreen"
            >
              <ArrowsPointingOutIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="h-32">
            <MiniAreaChart data={periodData} dataKey="income" color="#10b981" />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg-muted)/30 p-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-(--color-text-muted)">Spending Overview</span>
              <span className="text-2xl font-semibold text-(--color-text)">
                {formatCurrency(totals.expenses)}
              </span>
            </div>
            <button
              onClick={() => setFullscreenChart("spending")}
              className="rounded-lg p-2 text-(--color-text-muted) transition-colors hover:bg-(--color-bg-muted) hover:text-(--color-text)"
              title="View fullscreen"
            >
              <ArrowsPointingOutIcon className="h-5 w-5" />
            </button>
          </div>
          <HorizontalStackedBar data={categorySpending} />
          <div className="flex flex-wrap gap-2">
            {categorySpending.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-(--color-text-muted)">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg-muted)/30 p-4 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-(--color-text-muted)">Cash Flow</span>
              <span className="text-2xl font-semibold text-(--color-text)">
                {formatCurrency(totals.savings)}
              </span>
            </div>
            <button
              onClick={() => setFullscreenChart("cashflow")}
              className="rounded-lg p-2 text-(--color-text-muted) transition-colors hover:bg-(--color-bg-muted) hover:text-(--color-text)"
              title="View fullscreen"
            >
              <ArrowsPointingOutIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-(--color-text-muted)">Net Positive</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-(--color-text-muted)">Net Negative</span>
            </div>
          </div>

          <div className="h-48">
            <ChartContainer config={cashFlowConfig} className="h-full w-full">
              <BarChart data={periodData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                <XAxis
                  dataKey="period"
                  stroke="var(--color-text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border)" }}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    const absValue = Math.abs(value);
                    const sign = value < 0 ? "-" : "";
                    return `${sign}$${(absValue / 1000).toFixed(0)}k`;
                  }}
                />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length && payload[0]) {
                      const data = payload[0].payload as PeriodData;
                      return (
                        <div className="rounded-lg border border-(--color-border) bg-(--color-bg) p-3 shadow-lg">
                          <p className="mb-2 font-medium text-(--color-text)">{label}</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-(--color-text-muted)">Income:</span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(data.income)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-(--color-text-muted)">Expenses:</span>
                              <span className="font-medium text-red-500">
                                {formatCurrency(data.expenses)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 border-t border-(--color-border) pt-1">
                              <span className="text-(--color-text-muted)">Net:</span>
                              <span
                                className={`font-medium ${
                                  data.savings >= 0 ? "text-green-600" : "text-red-500"
                                }`}
                              >
                                {formatCurrency(data.savings)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="positiveSavings"
                  name="Net Positive"
                  fill="var(--color-positiveSavings)"
                  radius={[4, 4, 4, 4]}
                />
                <Bar
                  dataKey="negativeSavings"
                  name="Net Negative"
                  fill="var(--color-negativeSavings)"
                  radius={[4, 4, 4, 4]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) bg-(--color-bg-muted)/30 p-4">
          <span className="text-sm font-medium text-(--color-text)">Spending by Category</span>
          <div className="flex flex-col gap-3">
            {categorySpending.slice(0, 4).map((bill) => {
              const IconComponent = getCategoryIcon(bill.parent);
              return (
                <div key={bill.id} className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${bill.color}20` }}
                  >
                    <IconComponent className="h-5 w-5" style={{ color: bill.color }} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-(--color-text)">
                      {bill.name}
                    </span>
                    <span className="text-xs text-(--color-text-muted)">
                      {((bill.amount / totals.expenses) * 100).toFixed(1)}% of spending
                    </span>
                  </div>
                  <span className="text-sm font-medium text-(--color-text)">
                    {formatCurrency(bill.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-(--color-border) bg-(--color-bg-muted)/30 p-4">
        <span className="mb-4 block text-sm font-medium text-(--color-text)">
          Recent Transactions
        </span>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-(--color-border)">
                <th className="pb-2 text-left text-xs font-medium text-(--color-text-muted)">
                  Activity
                </th>
                <th className="pb-2 text-left text-xs font-medium text-(--color-text-muted)">
                  Date
                </th>
                <th className="pb-2 text-right text-xs font-medium text-(--color-text-muted)">
                  Total
                </th>
                <th className="pb-2 text-right text-xs font-medium text-(--color-text-muted)">
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-(--color-border)/50 last:border-0">
                  <td className="py-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-(--color-text)">
                        {tx.description || tx.category}
                      </span>
                      <span className="text-xs text-(--color-text-muted)">{tx.category}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-sm text-(--color-text-muted)">
                      {new Date(tx.date).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`text-sm font-medium ${
                        tx.type === "income" ? "text-green-600" : "text-(--color-text)"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        tx.type === "income"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-gray-500/10 text-(--color-text-muted)"
                      }`}
                    >
                      {tx.type === "income" ? "Income" : "Expense"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={fullscreenChart === "income"}
        onClose={() => setFullscreenChart(null)}
        title={`Income Trend (${granularity === "month" ? "12 months" : "12 weeks"})`}
        size="lg"
      >
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={periodData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fullscreenIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
              <XAxis
                dataKey="period"
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.5rem",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value) => [formatCurrency(Number(value)), "Income"]}
                labelStyle={{ color: "var(--color-text)" }}
                itemStyle={{ color: "var(--color-text)" }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                fill="url(#fullscreenIncomeGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Dialog>

      <Dialog
        open={fullscreenChart === "spending"}
        onClose={() => setFullscreenChart(null)}
        title="Spending Overview by Category"
        size="lg"
      >
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <span className="text-3xl font-semibold text-(--color-text)">
              {formatCurrency(totals.expenses)}
            </span>
            <span className="ml-2 text-(--color-text-muted)">Total Spending</span>
          </div>
          <div className="h-8 w-full overflow-hidden rounded-full">
            {categorySpending.map((item) => (
              <div
                key={item.id}
                className="inline-block h-full"
                style={{
                  width: `${(item.amount / totals.expenses) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categorySpending.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg p-2 hover:bg-(--color-bg-muted)"
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-(--color-text)">
                    {item.name}
                  </span>
                  <span className="text-xs text-(--color-text-muted)">
                    {formatCurrency(item.amount)} (
                    {((item.amount / totals.expenses) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={fullscreenChart === "cashflow"}
        onClose={() => setFullscreenChart(null)}
        title="Cash Flow Analysis"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-(--color-text)">Net Positive</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-(--color-text)">Net Negative</span>
            </div>
          </div>
          <div className="h-96">
            <ChartContainer config={cashFlowConfig} className="h-full w-full">
              <BarChart data={periodData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                <XAxis
                  dataKey="period"
                  stroke="var(--color-text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border)" }}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    const absValue = Math.abs(value);
                    const sign = value < 0 ? "-" : "";
                    return `${sign}$${(absValue / 1000).toFixed(0)}k`;
                  }}
                />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length && payload[0]) {
                      const data = payload[0].payload as PeriodData;
                      return (
                        <div className="rounded-lg border border-(--color-border) bg-(--color-bg) p-3 shadow-lg">
                          <p className="mb-2 font-medium text-(--color-text)">{label}</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-(--color-text-muted)">Income:</span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(data.income)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-(--color-text-muted)">Expenses:</span>
                              <span className="font-medium text-red-500">
                                {formatCurrency(data.expenses)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 border-t border-(--color-border) pt-1">
                              <span className="text-(--color-text-muted)">Net:</span>
                              <span
                                className={`font-medium ${
                                  data.savings >= 0 ? "text-green-600" : "text-red-500"
                                }`}
                              >
                                {formatCurrency(data.savings)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="positiveSavings"
                  name="Net Positive"
                  fill="var(--color-positiveSavings)"
                  radius={[4, 4, 4, 4]}
                />
                <Bar
                  dataKey="negativeSavings"
                  name="Net Negative"
                  fill="var(--color-negativeSavings)"
                  radius={[4, 4, 4, 4]}
                />
              </BarChart>
            </ChartContainer>
          </div>
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="text-sm text-(--color-text-muted)">Income</div>
              <div className="text-xl font-semibold text-green-600">
                {formatCurrency(totals.income)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-(--color-text-muted)">Expenses</div>
              <div className="text-xl font-semibold text-red-500">
                {formatCurrency(totals.expenses)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-(--color-text-muted)">Savings</div>
              <div
                className={`text-xl font-semibold ${
                  totals.savings >= 0 ? "text-blue-500" : "text-red-500"
                }`}
              >
                {formatCurrency(totals.savings)}
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
