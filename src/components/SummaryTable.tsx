import { useMemo } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import type { TaxReturn } from "../lib/schema";
import { formatCurrency, formatPercent } from "../lib/format";
import { getTotalTax } from "../lib/tax-calculations";
import { Table, type ColumnMeta } from "./Table";
import { ChangeCell } from "./ChangeCell";

interface Props {
  returns: Record<number, TaxReturn>;
}

interface SummaryRow {
  id: string;
  category: string;
  label: string;
  isHeader?: boolean;
  values: Record<number, number | undefined>;
  invertPolarity?: boolean;
  showChange?: boolean;
}

function collectRows(returns: Record<number, TaxReturn>): SummaryRow[] {
  const rows: SummaryRow[] = [];
  const allReturns = Object.values(returns);
  const years = Object.keys(returns).map(Number);

  const addRow = (
    category: string,
    label: string,
    getValue: (data: TaxReturn) => number | undefined,
    options?: { invertPolarity?: boolean; showChange?: boolean }
  ) => {
    const values: Record<number, number | undefined> = {};
    for (const year of years) {
      const data = returns[year];
      if (data) values[year] = getValue(data);
    }
    rows.push({
      id: `${category}-${label}-${rows.length}`,
      category,
      label,
      values,
      invertPolarity: options?.invertPolarity,
      showChange: options?.showChange,
    });
  };

  const addHeader = (category: string) => {
    rows.push({
      id: `header-${category}`,
      category,
      label: category,
      isHeader: true,
      values: {},
    });
  };

  // Monthly Breakdown
  addHeader("Monthly Breakdown");
  addRow("Monthly Breakdown", "Gross monthly", (data) =>
    Math.round(data.income.total / 12),
    { showChange: true }
  );
  addRow("Monthly Breakdown", "Net monthly (after tax)", (data) =>
    Math.round((data.income.total - getTotalTax(data)) / 12),
    { showChange: true }
  );
  addRow("Monthly Breakdown", "Daily take-home", (data) =>
    Math.round((data.income.total - getTotalTax(data)) / 12 / 30),
    { showChange: true }
  );

  // Income items
  addHeader("Income");
  const incomeLabels = new Set<string>();
  for (const r of allReturns) {
    for (const item of r.income.items) {
      incomeLabels.add(item.label);
    }
  }
  for (const label of incomeLabels) {
    addRow("Income", label, (data) =>
      data.income.items.find((i) => i.label === label)?.amount
    );
  }
  addRow("Income", "Total income", (data) => data.income.total, { showChange: true });

  // Federal
  addHeader("Federal");
  addRow("Federal", "Adjusted gross income", (data) => data.federal.agi, { showChange: true });

  const federalDeductionLabels = new Set<string>();
  for (const r of allReturns) {
    for (const item of r.federal.deductions) {
      federalDeductionLabels.add(item.label);
    }
  }
  for (const label of federalDeductionLabels) {
    addRow("Federal", label, (data) =>
      data.federal.deductions.find((i) => i.label === label)?.amount
    );
  }

  addRow("Federal", "Taxable income", (data) => data.federal.taxableIncome, { showChange: true });
  addRow("Federal", "Tax", (data) => data.federal.tax, { invertPolarity: true, showChange: true });

  const federalCreditLabels = new Set<string>();
  for (const r of allReturns) {
    for (const item of r.federal.credits) {
      federalCreditLabels.add(item.label);
    }
  }
  for (const label of federalCreditLabels) {
    addRow("Federal", label, (data) =>
      data.federal.credits.find((i) => i.label === label)?.amount
    );
  }

  const federalPaymentLabels = new Set<string>();
  for (const r of allReturns) {
    for (const item of r.federal.payments) {
      federalPaymentLabels.add(item.label);
    }
  }
  for (const label of federalPaymentLabels) {
    addRow("Federal", label, (data) =>
      data.federal.payments.find((i) => i.label === label)?.amount
    );
  }

  addRow("Federal", "Refund/Owed", (data) => data.federal.refundOrOwed, { showChange: true });

  // States
  const allStates = new Set<string>();
  for (const r of allReturns) {
    for (const s of r.states) {
      allStates.add(s.name);
    }
  }

  for (const stateName of allStates) {
    const getState = (data: TaxReturn) =>
      data.states.find((s) => s.name === stateName);

    addHeader(stateName);
    addRow(stateName, "Adjusted gross income", (data) => getState(data)?.agi, { showChange: true });

    const stateDeductionLabels = new Set<string>();
    for (const r of allReturns) {
      const state = r.states.find((s) => s.name === stateName);
      if (state) {
        for (const item of state.deductions) {
          stateDeductionLabels.add(item.label);
        }
      }
    }
    for (const label of stateDeductionLabels) {
      addRow(stateName, label, (data) =>
        getState(data)?.deductions.find((i) => i.label === label)?.amount
      );
    }

    addRow(stateName, "Taxable income", (data) => getState(data)?.taxableIncome, { showChange: true });
    addRow(stateName, "Tax", (data) => getState(data)?.tax, { invertPolarity: true, showChange: true });

    const stateAdjustmentLabels = new Set<string>();
    for (const r of allReturns) {
      const state = r.states.find((s) => s.name === stateName);
      if (state) {
        for (const item of state.adjustments) {
          stateAdjustmentLabels.add(item.label);
        }
      }
    }
    for (const label of stateAdjustmentLabels) {
      addRow(stateName, label, (data) =>
        getState(data)?.adjustments.find((i) => i.label === label)?.amount
      );
    }

    const statePaymentLabels = new Set<string>();
    for (const r of allReturns) {
      const state = r.states.find((s) => s.name === stateName);
      if (state) {
        for (const item of state.payments) {
          statePaymentLabels.add(item.label);
        }
      }
    }
    for (const label of statePaymentLabels) {
      addRow(stateName, label, (data) =>
        getState(data)?.payments.find((i) => i.label === label)?.amount
      );
    }

    addRow(stateName, "Refund/Owed", (data) => getState(data)?.refundOrOwed, { showChange: true });
  }

  // Net Position
  addHeader("Net Position");
  addRow("Net Position", "Federal", (data) => data.summary.federalAmount, { showChange: true });
  for (const stateName of allStates) {
    addRow("Net Position", stateName, (data) =>
      data.summary.stateAmounts.find((s) => s.state === stateName)?.amount,
      { showChange: true }
    );
  }
  addRow("Net Position", "Net total", (data) => data.summary.netPosition, { showChange: true });

  // Rates
  addHeader("Rates");
  addRow("Rates", "Federal marginal", (data) => data.rates?.federal.marginal, { invertPolarity: true });
  addRow("Rates", "Federal effective", (data) => data.rates?.federal.effective, { invertPolarity: true });
  addRow("Rates", "State marginal", (data) => data.rates?.state?.marginal, { invertPolarity: true });
  addRow("Rates", "State effective", (data) => data.rates?.state?.effective, { invertPolarity: true });
  addRow("Rates", "Combined marginal", (data) => data.rates?.combined?.marginal, { invertPolarity: true });
  addRow("Rates", "Combined effective", (data) => data.rates?.combined?.effective, { invertPolarity: true });

  return rows;
}

