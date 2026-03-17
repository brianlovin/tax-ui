import { type ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { formatCurrency } from "../lib/format";
import type { TaxReturn } from "../lib/schema";
import { getTotalTax } from "../lib/tax-calculations";
import { type ColumnMeta, Table } from "./Table";

interface Props {
  data?: TaxReturn;
  returns?: Record<number, TaxReturn>;
}

type TimeGranularity = "month" | "week";

interface IncomeRow {
  id: string;
  label: string;
  isHeader?: boolean;
  values: number[]; // One value per period (month or week)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getWeekLabels(year?: number): string[] {
  const weeks = [];
  const numWeeks = 52;
  for (let i = 1; i <= numWeeks; i++) {
    weeks.push(`W${i}`);
  }
  return weeks;
}

function collectIncomeRows(
  returns: Record<number, TaxReturn>,
  granularity: TimeGranularity,
  singleYear?: number,
): IncomeRow[] {
  const rows: IncomeRow[] = [];
  const periods = granularity === "month" ? 12 : 52;

  // For single year view
  if (singleYear !== undefined) {
    const data = returns[singleYear];
    if (!data) return [];

    // Add monthly breakdown
    rows.push({
      id: "header-breakdown",
      label: "Monthly Breakdown",
      isHeader: true,
      values: Array(periods).fill(0),
    });

    const monthlyGross = Math.round(data.income.total / 12);
    const monthlyNet = Math.round((data.income.total - getTotalTax(data)) / 12);
    const monthlyTaxes = Math.round(getTotalTax(data) / 12);

    rows.push({
      id: "gross-monthly",
      label: "Gross monthly",
      values: Array(periods).fill(monthlyGross),
    });

    rows.push({
      id: "tax-monthly",
      label: "Tax monthly",
      values: Array(periods).fill(monthlyTaxes),
    });

    rows.push({
      id: "net-monthly",
      label: "Net monthly",
      values: Array(periods).fill(monthlyNet),
    });

    // Add income items
    rows.push({
      id: "header-income",
      label: "Income",
      isHeader: true,
      values: Array(periods).fill(0),
    });

    for (const item of data.income.items) {
      rows.push({
        id: `income-${item.label}`,
        label: item.label,
        values: Array(periods).fill(Math.round(item.amount / periods)),
      });
    }

    rows.push({
      id: "total-income",
      label: "Total Income",
      values: Array(periods).fill(Math.round(data.income.total / periods)),
    });

    return rows;
  }

  // For summary view (all years) - show by year
  const years = Object.keys(returns)
    .map(Number)
    .sort((a, b) => a - b);

  if (years.length === 0) return [];

  rows.push({
    id: "header-annual",
    label: "Annual Income",
    isHeader: true,
    values: [],
  });

  // Add total income per year
  for (const year of years) {
    const data = returns[year];
    if (!data) continue;

    rows.push({
      id: `year-${year}`,
      label: String(year),
      values: [data.income.total],
    });
  }

  return rows;
}

function formatValue(value: number | undefined): string {
  if (value === undefined || value === 0) return "—";
  return formatCurrency(value);
}

export function IncomeView({ data, returns }: Props) {
  const [granularity, setGranularity] = useState<TimeGranularity>("month");

  const singleYear = data?.year;
  const effectiveReturns = returns || (data ? { [data.year]: data } : {});

  const rows = useMemo(
    () => collectIncomeRows(effectiveReturns, granularity, singleYear),
    [effectiveReturns, granularity, singleYear],
  );

  const periodLabels = granularity === "month" ? MONTHS : getWeekLabels(singleYear);

  const columns = useMemo<ColumnDef<IncomeRow>[]>(() => {
    const cols: ColumnDef<IncomeRow>[] = [
      {
        accessorKey: "label",
        header: granularity === "month" ? "Income" : "Week",
        cell: (info) => {
          const row = info.row.original;
          if (row.isHeader) {
            return (
              <div className="pt-2">
                <span className="text-xs font-medium text-(--color-text-muted)">{row.label}</span>
              </div>
            );
          }
          return <span className="truncate">{String(info.getValue())}</span>;
        },
        meta: {
          sticky: true,
        } satisfies ColumnMeta,
        size: 160,
      },
    ];

    // Add period columns
    if (singleYear !== undefined) {
      // Single year - show all periods
      for (let i = 0; i < (granularity === "month" ? 12 : 52); i++) {
        cols.push({
          id: `period-${i}`,
          header: periodLabels[i],
          cell: (info) => {
            const row = info.row.original;
            if (row.isHeader) return null;
            return (
              <span className="slashed-zero tabular-nums">
                {formatValue(row.values[i])}
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
      // Summary - single column with total
      cols.push({
        id: "total",
        header: "Total",
        cell: (info) => {
          const row = info.row.original;
          if (row.isHeader) return null;
          const total = row.values[0] || 0;
          return (
            <span className="font-medium slashed-zero tabular-nums">{formatValue(total)}</span>
          );
        },
        meta: {
          align: "right" as const,
        } satisfies ColumnMeta,
        size: 120,
      });
    }

    return cols;
  }, [granularity, singleYear, periodLabels]);

  const getRowClassName = (row: IncomeRow) => {
    if (row.isHeader) {
      return "border-t border-(--color-border)";
    }
    return "";
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-(--color-text-muted)">
        No income data available
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Granularity toggle for single year view */}
      {singleYear !== undefined && (
        <div className="flex items-center justify-end gap-2 border-b border-(--color-border) px-4 py-2">
          <span className="text-xs text-(--color-text-muted)">View by:</span>
          <button
            onClick={() => setGranularity("month")}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium",
              granularity === "month"
                ? "bg-(--color-brand) text-white"
                : "text-(--color-text-muted) hover:text-(--color-text)",
            )}
          >
            Month
          </button>
          <button
            onClick={() => setGranularity("week")}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium",
              granularity === "week"
                ? "bg-(--color-brand) text-white"
                : "text-(--color-text-muted) hover:text-(--color-text)",
            )}
          >
            Week
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        <Table
          data={rows}
          columns={columns}
          storageKey={`income-table-${singleYear ?? "summary"}`}
          isRowHoverDisabled={(row) => row.isHeader === true}
          getRowClassName={getRowClassName}
        />
      </div>
    </div>
  );
}

import { cn } from "../lib/cn";
