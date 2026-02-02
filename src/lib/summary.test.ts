import { describe, expect, test } from "bun:test";

import type { TaxReturn } from "./schema";
import { aggregateSummary } from "./summary";

const makeReturn = (
  year: number,
  income: number,
  federalTax: number,
  stateTax: number,
): TaxReturn => ({
  year,
  name: "Test User",
  filingStatus: "single",
  dependents: [],
  income: {
    items: [{ label: "Wages", amount: income }],
    total: income,
  },
  federal: {
    agi: income,
    deductions: [{ label: "Standard deduction", amount: -14600 }],
    taxableIncome: income - 14600,
    tax: federalTax,
    additionalTaxes: [],
    credits: [],
    payments: [{ label: "Withheld", amount: -(federalTax + 1000) }],
    refundOrOwed: 1000,
  },
  states: [
    {
      name: "California",
      agi: income,
      deductions: [{ label: "Standard deduction", amount: -5000 }],
      taxableIncome: income - 5000,
      tax: stateTax,
      adjustments: [],
      payments: [{ label: "Withheld", amount: -stateTax }],
      refundOrOwed: 0,
    },
  ],
  summary: {
    federalAmount: 1000,
    stateAmounts: [{ state: "California", amount: 0 }],
    netPosition: 1000,
  },
  rates: {
    federal: { marginal: 22, effective: 14 },
    state: { marginal: 9.3, effective: 5 },
    combined: { marginal: 31.3, effective: 19 },
  },
});

describe("aggregateSummary", () => {
  test("returns null for empty returns", () => {
    expect(aggregateSummary({})).toBeNull();
  });

  test("aggregates single year correctly", () => {
    const returns = { 2024: makeReturn(2024, 100000, 14000, 5000) };
    const result = aggregateSummary(returns);

    expect(result).not.toBeNull();
    expect(result!.years).toEqual([2024]);
    expect(result!.yearCount).toBe(1);
    expect(result!.totalIncome).toBe(100000);
    expect(result!.totalFederalTax).toBe(14000);
    expect(result!.totalStateTax).toBe(5000);
    expect(result!.totalTax).toBe(19000);
    expect(result!.netIncome).toBe(81000);
  });

  test("aggregates multiple years correctly", () => {
    const returns = {
      2023: makeReturn(2023, 90000, 12000, 4000),
      2024: makeReturn(2024, 100000, 14000, 5000),
    };
    const result = aggregateSummary(returns);

    expect(result).not.toBeNull();
    expect(result!.years).toEqual([2023, 2024]);
    expect(result!.yearCount).toBe(2);
    expect(result!.totalIncome).toBe(190000);
    expect(result!.totalFederalTax).toBe(26000);
    expect(result!.totalStateTax).toBe(9000);
    expect(result!.totalTax).toBe(35000);
    expect(result!.netIncome).toBe(155000);
  });

  test("calculates averages correctly", () => {
    const returns = {
      2023: makeReturn(2023, 80000, 10000, 4000),
      2024: makeReturn(2024, 100000, 14000, 5000),
    };
    const result = aggregateSummary(returns);

    expect(result).not.toBeNull();
    expect(result!.avgAgi).toBe(90000); // (80000 + 100000) / 2
  });

  test("aggregates income items by label", () => {
    const return1 = makeReturn(2023, 90000, 12000, 4000);
    return1.income.items = [
      { label: "Wages", amount: 85000 },
      { label: "Interest", amount: 5000 },
    ];

    const return2 = makeReturn(2024, 100000, 14000, 5000);
    return2.income.items = [
      { label: "Wages", amount: 95000 },
      { label: "Interest", amount: 3000 },
      { label: "Dividends", amount: 2000 },
    ];

    const returns = { 2023: return1, 2024: return2 };
    const result = aggregateSummary(returns);

    expect(result).not.toBeNull();
    const wages = result!.incomeItems.find((i) => i.label === "Wages");
    const interest = result!.incomeItems.find((i) => i.label === "Interest");
    const dividends = result!.incomeItems.find((i) => i.label === "Dividends");

    expect(wages?.amount).toBe(180000);
    expect(interest?.amount).toBe(8000);
    expect(dividends?.amount).toBe(2000);
  });

  test("calculates average hourly rate", () => {
    const returns = { 2024: makeReturn(2024, 104000, 14000, 6000) };
    const result = aggregateSummary(returns);

    // Net income: 104000 - 20000 = 84000
    // Hourly: 84000 / 2080 ≈ 40.38
    expect(result).not.toBeNull();
    expect(result!.avgHourlyRate).toBeCloseTo(40.38, 1);
  });

  test("sorts years ascending", () => {
    const returns = {
      2024: makeReturn(2024, 100000, 14000, 5000),
      2022: makeReturn(2022, 80000, 10000, 4000),
      2023: makeReturn(2023, 90000, 12000, 4500),
    };
    const result = aggregateSummary(returns);

    expect(result!.years).toEqual([2022, 2023, 2024]);
  });

  test("handles returns without rates", () => {
    const returnWithoutRates = makeReturn(2024, 100000, 14000, 5000);
    delete (returnWithoutRates as Partial<TaxReturn>).rates;

    const returns = { 2024: returnWithoutRates };
    const result = aggregateSummary(returns);

    expect(result).not.toBeNull();
    expect(result!.rates).toBeNull();
  });

  test("averages rates across years", () => {
    const return1 = makeReturn(2023, 90000, 12000, 4000);
    return1.rates = {
      federal: { marginal: 22, effective: 13 },
      state: { marginal: 9.3, effective: 4.4 },
      combined: { marginal: 31.3, effective: 17.4 },
    };

    const return2 = makeReturn(2024, 100000, 14000, 5000);
    return2.rates = {
      federal: { marginal: 22, effective: 14 },
      state: { marginal: 9.3, effective: 5 },
      combined: { marginal: 31.3, effective: 19 },
    };

    const returns = { 2023: return1, 2024: return2 };
    const result = aggregateSummary(returns);

    expect(result).not.toBeNull();
    expect(result!.rates!.federal.effective).toBe(13.5); // (13 + 14) / 2
    expect(result!.rates!.combined!.effective).toBe(18.2); // (17.4 + 19) / 2
  });
});
