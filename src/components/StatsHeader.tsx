import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
  showingSampleData?: boolean;
  onOpenStart?: () => void;
}

export function StatsHeader({
  returns,
  selectedYear,
  showingSampleData,
  onOpenStart,
}: Props) {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("daily");
  const isSummary = selectedYear === "summary";

  const years = useMemo(
    () =>
      Object.keys(returns)
        .map(Number)
        .sort((a, b) => a - b),
    [returns]
  );

  const stats = useMemo(() => {
    if (isSummary) {
      if (years.length === 0) return null;

      const allReturns = years
        .map((year) => returns[year])
        .filter((r): r is TaxReturn => r !== undefined);

      if (allReturns.length === 0) return null;

      const totalIncome = allReturns.reduce(
        (sum, r) => sum + r.income.total,
        0
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
        sparklines: {
          income: allReturns.map((r) => r.income.total),
          taxes: allReturns.map((r) => getTotalTax(r)),
          net: allReturns.map((r) => getNetIncome(r)),
          hourlyRates: hourlyRatesPerYear,
        },
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
        sparklines: null,
      };
    }
  }, [returns, years, selectedYear, isSummary]);

  if (!stats) {
    return null;
  }

  const timeUnitValue = convertToTimeUnit(stats.hourlyRate, timeUnit);
  const timeUnitSparkline = stats.sparklines?.hourlyRates.map((rate) =>
    convertToTimeUnit(rate, timeUnit)
  );

  return (
    <div className="px-6 py-6 shrink-0 border-b border-(--color-border)">
      {showingSampleData && (
        <div className="mb-4 flex">
          <button
            onClick={onOpenStart}
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors cursor-pointer"
          >
            Sample data
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Income</div>
          <div className="flex items-center gap-3">
            <AnimatedNumber
              value={stats.income}
              format={formatCompact}
              className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
            />
            <AnimatePresence>
              {stats.sparklines && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 48 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sparkline
                    values={stats.sparklines.income}
                    width={48}
                    height={20}
                    className="text-(--color-chart)"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Taxes</div>
          <div className="flex items-center gap-3">
            <AnimatedNumber
              value={stats.taxes}
              format={formatCompact}
              className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
            />
            <AnimatePresence>
              {stats.sparklines && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 48 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sparkline
                    values={stats.sparklines.taxes}
                    width={48}
                    height={20}
                    className="text-(--color-chart)"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Net</div>
          <div className="flex items-center gap-3">
            <AnimatedNumber
              value={stats.net}
              format={formatCompact}
              className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
            />
            <AnimatePresence>
              {stats.sparklines && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 48 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sparkline
                    values={stats.sparklines.net}
                    width={48}
                    height={20}
                    className="text-(--color-chart)"
                  />
                </motion.div>
              )}
            </AnimatePresence>
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
                )
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
            />
            <AnimatePresence>
              {timeUnitSparkline && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 48 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sparkline
                    values={timeUnitSparkline}
                    width={48}
                    height={20}
                    className="text-(--color-chart)"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