function formatValue(value: number | undefined, isRate: boolean): string {
  if (value === undefined) return "—";
  if (isRate) return formatPercent(value);
  return formatCurrency(value);
}

const columnHelper = createColumnHelper<SummaryRow>();

export function SummaryTable({ returns }: Props) {
  const years = Object.keys(returns)
    .map(Number)
    .sort((a, b) => a - b); // Oldest first

  const rows = useMemo(() => collectRows(returns), [returns]);

  const columns = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols: ColumnDef<SummaryRow, any>[] = [
      columnHelper.accessor("label", {
        header: "Line Item",
        cell: (info) => {
          const row = info.row.original;
          if (row.isHeader) {
            return (
              <div className="pt-2">
                <span className="text-xs text-(--color-text-muted)">
                  {row.label}
                </span>
              </div>
            );
          }
          const isDeduction = row.label.startsWith("−") || row.label.startsWith("–") || row.label.startsWith("- ");
          return (
            <span className={isDeduction ? "text-(--color-text-muted)" : "text-(--color-text)"}>
              {info.getValue()}
            </span>
          );
        },
        meta: {
          sticky: true,
        } satisfies ColumnMeta,
        size: 180,
        maxSize: 180,
      }),
    ];

    years.forEach((year, i) => {
      const prevYear = i > 0 ? years[i - 1] : undefined;

      cols.push(
        columnHelper.accessor((row) => row.values[year], {
          id: `year-${year}`,
          header: () => <span className="tabular-nums slashed-zero">{year}</span>,
          cell: (info) => {
            const row = info.row.original;
            if (row.isHeader) {
              return null;
            }

            const value = info.getValue() as number | undefined;
            const isRate = row.category === "Rates";
            const prevValue = prevYear !== undefined ? row.values[prevYear] : undefined;

            const isDeduction = row.label.startsWith("−") || row.label.startsWith("–") || row.label.startsWith("- ");

            const isEmpty = value === undefined;

            return (
              <div className="text-right tabular-nums slashed-zero flex items-center justify-end gap-2">
                <span className={isEmpty ? "text-(--color-text-tertiary)" : isDeduction ? "text-(--color-text-muted)" : "text-(--color-text)"}>
                  {formatValue(value, isRate)}
                </span>
                {prevYear !== undefined && row.showChange && (
                  <span className="hidden sm:inline">
                    <ChangeCell
                      current={value}
                      previous={prevValue}
                      invertPolarity={row.invertPolarity}
                    />
                  </span>
                )}
              </div>
            );
          },
          meta: {
            align: "right",
            borderLeft: i > 0,
          } satisfies ColumnMeta,
          size: 180,
        })
      );
    });

    return cols;
  }, [years]);

  const getRowClassName = (row: SummaryRow) => {
    if (row.isHeader && row.category !== "Monthly Breakdown") {
      return "border-t border-(--color-border)";
    }
    return "";
  };

  const isRowHoverDisabled = (row: SummaryRow) => row.isHeader === true;

  return (
    <div className="text-sm w-full h-full">
      <Table
        data={rows}
        columns={columns}
        storageKey="summary-table"
        getRowClassName={getRowClassName}
        isRowHoverDisabled={isRowHoverDisabled}
      />
    </div>
  );
}
