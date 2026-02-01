import { useMemo, useState } from "react";
import type { TaxReturn } from "../lib/schema";
import { Tooltip } from "./Tooltip";
import { formatCompact } from "../lib/format";
import {
  getTotalTax,
  getNetIncome,
  getEffectiveRate,
} from "../lib/tax-calculations";
import {
  type TimeUnit,
  TIME_UNIT_LABELS,
  convertToTimeUnit,
  formatTimeUnitValueCompact,
} from "../lib/time-units";
import { Sparkline } from "./Sparkline";
import { Menu, MenuItem } from "./Menu";
import { InfoIcon } from "./InfoIcon";

interface Props {
  returns: Record<number, TaxReturn>;
}

export function SummaryStats({ returns }: Props) {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("daily");

  const years = useMemo(
    () =>
      Object.keys(returns)
        .map(Number)
        .sort((a, b) => a - b),
    [returns],
  );

  const stats = useMemo(() => {
    if (years.length === 0) return null;

    const allReturns = years
      .map((year) => returns[year])
      .filter((r): r is TaxReturn => r !== undefined);

    if (allReturns.length === 0) return null;

    // Sum across all years
    const totalIncome = allReturns.reduce((sum, r) => sum + r.income.total, 0);
    const totalTaxes = allReturns.reduce((sum, r) => sum + getTotalTax(r), 0);
    const netIncome = totalIncome - totalTaxes;
    const avgEffectiveRate =
      allReturns.reduce((sum, r) => sum + getEffectiveRate(r), 0) /
      allReturns.length;

    // Hourly rate (2,080 working hours per year: 40 hrs × 52 weeks)
    const hourlyRatesPerYear = allReturns.map((r) => getNetIncome(r) / 2080);
    const avgHourlyRate =
      hourlyRatesPerYear.reduce((sum, h) => sum + h, 0) /
      hourlyRatesPerYear.length;

    // Per-year values for sparklines
    const incomePerYear = allReturns.map((r) => r.income.total);
    const taxesPerYear = allReturns.map((r) => getTotalTax(r));
    const effectivePerYear = allReturns.map((r) => getEffectiveRate(r));
    const netPerYear = allReturns.map((r) => getNetIncome(r));

    return {
      income: { value: totalIncome, sparkline: incomePerYear },
      taxes: { value: totalTaxes, sparkline: taxesPerYear },
      effective: { value: avgEffectiveRate, sparkline: effectivePerYear },
      net: { value: netIncome, sparkline: netPerYear },
      avgHourlyRate,
      hourlyRatesPerYear,
    };
  }, [returns, years]);

  if (!stats) {
    return null;
  }

  const timeUnitValue = convertToTimeUnit(stats.avgHourlyRate, timeUnit);
  const timeUnitSparkline = stats.hourlyRatesPerYear.map((rate) =>
    convertToTimeUnit(rate, timeUnit),
  );

  return (
    <div className="px-6 py-6 shrink-0 border-b border-(--color-border)">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Income</div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight">
              {formatCompact(stats.income.value)}
            </span>
            <Sparkline
              values={stats.income.sparkline}
              width={48}
              height={20}
              className="text-(--color-chart)"
            />
          </div>
        </div>

        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Taxes</div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight">
              {formatCompact(stats.taxes.value)}
            </span>
            <Sparkline
              values={stats.taxes.sparkline}
              width={48}
              height={20}
              className="text-(--color-chart)"
            />
          </div>
        </div>

        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Net</div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight">
              {formatCompact(stats.net.value)}
            </span>
            <Sparkline
              values={stats.net.sparkline}
              width={48}
              height={20}
              className="text-(--color-chart)"
            />
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
            <span className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight">
              {formatTimeUnitValueCompact(timeUnitValue, timeUnit)}
            </span>
            <Sparkline
              values={timeUnitSparkline}
              width={48}
              height={20}
              className="text-(--color-chart)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
