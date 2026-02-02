import { useMemo, useState } from "react";
import type { TaxReturn } from "../lib/schema";
import { formatCompact } from "../lib/format";
import { getTotalTax, getNetIncome } from "../lib/tax-calculations";
import {
  type TimeUnit,
  TIME_UNIT_LABELS,
  convertToTimeUnit,
  formatTimeUnitValueCompact,
} from "../lib/time-units";
import { Sparkline } from "./Sparkline";
import { Menu, MenuItem } from "./Menu";
import { Tooltip } from "./Tooltip";
import { InfoIcon } from "./InfoIcon";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  returns: Record<number, TaxReturn>;
  selectedYear: "summary" | number;
}

export function StatsHeader({ returns, selectedYear }: Props) {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("daily");
  const isSummary = selectedYear === "summary";

  const years = useMemo(
    () =>
      Object.keys(returns)
        .map(Number)
        .sort((a, b) => a - b),
    [returns],
  );

  // Index of selected year in the sparkline (null for summary view)
  const activeIndex = useMemo(() => {
    if (isSummary) return null;
    const idx = years.indexOf(selectedYear as number);
    return idx >= 0 ? idx : null;
  }, [isSummary, years, selectedYear]);

  // Always compute sparklines from all years
  const sparklines = useMemo(() => {
    if (years.length < 2) return null;

    const allReturns = years
      .map((year) => returns[year])
      .filter((r): r is TaxReturn => r !== undefined);

    if (allReturns.length < 2) return null;

    const hourlyRatesPerYear = allReturns.map((r) => getNetIncome(r) / 2080);

    return {
      income: allReturns.map((r) => r.income.total),
      taxes: allReturns.map((r) => getTotalTax(r)),
      net: allReturns.map((r) => getNetIncome(r)),
      hourlyRates: hourlyRatesPerYear,
    };
  }, [returns, years]);

  // Compute max character widths for each stat to prevent layout shift
  const maxChars = useMemo(() => {
    const allReturns = years
      .map((year) => returns[year])
      .filter((r): r is TaxReturn => r !== undefined);

    if (allReturns.length === 0) return { income: 0, taxes: 0, net: 0, timeUnit: 0 };

    // Collect all possible values including summary totals
    const incomeValues = allReturns.map((r) => r.income.total);
    const taxValues = allReturns.map((r) => getTotalTax(r));
    const netValues = allReturns.map((r) => getNetIncome(r));
    const hourlyRates = allReturns.map((r) => getNetIncome(r) / 2080);

    // Add summary totals
    const totalIncome = incomeValues.reduce((a, b) => a + b, 0);
    const totalTaxes = taxValues.reduce((a, b) => a + b, 0);
    const totalNet = totalIncome - totalTaxes;
    const avgHourlyRate = hourlyRates.reduce((a, b) => a + b, 0) / hourlyRates.length;

    incomeValues.push(totalIncome);
    taxValues.push(totalTaxes);
    netValues.push(totalNet);
    hourlyRates.push(avgHourlyRate);

    // Find max formatted length for each stat
    const maxIncomeChars = Math.max(...incomeValues.map((v) => formatCompact(v).length));
    const maxTaxesChars = Math.max(...taxValues.map((v) => formatCompact(v).length));
    const maxNetChars = Math.max(...netValues.map((v) => formatCompact(v).length));

    // For time unit, only check the currently selected unit
    const timeUnitLengths = hourlyRates.map((rate) =>
      formatTimeUnitValueCompact(convertToTimeUnit(rate, timeUnit), timeUnit).length
    );
    const maxTimeUnitChars = Math.max(...timeUnitLengths);

    return {
      income: maxIncomeChars,
      taxes: maxTaxesChars,
      net: maxNetChars,
      timeUnit: maxTimeUnitChars,
    };
  }, [returns, years, timeUnit]);

  // Compute displayed values based on summary vs individual year
  const stats = useMemo(() => {
    if (isSummary) {
      if (years.length === 0) return null;

      const allReturns = years
        .map((year) => returns[year])
        .filter((r): r is TaxReturn => r !== undefined);

      if (allReturns.length === 0) return null;

      const totalIncome = allReturns.reduce(
        (sum, r) => sum + r.income.total,
        0,
      );
      const totalTaxes = allReturns.reduce((sum, r) => sum + getTotalTax(r), 0);
      const netIncome = totalIncome - totalTaxes;

      const hourlyRatesPerYear = allReturns.map((r) => getNetIncome(r) / 2080);
      const avgHourlyRate =
        hourlyRatesPerYear.reduce((sum, h) => sum + h, 0) /
        hourlyRatesPerYear.length;

      return {
        income: totalIncome,
        taxes: totalTaxes,
        net: netIncome,
        hourlyRate: avgHourlyRate,
      };
    } else {
      const yearData = returns[selectedYear];
      if (!yearData) return null;

      const income = yearData.income.total;
      const taxes = getTotalTax(yearData);
      const net = income - taxes;
      const hourlyRate = net / 2080;

      return {
        income,
        taxes,
        net,
        hourlyRate,
      };
    }
  }, [returns, years, selectedYear, isSummary]);

  if (!stats) {
    return null;
  }

  const timeUnitValue = convertToTimeUnit(stats.hourlyRate, timeUnit);
  const timeUnitSparkline = sparklines?.hourlyRates.map((rate) =>
    convertToTimeUnit(rate, timeUnit),
  );

  return (
    <div className="px-6 py-6 shrink-0 border-b border-(--color-border)">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="col-span-2 lg:col-span-1 flex items-center">
          <div className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight text-(--color-brand)">
            {isSummary ? "All time" : selectedYear}
          </div>
        </div>

        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Income</div>
          <div className="flex items-center gap-3">
            <AnimatedNumber
              value={stats.income}
              format={formatCompact}
              className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
              minChars={maxChars.income}
            />
            {sparklines && (
              <Sparkline
                values={sparklines.income}
                width={48}
                height={20}
                className="text-(--color-chart)"
                activeIndex={activeIndex}
              />
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Taxes</div>
          <div className="flex items-center gap-3">
            <AnimatedNumber
              value={stats.taxes}
              format={formatCompact}
              className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
              minChars={maxChars.taxes}
            />
            {sparklines && (
              <Sparkline
                values={sparklines.taxes}
                width={48}
                height={20}
                className="text-(--color-chart)"
                activeIndex={activeIndex}
              />
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Net</div>
          <div className="flex items-center gap-3">
            <AnimatedNumber
              value={stats.net}
              format={formatCompact}
              className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
              minChars={maxChars.net}
            />
            {sparklines && (
              <Sparkline
                values={sparklines.net}
                width={48}
                height={20}
                className="text-(--color-chart)"
                activeIndex={activeIndex}
              />
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Menu
              triggerVariant="inline"
              triggerClassName="text-xs"
              popupClassName="min-w-[130px] text-sm"
              sideOffset={6}
              trigger={
                <>
                  {TIME_UNIT_LABELS[timeUnit]}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="opacity-50"
                  >
                    <path
                      d="M4 6l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              }
            >
              {(["daily", "hourly", "minute", "second"] as TimeUnit[]).map(
                (unit) => (
                  <MenuItem
                    key={unit}
                    onClick={() => setTimeUnit(unit)}
                    selected={timeUnit === unit}
                  >
                    {TIME_UNIT_LABELS[unit]}
                  </MenuItem>
                ),
              )}
            </Menu>
            <Tooltip content="Based on 2080hrs of work per year" delay={0}>
              <InfoIcon size={16} className="opacity-60" />
            </Tooltip>
          </div>
          <div className="flex items-center gap-3">
            <AnimatedNumber
              value={timeUnitValue}
              format={(v) => formatTimeUnitValueCompact(v, timeUnit)}
              className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
              minChars={maxChars.timeUnit}
            />
            {timeUnitSparkline && (
              <Sparkline
                values={timeUnitSparkline}
                width={48}
                height={20}
                className="text-(--color-chart)"
                activeIndex={activeIndex}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
