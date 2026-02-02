import { formatCurrency, formatCurrencyCents, formatCompact } from "./format";

export type TimeUnit = "daily" | "hourly" | "minute" | "second";

export const TIME_UNIT_LABELS: Record<TimeUnit, string> = {
  daily: "Daily",
  hourly: "Hourly",
  minute: "Minute",
  second: "Second",
};

export const TIME_UNIT_SUFFIXES: Record<TimeUnit, string> = {
  daily: "d",
  hourly: "h",
  minute: "m",
  second: "s",
};

export function convertToTimeUnit(hourlyRate: number, unit: TimeUnit): number {
  switch (unit) {
    case "daily":
      return hourlyRate * 8;
    case "hourly":
      return hourlyRate;
    case "minute":
      return hourlyRate / 60;
    case "second":
      return hourlyRate / 3600;
  }
}

export function formatTimeUnitValue(amount: number, unit: TimeUnit): string {
  if (unit === "daily" || unit === "hourly") {
    return formatCurrency(Math.round(amount));
  }
  return formatCurrencyCents(amount, TIME_UNIT_SUFFIXES[unit]);
}

export function formatTimeUnitValueCompact(amount: number, unit: TimeUnit): string {
  if (unit === "daily" || unit === "hourly") {
    return `${formatCompact(Math.round(amount))}/${TIME_UNIT_SUFFIXES[unit]}`;
  }
  return formatCurrencyCents(amount, TIME_UNIT_SUFFIXES[unit]);
}
