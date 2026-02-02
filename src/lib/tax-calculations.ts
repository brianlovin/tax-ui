import type { TaxReturn } from "./schema";

export function getTotalTax(data: TaxReturn): number {
  const federalBase = data.federal.tax;
  const federalAdditional = data.federal.additionalTaxes.reduce((sum, t) => sum + t.amount, 0);
  const stateTaxes = data.states.reduce((sum, s) => sum + s.tax, 0);
  return federalBase + federalAdditional + stateTaxes;
}

export function getNetIncome(data: TaxReturn): number {
  return data.income.total - getTotalTax(data);
}

export function getEffectiveRate(data: TaxReturn): number {
  if (data.rates?.combined?.effective) {
    return data.rates.combined.effective / 100;
  }
  return getTotalTax(data) / data.income.total;
}
