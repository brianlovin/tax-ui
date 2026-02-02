import { describe, expect, test } from "bun:test";

import type { TaxReturn } from "./schema";
import { getEffectiveRate, getNetIncome, getTotalTax } from "./tax-calculations";

const baseTaxReturn: TaxReturn = {
  year: 2024,
  name: "Test User",
  filingStatus: "single",
  dependents: [],
  income: {
    items: [{ label: "Wages", amount: 100000 }],
    total: 100000,
  },
  federal: {
    agi: 100000,
    deductions: [{ label: "Standard deduction", amount: -14600 }],
    taxableIncome: 85400,
    tax: 14000,
    additionalTaxes: [],
    credits: [],
    payments: [{ label: "Withheld", amount: -15000 }],
    refundOrOwed: 1000,
  },
  states: [
    {
      name: "California",
      agi: 100000,
      deductions: [{ label: "Standard deduction", amount: -5000 }],
      taxableIncome: 95000,
      tax: 5000,
      adjustments: [],
      payments: [{ label: "Withheld", amount: -4500 }],
      refundOrOwed: -500,
    },
  ],
  summary: {
    federalAmount: 1000,
    stateAmounts: [{ state: "California", amount: -500 }],
    netPosition: 500,
  },
};

describe("getTotalTax", () => {
  test("sums federal and state taxes", () => {
    expect(getTotalTax(baseTaxReturn)).toBe(19000); // 14000 + 5000
  });

  test("handles multiple states", () => {
    const multiState: TaxReturn = {
      ...baseTaxReturn,
      states: [
        { ...baseTaxReturn.states[0]!, tax: 3000 },
        {
          name: "New York",
          agi: 100000,
          deductions: [],
          taxableIncome: 100000,
          tax: 4000,
          adjustments: [],
          payments: [],
          refundOrOwed: -4000,
        },
      ],
    };
    expect(getTotalTax(multiState)).toBe(21000); // 14000 + 3000 + 4000
  });

  test("handles no state taxes", () => {
    const noState: TaxReturn = {
      ...baseTaxReturn,
      states: [],
    };
    expect(getTotalTax(noState)).toBe(14000);
  });
});

describe("getNetIncome", () => {
  test("subtracts total tax from total income", () => {
    expect(getNetIncome(baseTaxReturn)).toBe(81000); // 100000 - 19000
  });

  test("handles zero tax", () => {
    const zeroTax: TaxReturn = {
      ...baseTaxReturn,
      federal: { ...baseTaxReturn.federal, tax: 0 },
      states: [],
    };
    expect(getNetIncome(zeroTax)).toBe(100000);
  });
});

describe("getEffectiveRate", () => {
  test("uses combined rate when available", () => {
    const withRates: TaxReturn = {
      ...baseTaxReturn,
      rates: {
        federal: { marginal: 22, effective: 14 },
        state: { marginal: 9.3, effective: 5 },
        combined: { marginal: 31.3, effective: 19 },
      },
    };
    expect(getEffectiveRate(withRates)).toBe(0.19); // 19% as decimal
  });

  test("calculates from tax/income when no rates provided", () => {
    // 19000 / 100000 = 0.19
    expect(getEffectiveRate(baseTaxReturn)).toBe(0.19);
  });

  test("handles rates without combined", () => {
    const partialRates: TaxReturn = {
      ...baseTaxReturn,
      rates: {
        federal: { marginal: 22, effective: 14 },
      },
    };
    // Falls back to calculation: 19000 / 100000 = 0.19
    expect(getEffectiveRate(partialRates)).toBe(0.19);
  });
});
