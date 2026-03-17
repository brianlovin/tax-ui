import { type ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { cn } from "../lib/cn";
import { formatCurrency, formatPercent } from "../lib/format";
import type { TaxReturn } from "../lib/schema";
import { getTotalTax } from "../lib/tax-calculations";
import { type ColumnMeta, Table } from "./Table";

interface Props {
  data?: TaxReturn;
  returns?: Record<number, TaxReturn>;
}

type TimeGranularity = "month" | "week";

interface TaxRow {
  id: string;
  label: string;
  isHeader?: boolean;
  values: number[];
  isRate?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getWeekLabels(): string[] {
  return Array.from({ length: 52 }, (_, i) => `W${i + 1}`);
}

function collectTaxRows(
  returns: Record<number, TaxReturn>,
  granularity: TimeGranularity,
  singleYear?: number,
): TaxRow[] {
  const rows: TaxRow[] = [];
  const periods = granularity === "month" ? 12 : 52;

  // For single year view
  if (singleYear !== undefined) {
    const data = returns[singleYear];
    if (!data) return [];

    const getData = data;

    // Tax calculation breakdown
    rows.push({
      id: "header-calculation",
      label: "Tax Calculation",
      isHeader: true,
      values: Array(periods).fill(0),
    });

    rows.push({
      id: "gross-tax",
      label: "Gross Tax",
      values: Array(periods).fill(Math.round(getData.tax.grossTax / periods)),
    });

    rows.push({
      id: "medicare-levy",
      label: "Medicare Levy",
      values: Array(periods).fill(Math.round(getData.tax.medicareLevy / periods)),
    });

    if (getData.tax.medicareLevySurcharge) {
      rows.push({
        id: "medicare-surcharge",
        label: "Medicare Surcharge",
        values: Array(periods).fill(Math.round(getData.tax.medicareLevySurcharge / periods)),
      });
    }

    if (getData.tax.helpRepayment) {
      rows.push({
        id: "help",
        label: "HELP/HECS",
        values: Array(periods).fill(Math.round(getData.tax.helpRepayment / periods)),
      });
    }

    rows.push({
      id: "total-before-offsets",
      label: "Total Before Offsets",
      values: Array(periods).fill(Math.round(getData.tax.totalTaxBeforeOffsets / periods)),
    });

    // Tax offsets
    if (getData.tax.offsets.length > 0) {
      rows.push({
        id: "header-offsets",
        label: "Tax Offsets",
        isHeader: true,
        values: Array(periods).fill(0),
      });

      for (const offset of getData.tax.offsets) {
        rows.push({
          id: `offset-${offset.label}`,
          label: offset.label,
          values: Array(periods).fill(Math.round(offset.amount / periods)),
        });
      }

      rows.push({
        id: "total-offsets",
        label: "Total Offsets",
        values: Array(periods).fill(Math.round(getData.tax.totalOffsets / periods)),
      });
    }

    rows.push({
      id: "tax-payable",
      label: "Tax Payable",
      values: Array(periods).fill(Math.round(getData.tax.taxPayable / periods)),
    });

    // PAYG Withholding
    rows.push({
      id: "header-payg",
      label: "PAYG Withholding",
      isHeader: true,
      values: Array(periods).fill(0),
    });

    for (const payment of getData.paygWithholding.items) {
      rows.push({
        id: `payg-${payment.label}`,
        label: payment.label,
        values: Array(periods).fill(Math.round(payment.amount / periods)),
      });
    }

    rows.push({
      id: "total-payg",
      label: "Total Tax Paid",
      values: Array(periods).fill(Math.round(getData.paygWithholding.total / periods)),
    });

    // Result
    rows.push({
      id: "header-result",
      label: "Result",
      isHeader: true,
      values: Array(periods).fill(0),
    });

    const monthlyRefundOrOwing = Math.round(getData.result.refundOrOwing / periods);
    rows.push({
      id: "refund-owing",
      label: getData.result.isRefund ? "Monthly Refund" : "Monthly Owing",
      values: Array(periods).fill(monthlyRefundOrOwing),
    });

    // Rates (annual, shown once)
    if (getData.rates) {
      rows.push({
        id: "header-rates",
        label: "Tax Rates (Annual)",
        isHeader: true,
        values: Array(periods).fill(0),
      });

      rows.push({
        id: "marginal-rate",
        label: "Marginal Rate",
        values: Array(periods).fill(getData.rates.federal.marginal),
        isRate: true,
      });

      rows.push({
        id: "effective-rate",
        label: "Effective Rate",
        values: Array(periods).fill(getData.rates.federal.effective),
        isRate: true,
      });

      if (getData.rates.medicare) {
        rows.push({
          id: "medicare-rate",
          label: "Medicare Rate",
          values: Array(periods).fill(getData.rates.medicare.rate),
          isRate: true,
        });
      }
    }

    return rows;
  }

  // For summary view (all years)
  const years = Object.keys(returns)
    .map(Number)
    .sort((a, b) => a - b);

  if (years.length === 0) return [];

  rows.push({
    id: "header-annual",
    label: "Annual Taxes",
    isHeader: true,
    values: [],
  });

  for (const year of years) {
    const data = returns[year];
    if (!data) continue;

    rows.push({
      id: `year-${year}`,
      label: String(year),
      values: [getTotalTax(data)],
    });

    rows.push({
      id: `year-${year}-effective`,
      label: `  Effective Rate`,
      values: [data.rates?.federal.effective || 0],
      isRate: true,
    });
  }

  return rows;
}

function formatValue(value: number | undefined, isRate?: boolean): string {
  if (value === undefined || value === 0) return "—";
  if (isRate) return formatPercent(value);
  return formatCurrency(value);
}

export function TaxesView({ data, returns }: Props) {
  const [granularity, setGranularity] = useState<TimeGranularity>("month");

  const singleYear = data?.year;
  const effectiveReturns = returns || (data ? { [data.year]: data } : {});

  const rows = useMemo(
    () => collectTaxRows(effectiveReturns, granularity, singleYear),
    [effectiveReturns, granularity, singleYear],
  );

  const periodLabels = granularity === "month" ? MONTHS : getWeekLabels();

  const columns = useMemo<ColumnDef<TaxRow>[]>(() => {
    const cols: ColumnDef<TaxRow>[] = [
      {
        accessorKey: "label",
        header: granularity === "month" ? "Taxes" : "Week",
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

    if (singleYear !== undefined) {
      for (let i = 0; i < (granularity === "month" ? 12 : 52); i++) {
        cols.push({
          id: `period-${i}`,
          header: periodLabels[i],
          cell: (info) => {
            const row = info.row.original;
            if (row.isHeader) return null;
            return (
              <span className="slashed-zero tabular-nums">
                {formatValue(row.values[i], row.isRate)}
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
          return (
            <span className="font-medium slashed-zero tabular-nums">
              {formatValue(total, row.isRate)}
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
  }, [granularity, singleYear, periodLabels]);

  const getRowClassName = (row: TaxRow) => {
    if (row.isHeader) {
      return "border-t border-(--color-border)";
    }
    return "";
  };

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-(--color-text-muted)">
        No tax data available
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
          storageKey={`taxes-table-${singleYear ?? "summary"}`}
          isRowHoverDisabled={(row) => row.isHeader === true}
          getRowClassName={getRowClassName}
        />
      </div>
    </div>
  );
}
