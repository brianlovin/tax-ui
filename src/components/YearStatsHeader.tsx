import { useState, useMemo } from "react";
import type { TaxReturn } from "../lib/schema";
import { formatCompact } from "../lib/format";
import { getTotalTax } from "../lib/tax-calculations";
import {
  type TimeUnit,
  TIME_UNIT_LABELS,
  convertToTimeUnit,
  formatTimeUnitValueCompact,
} from "../lib/time-units";
import { Menu, MenuItem } from "./Menu";
import { Tooltip } from "./Tooltip";
import { InfoIcon } from "./InfoIcon";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  returns: Record<number, TaxReturn>;
  selectedYear: number;
}

export function YearStatsHeader({ returns, selectedYear }: Props) {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("daily");

  const stats = useMemo(() => {
    const yearData = returns[selectedYear];
    if (!yearData) return null;

    const income = yearData.income.total;
    const taxes = getTotalTax(yearData);
    const net = income - taxes;
    const hourlyRate = net / 2080;

    return { income, taxes, net, hourlyRate };
  }, [returns, selectedYear]);

  if (!stats) {
    return null;
  }

  const timeUnitValue = convertToTimeUnit(stats.hourlyRate, timeUnit);

  return (
    <div className="px-6 py-6 shrink-0 border-b border-(--color-border)">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Income</div>
          <AnimatedNumber
            value={stats.income}
            format={formatCompact}
            className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
          />
        </div>

        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Taxes</div>
          <AnimatedNumber
            value={stats.taxes}
            format={formatCompact}
            className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
          />
        </div>

        <div>
          <div className="text-xs text-(--color-text-muted) mb-1">Net</div>
          <AnimatedNumber
            value={stats.net}
            format={formatCompact}
            className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
          />
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
              {(["daily", "hourly", "minute", "second"] as TimeUnit[]).map((unit) => (
                <MenuItem
                  key={unit}
                  onClick={() => setTimeUnit(unit)}
                  selected={timeUnit === unit}
                >
                  {TIME_UNIT_LABELS[unit]}
                </MenuItem>
              ))}
            </Menu>
            <Tooltip content="Based on 2080hrs of work per year" delay={0}>
              <InfoIcon size={16} className="opacity-60" />
            </Tooltip>
          </div>
          <AnimatedNumber
            value={timeUnitValue}
            format={(v) => formatTimeUnitValueCompact(v, timeUnit)}
            className="text-2xl font-semibold tabular-nums slashed-zero tracking-tight"
          />
        </div>
      </div>
    </div>
  );
}
