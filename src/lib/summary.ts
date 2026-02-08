import type { TaxReturn } from "./schema";

export interface AggregatedSummary {
  years: number[];
  yearCount: number;
  incomeItems: Array<{ label: string; amount: number }>;
  totalIncome: number;
  avgAgi: number;
  avgTaxableIncome: number;
  federalDeductions: Array<{ label: string; amount: number }>;
  totalFederalTax: number;
  states: Array<{ name: string; tax: number }>;
  totalStateTax: number;
  totalTax: number;
  netIncome: number;
  totalFederalRefund: number;
  stateRefunds: Array<{ state: string; amount: number }>;
  totalNetPosition: number;
  rates: {
    federal: { marginal: number; effective: number };
    state: { marginal: number; effective: number } | null;
    combined: { marginal: number; effective: number } | null;
  } | null;
  grossMonthly: number;
  netMonthly: number;
  avgHourlyRate: number;
}

export function aggregateSummary(returns: Record<number, TaxReturn>): AggregatedSummary | null {
  const years = Object.keys(returns)
    .map(Number)
    .sort((a, b) => a - b);
  const allReturns = years
    .map((year) => returns[year])
    .filter((r): r is TaxReturn => r !== undefined);

  if (allReturns.length === 0) return null;

  // Aggregate income items
  const incomeItemsMap = new Map<string, number>();
  for (const r of allReturns) {
    for (const item of r.income.items) {
      incomeItemsMap.set(item.label, (incomeItemsMap.get(item.label) || 0) + item.amount);
    }
  }
  const incomeItems = Array.from(incomeItemsMap.entries()).map(([label, amount]) => ({
    label,
    amount,
  }));

  // Totals
  const totalIncome = allReturns.reduce((sum, r) => sum + r.income.total, 0);
  const totalFederalTax = allReturns.reduce((sum, r) => sum + r.federal.tax, 0);
  const totalStateTax = allReturns.reduce(
    (sum, r) => sum + r.states.reduce((s, st) => s + st.tax, 0),
    0,
  );
  const totalTax = totalFederalTax + totalStateTax;
  const netIncome = totalIncome - totalTax;

  // Aggregate federal deductions
  const federalDeductionsMap = new Map<string, number>();
  for (const r of allReturns) {
    for (const item of r.federal.deductions) {
      federalDeductionsMap.set(
        item.label,
        (federalDeductionsMap.get(item.label) || 0) + item.amount,
      );
    }
  }
  const federalDeductions = Array.from(federalDeductionsMap.entries()).map(([label, amount]) => ({
    label,
    amount,
  }));

  // Aggregate state info
  const stateMap = new Map<string, number>();
  for (const r of allReturns) {
    for (const s of r.states) {
      stateMap.set(s.name, (stateMap.get(s.name) || 0) + s.tax);
    }
  }
  const states = Array.from(stateMap.entries()).map(([name, tax]) => ({ name, tax }));

  // Averages
  const avgAgi = allReturns.reduce((sum, r) => sum + r.federal.agi, 0) / allReturns.length;
  const avgTaxableIncome =
    allReturns.reduce((sum, r) => sum + r.federal.taxableIncome, 0) / allReturns.length;

  // Net position totals
  const totalFederalRefund = allReturns.reduce((sum, r) => sum + r.summary.federalAmount, 0);
  const stateRefundsMap = new Map<string, number>();
  for (const r of allReturns) {
    for (const s of r.summary.stateAmounts) {
      stateRefundsMap.set(s.state, (stateRefundsMap.get(s.state) || 0) + s.amount);
    }
  }
  const stateRefunds = Array.from(stateRefundsMap.entries()).map(([state, amount]) => ({
    state,
    amount,
  }));
  const totalNetPosition = allReturns.reduce((sum, r) => sum + r.summary.netPosition, 0);

  // Average rates
  const returnsWithRates = allReturns.filter((r) => r.rates);
  let rates: AggregatedSummary["rates"] = null;
  if (returnsWithRates.length > 0) {
    const avgFederalMarginal =
      returnsWithRates.reduce((sum, r) => sum + (r.rates?.federal.marginal || 0), 0) /
      returnsWithRates.length;
    const avgFederalEffective =
      returnsWithRates.reduce((sum, r) => sum + (r.rates?.federal.effective || 0), 0) /
      returnsWithRates.length;

    const returnsWithStateRates = allReturns.filter((r) => r.rates?.state);
    const stateRates =
      returnsWithStateRates.length > 0
        ? {
            marginal:
              returnsWithStateRates.reduce((sum, r) => sum + (r.rates?.state?.marginal || 0), 0) /
              returnsWithStateRates.length,
            effective:
              returnsWithStateRates.reduce((sum, r) => sum + (r.rates?.state?.effective || 0), 0) /
              returnsWithStateRates.length,
          }
        : null;

    const returnsWithCombinedRates = allReturns.filter((r) => r.rates?.combined);
    const combinedRates =
      returnsWithCombinedRates.length > 0
        ? {
            marginal:
              returnsWithCombinedRates.reduce(
                (sum, r) => sum + (r.rates?.combined?.marginal || 0),
                0,
              ) / returnsWithCombinedRates.length,
            effective:
              returnsWithCombinedRates.reduce(
                (sum, r) => sum + (r.rates?.combined?.effective || 0),
                0,
              ) / returnsWithCombinedRates.length,
          }
        : null;

    rates = {
      federal: { marginal: avgFederalMarginal, effective: avgFederalEffective },
      state: stateRates,
      combined: combinedRates,
    };
  }

  // Monthly and hourly
  const grossMonthly = Math.round(totalIncome / 12 / allReturns.length);
  const netMonthly = Math.round(netIncome / 12 / allReturns.length);
  const avgHourlyRate = netIncome / allReturns.length / 2080;

  return {
    years,
    yearCount: allReturns.length,
    incomeItems,
    totalIncome,
    avgAgi,
    avgTaxableIncome,
    federalDeductions,
    totalFederalTax,
    states,
    totalStateTax,
    totalTax,
    netIncome,
    totalFederalRefund,
    stateRefunds,
    totalNetPosition,
    rates,
    grossMonthly,
    netMonthly,
    avgHourlyRate,
  };
}
