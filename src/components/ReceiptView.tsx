import React from "react";

import { formatCurrency, formatPercent } from "../lib/format";
import type { TaxReturn } from "../lib/schema";
import { getTotalTax } from "../lib/tax-calculations";

interface Props {
  data: TaxReturn;
}

function CategoryHeader({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={2} className="pt-6 pb-2">
        <span className="text-xs text-(--color-text-muted)">{children}</span>
      </td>
    </tr>
  );
}

function DataRow({
  label,
  amount,
  isMuted,
  showSign,
}: {
  label: string;
  amount: number;
  isMuted?: boolean;
  showSign?: boolean;
}) {
  return (
    <tr className={isMuted ? "text-(--color-text-muted)" : ""}>
      <td className="py-1.5 text-sm">{label}</td>
      <td className="py-1.5 text-right text-sm slashed-zero tabular-nums">
        {showSign && amount >= 0 ? "+" : ""}
        {formatCurrency(amount)}
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  amount,
  showSign,
}: {
  label: string;
  amount: number;
  showSign?: boolean;
}) {
  return (
    <>
      <tr>
        <td colSpan={2} className="h-2" />
      </tr>
      <tr className="border-t border-(--color-border) font-semibold">
        <td className="py-2 pt-4 text-sm">{label}</td>
        <td className="py-2 pt-4 text-right text-sm slashed-zero tabular-nums">
          {showSign && amount >= 0 ? "+" : ""}
          {formatCurrency(amount)}
        </td>
      </tr>
    </>
  );
}

function RatesSection({ rates, stateName }: { rates: TaxReturn["rates"]; stateName?: string }) {
  if (!rates) return null;
  return (
    <>
      <tr>
        <td className="pt-6 pb-2 text-xs text-(--color-text-muted)">Tax Rates</td>
        <td className="pt-6 pb-2 text-right text-xs text-(--color-text-muted)">
          <span className="inline-block w-16">Marginal</span>
          <span className="inline-block w-16">Effective</span>
        </td>
      </tr>
      <tr>
        <td className="py-1.5 text-sm">Federal</td>
        <td className="py-1.5 text-right text-sm slashed-zero tabular-nums">
          <span className="inline-block w-16">{formatPercent(rates.federal.marginal)}</span>
          <span className="inline-block w-16">{formatPercent(rates.federal.effective)}</span>
        </td>
      </tr>
      {rates.state && (
        <tr>
          <td className="py-1.5 text-sm">{stateName || "State"}</td>
          <td className="py-1.5 text-right text-sm slashed-zero tabular-nums">
            <span className="inline-block w-16">{formatPercent(rates.state.marginal)}</span>
            <span className="inline-block w-16">{formatPercent(rates.state.effective)}</span>
          </td>
        </tr>
      )}
      {rates.combined && (
        <>
          <tr>
            <td colSpan={2} className="h-2" />
          </tr>
          <tr className="border-t border-(--color-border)">
            <td className="py-2 pt-4 text-sm font-medium">Combined</td>
            <td className="py-2 pt-4 text-right text-sm font-medium slashed-zero tabular-nums">
              <span className="inline-block w-16">{formatPercent(rates.combined.marginal)}</span>
              <span className="inline-block w-16">{formatPercent(rates.combined.effective)}</span>
            </td>
          </tr>
        </>
      )}
    </>
  );
}

export function ReceiptView({ data }: Props) {
  const totalTax = getTotalTax(data);
  const netIncome = data.income.total - totalTax;
  const grossMonthly = Math.round(data.income.total / 12);
  const netMonthly = Math.round(netIncome / 12);

  return (
    <div className="px-4 py-4 md:px-0 md:py-8 md:pb-12">
      <div className="dark:shadow-contrast mx-auto max-w-2xl rounded-lg bg-white shadow-md ring-[0.5px] ring-black/5 dark:bg-neutral-900">
        {/* Content Table */}
        <div className="px-6 pb-6">
          <table className="w-full">
            <tbody className="no-zebra">
              <CategoryHeader>Monthly Breakdown</CategoryHeader>
              <DataRow label="Gross monthly" amount={grossMonthly} />
              <DataRow label="Net monthly" amount={netMonthly} />

              <CategoryHeader>Income</CategoryHeader>
              {data.income.items.map((item, i) => (
                <DataRow key={i} label={item.label} amount={item.amount} />
              ))}
              <TotalRow label="Total income" amount={data.income.total} />

              <CategoryHeader>Federal</CategoryHeader>
              <DataRow label="Adjusted gross income" amount={data.federal.agi} />
              {data.federal.deductions.map((item, i) => (
                <DataRow key={i} label={item.label} amount={item.amount} isMuted />
              ))}
              <DataRow label="Taxable income" amount={data.federal.taxableIncome} />
              <DataRow label="Tax" amount={data.federal.tax} />
              {data.federal.additionalTaxes.map((item, i) => (
                <DataRow key={`addtax-${i}`} label={item.label} amount={item.amount} isMuted />
              ))}
              {data.federal.credits.map((item, i) => (
                <DataRow key={i} label={item.label} amount={item.amount} isMuted />
              ))}
              {data.federal.payments.map((item, i) => (
                <DataRow key={i} label={item.label} amount={item.amount} isMuted />
              ))}
              <TotalRow
                label={data.federal.refundOrOwed >= 0 ? "Refund" : "Owed"}
                amount={data.federal.refundOrOwed}
                showSign
              />

              {data.states.map((state, i) => (
                <React.Fragment key={i}>
                  <CategoryHeader>{state.name}</CategoryHeader>
                  <DataRow label="Adjusted gross income" amount={state.agi} />
                  {state.deductions.map((item, j) => (
                    <DataRow key={j} label={item.label} amount={item.amount} isMuted />
                  ))}
                  <DataRow label="Taxable income" amount={state.taxableIncome} />
                  <DataRow label="Tax" amount={state.tax} />
                  {state.adjustments.map((item, j) => (
                    <DataRow key={j} label={item.label} amount={item.amount} />
                  ))}
                  {state.payments.map((item, j) => (
                    <DataRow key={j} label={item.label} amount={item.amount} isMuted />
                  ))}
                  <TotalRow
                    label={state.refundOrOwed >= 0 ? "Refund" : "Owed"}
                    amount={state.refundOrOwed}
                    showSign
                  />
                </React.Fragment>
              ))}

              <CategoryHeader>Net Position</CategoryHeader>
              <DataRow
                label={`Federal ${data.summary.federalAmount >= 0 ? "refund" : "owed"}`}
                amount={data.summary.federalAmount}
                showSign
              />
              {data.summary.stateAmounts.map((item, i) => (
                <DataRow
                  key={i}
                  label={`${item.state} ${item.amount >= 0 ? "refund" : "owed"}`}
                  amount={item.amount}
                  showSign
                />
              ))}
              <TotalRow label="Net" amount={data.summary.netPosition} showSign />

              <RatesSection rates={data.rates} stateName={data.states[0]?.name} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
