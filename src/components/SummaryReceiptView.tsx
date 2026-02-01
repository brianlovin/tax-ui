import { useMemo, useState } from "react";
import { cn } from "../lib/cn";
import type { TaxReturn } from "../lib/schema";
import { formatPercent } from "../lib/format";
import { aggregateSummary } from "../lib/summary";
import { type TimeUnit, TIME_UNIT_LABELS, convertToTimeUnit, formatTimeUnitValue } from "../lib/time-units";
import { Row, RateRow } from "./Row";
import { Separator, DoubleSeparator, SectionHeader } from "./Section";

interface Props {
  returns: Record<number, TaxReturn>;
}

export function SummaryReceiptView({ returns }: Props) {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("daily");
  const data = useMemo(() => aggregateSummary(returns), [returns]);

  if (!data) {
    return (
      <div className="max-w-md mx-auto px-6 py-12 font-mono text-sm text-(--color-text-muted)">
        No tax returns available.
      </div>
    );
  }

  const timeUnitValue = convertToTimeUnit(data.avgHourlyRate, timeUnit);
  const yearRange = data.years.length > 1
    ? `${data.years[0]}–${data.years[data.years.length - 1]}`
    : String(data.years[0]);

  return (
    <div className="max-w-md mx-auto px-6 py-12 font-mono text-sm">
      <header className="mb-2">
        <h1 className="text-lg font-bold tracking-tight">TAX SUMMARY</h1>
        <p className="text-(--color-text-muted) text-xs">
          {data.yearCount} year{data.yearCount > 1 ? "s" : ""}: {yearRange}
        </p>
      </header>

      <SectionHeader>TOTAL INCOME</SectionHeader>
      <Separator />
      {data.incomeItems.map((item, i) => (
        <Row key={i} label={item.label} amount={item.amount} />
      ))}
      <Separator />
      <Row label="Total income" amount={data.totalIncome} isTotal />

      <SectionHeader>FEDERAL TOTALS</SectionHeader>
      <Separator />
      <Row label="Avg. adjusted gross income" amount={Math.round(data.avgAgi)} />
      {data.federalDeductions.map((item, i) => (
        <Row key={i} label={`Total ${item.label.toLowerCase()}`} amount={item.amount} isMuted />
      ))}
      <Separator />
      <Row label="Avg. taxable income" amount={Math.round(data.avgTaxableIncome)} />
      <Row label="Total federal tax" amount={data.totalFederalTax} />

      {data.states.length > 0 && (
        <>
          <SectionHeader>STATE TOTALS</SectionHeader>
          <Separator />
          {data.states.map((state, i) => (
            <Row key={i} label={`${state.name} tax`} amount={state.tax} />
          ))}
          <Separator />
          <Row label="Total state tax" amount={data.totalStateTax} isTotal />
        </>
      )}

      <SectionHeader>NET POSITION</SectionHeader>
      <Separator />
      <Row
        label={`Federal ${data.totalFederalRefund >= 0 ? "refund" : "owed"}`}
        amount={data.totalFederalRefund}
        showSign
      />
      {data.stateRefunds.map((item, i) => (
        <Row
          key={i}
          label={`${item.state} ${item.amount >= 0 ? "refund" : "owed"}`}
          amount={item.amount}
          showSign
        />
      ))}
      <DoubleSeparator />
      <Row label="Total net" amount={data.totalNetPosition} isTotal showSign />

      {data.rates && (
        <>
          <SectionHeader>AVERAGE TAX RATES</SectionHeader>
          <Separator />
          <div className="flex justify-between py-0.5 text-(--color-text-muted) text-xs">
            <span className="w-32" />
            <span className="w-20 text-right">Marginal</span>
            <span className="w-20 text-right">Effective</span>
          </div>
          <RateRow
            label="Federal"
            marginal={formatPercent(data.rates.federal.marginal)}
            effective={formatPercent(data.rates.federal.effective)}
          />
          {data.rates.state && (
            <RateRow
              label="State"
              marginal={formatPercent(data.rates.state.marginal)}
              effective={formatPercent(data.rates.state.effective)}
            />
          )}
          {data.rates.combined && (
            <>
              <Separator />
              <RateRow
                label="Combined"
                marginal={formatPercent(data.rates.combined.marginal)}
                effective={formatPercent(data.rates.combined.effective)}
              />
            </>
          )}
        </>
      )}

      <SectionHeader>AVERAGE MONTHLY</SectionHeader>
      <Separator />
      <Row label="Avg. gross monthly" amount={data.grossMonthly} />
      <Row label="Avg. net monthly (after tax)" amount={data.netMonthly} />

      <div className="flex justify-between py-1">
        <span className="flex items-center gap-1">
          Avg. {TIME_UNIT_LABELS[timeUnit].toLowerCase()} take-home
          {timeUnit === "hourly" && (
            <span
              className="text-[10px] text-(--color-text-muted) cursor-help"
              title="Based on 2,080 working hours per year (40 hrs x 52 weeks)"
            >
              ?
            </span>
          )}
        </span>
        <span className="tabular-nums slashed-zero">{formatTimeUnitValue(timeUnitValue, timeUnit)}</span>
      </div>

      <div className="flex gap-1 mt-1 mb-4">
        {(["daily", "hourly", "minute", "second"] as TimeUnit[]).map((unit) => (
          <button
            key={unit}
            onClick={() => setTimeUnit(unit)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-lg border",
              timeUnit === unit
                ? "border-(--color-text) bg-(--color-text) text-(--color-bg)"
                : "border-(--color-border) text-(--color-text-muted) hover:border-(--color-text-muted)",
            )}
          >
            {unit.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>

      <footer className="mt-12 pt-4 border-t border-(--color-border) text-(--color-text-muted) text-xs text-center">
        Summary for {yearRange}
      </footer>
    </div>
  );
}
