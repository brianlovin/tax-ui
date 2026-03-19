import { type ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { formatCurrency } from "../lib/format";
import type { Payslip, TaxReturn } from "../lib/schema";
import { getTotalTax } from "../lib/tax-calculations";
import { type ColumnMeta, Table } from "./Table";

interface Props {
  data?: TaxReturn;
  returns?: Record<number, TaxReturn>;
  year?: number;
  granularity?: "month" | "week";
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

function getCurrentMonth(): number {
  return new Date().getMonth(); // 0-indexed
}

function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}

function collectIncomeRows(
  returns: Record<number, TaxReturn>,
  granularity: TimeGranularity,
  singleYear?: number,
  payslips?: Payslip[],
): IncomeRow[] {
  const rows: IncomeRow[] = [];
  const periods = granularity === "month" ? 12 : 52;

  // For single year view
  if (singleYear !== undefined) {
    const data = returns[singleYear];
    const hasData = !!data;

    // Filter payslips for this year
    const yearPayslips = (payslips || []).filter((p) => {
      const payYear = new Date(p.period.payDate).getFullYear();
      return payYear === singleYear;
    });

    // Add monthly breakdown
    rows.push({
      id: "header-breakdown",
      label: "Monthly Breakdown",
      isHeader: true,
      values: Array(periods).fill(0),
    });

    const monthlyGross = hasData ? Math.round(data.income.total / 12) : 0;
    const monthlyNet = hasData ? Math.round((data.income.total - getTotalTax(data)) / 12) : 0;
    const monthlyTaxes = hasData ? Math.round(getTotalTax(data) / 12) : 0;

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

    if (hasData) {
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
    } else {
      rows.push({
        id: "total-income",
        label: "Total Income",
        values: Array(periods).fill(0),
      });
    }

    // Add payslip data if available
    if (yearPayslips.length > 0) {
      // Aggregate payslip earnings by month
      const monthlyPayslipGross: number[] = Array(periods).fill(0);
      const monthlyPayslipNet: number[] = Array(periods).fill(0);

      for (const payslip of yearPayslips) {
        const month = new Date(payslip.period.payDate).getMonth(); // 0-indexed
        monthlyPayslipGross[month] = (monthlyPayslipGross[month] ?? 0) + payslip.grossEarnings;
        monthlyPayslipNet[month] = (monthlyPayslipNet[month] ?? 0) + payslip.netPay;
      }

      rows.push({
        id: "header-payslips",
        label: "Payslips",
        isHeader: true,
        values: Array(periods).fill(0),
      });

      rows.push({
        id: "payslip-gross",
        label: "Gross (from payslips)",
        values: monthlyPayslipGross,
      });

      rows.push({
        id: "payslip-net",
        label: "Net (from payslips)",
        values: monthlyPayslipNet,
      });
    }

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

export function IncomeView({ data, returns, year, granularity = "month" }: Props) {
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  // Fetch payslips on mount
  useEffect(() => {
    fetch("/api/payslips")
      .then((res) => res.json())
      .then((data) => setPayslips(data))
      .catch(console.error);
  }, []);

  const singleYear = year ?? data?.year;
  const effectiveReturns = returns || (data ? { [data.year]: data } : {});

  const rows = useMemo(
    () => collectIncomeRows(effectiveReturns, granularity, singleYear, payslips),
    [effectiveReturns, granularity, singleYear, payslips],
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
      const currentYear = new Date().getFullYear();
      const isCurrentYear = singleYear === currentYear;
      const currentMonth = getCurrentMonth();
      const currentWeek = getCurrentWeek();
      const numPeriods = granularity === "month" ? 12 : 52;

      // Single year - show all periods
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
            return <span className="slashed-zero tabular-nums">{formatValue(row.values[i])}</span>;
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
