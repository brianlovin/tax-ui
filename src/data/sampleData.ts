import type { TaxReturn } from "../lib/schema";

// Canadian T1 sample — Ontario, 4 years
// Federal: 15% on first bracket + 20.5% on remainder; credits: BPA + CPP + EI
// Provincial: Ontario 5.05%/9.15%; Ontario Health Premium tiered by income
export const caReturns: Record<number, TaxReturn> = {
  2022: {
    year: 2022,
    name: "Alex Chen",
    country: "CA",
    filingStatus: "single",
    dependents: [],
    income: {
      items: [
        { label: "Employment income (T4)", amount: 72000 },
        { label: "Interest income (T5)", amount: 450 },
        { label: "− RRSP deduction", amount: -6000 },
      ],
      total: 66450,
    },
    federal: {
      agi: 66450,
      deductions: [],
      taxableIncome: 66450,
      tax: 10350,
      additionalTaxes: [],
      credits: [
        { label: "− Basic personal amount", amount: -2219 },
        { label: "− CPP contributions (Schedule 8)", amount: -456 },
        { label: "− EI premiums (Schedule 6)", amount: -132 },
      ],
      payments: [{ label: "− Income tax withheld (T4)", amount: -9800 }],
      refundOrOwed: -157,
    },
    states: [
      {
        name: "Ontario",
        agi: 66450,
        deductions: [],
        taxableIncome: 66450,
        tax: 4120,
        adjustments: [
          { label: "− Non-refundable credits", amount: -620 },
          { label: "Ontario Health Premium", amount: 300 },
        ],
        payments: [{ label: "− Provincial tax withheld (T4)", amount: -3900 }],
        refundOrOwed: -100,
      },
    ],
    summary: {
      federalAmount: -157,
      stateAmounts: [{ state: "Ontario", amount: -100 }],
      netPosition: -257,
    },
    rates: {
      federal: { marginal: 20.5, effective: 12.1 },
      state: { marginal: 9.15, effective: 5.9 },
      combined: { marginal: 29.65, effective: 18.0 },
    },
  },

  2023: {
    year: 2023,
    name: "Alex Chen",
    country: "CA",
    filingStatus: "single",
    dependents: [],
    income: {
      items: [
        { label: "Employment income (T4)", amount: 85000 },
        { label: "Interest income (T5)", amount: 680 },
        { label: "− RRSP deduction", amount: -10000 },
      ],
      total: 75680,
    },
    federal: {
      agi: 75680,
      deductions: [],
      taxableIncome: 75680,
      tax: 12580,
      additionalTaxes: [],
      credits: [
        { label: "− Basic personal amount", amount: -2305 },
        { label: "− CPP contributions (Schedule 8)", amount: -498 },
        { label: "− EI premiums (Schedule 6)", amount: -148 },
      ],
      payments: [{ label: "− Income tax withheld (T4)", amount: -11500 }],
      refundOrOwed: 129,
    },
    states: [
      {
        name: "Ontario",
        agi: 75680,
        deductions: [],
        taxableIncome: 75680,
        tax: 4980,
        adjustments: [
          { label: "− Non-refundable credits", amount: -732 },
          { label: "Ontario Health Premium", amount: 450 },
        ],
        payments: [{ label: "− Provincial tax withheld (T4)", amount: -4700 }],
        refundOrOwed: -50,
      },
    ],
    summary: {
      federalAmount: 129,
      stateAmounts: [{ state: "Ontario", amount: -50 }],
      netPosition: 79,
    },
    rates: {
      federal: { marginal: 20.5, effective: 13.0 },
      state: { marginal: 9.15, effective: 6.4 },
      combined: { marginal: 29.65, effective: 19.4 },
    },
  },

  2024: {
    year: 2024,
    name: "Alex Chen",
    country: "CA",
    filingStatus: "single",
    dependents: [],
    income: {
      items: [
        { label: "Employment income (T4)", amount: 95000 },
        { label: "Interest income (T5)", amount: 980 },
        { label: "− RRSP deduction", amount: -12500 },
      ],
      total: 83480,
    },
    federal: {
      agi: 83480,
      deductions: [],
      taxableIncome: 83480,
      tax: 14020,
      additionalTaxes: [],
      credits: [
        { label: "− Basic personal amount", amount: -2362 },
        { label: "− CPP contributions (Schedule 8)", amount: -542 },
        { label: "− EI premiums (Schedule 6)", amount: -156 },
      ],
      payments: [{ label: "− Income tax withheld (T4)", amount: -12500 }],
      refundOrOwed: 640,
    },
    states: [
      {
        name: "Ontario",
        agi: 83480,
        deductions: [],
        taxableIncome: 83480,
        tax: 5650,
        adjustments: [
          { label: "− Non-refundable credits", amount: -798 },
          { label: "Ontario Health Premium", amount: 600 },
        ],
        payments: [{ label: "− Provincial tax withheld (T4)", amount: -5200 }],
        refundOrOwed: -150,
      },
    ],
    summary: {
      federalAmount: 640,
      stateAmounts: [{ state: "Ontario", amount: -150 }],
      netPosition: 490,
    },
    rates: {
      federal: { marginal: 20.5, effective: 13.2 },
      state: { marginal: 9.15, effective: 6.5 },
      combined: { marginal: 29.65, effective: 19.7 },
    },
  },

  2025: {
    year: 2025,
    name: "Alex Chen",
    country: "CA",
    filingStatus: "single",
    dependents: [],
    income: {
      items: [
        { label: "Employment income (T4)", amount: 105000 },
        { label: "Interest income (T5)", amount: 1200 },
        { label: "− RRSP deduction", amount: -15000 },
      ],
      total: 91200,
    },
    federal: {
      agi: 91200,
      deductions: [],
      taxableIncome: 91200,
      tax: 15540,
      additionalTaxes: [],
      credits: [
        { label: "− Basic personal amount", amount: -2419 },
        { label: "− CPP contributions (Schedule 8)", amount: -585 },
        { label: "− EI premiums (Schedule 6)", amount: -165 },
      ],
      payments: [{ label: "− Income tax withheld (T4)", amount: -13500 }],
      refundOrOwed: 1129,
    },
    states: [
      {
        name: "Ontario",
        agi: 91200,
        deductions: [],
        taxableIncome: 91200,
        tax: 6235,
        adjustments: [
          { label: "− Non-refundable credits", amount: -852 },
          { label: "Ontario Health Premium", amount: 750 },
        ],
        payments: [{ label: "− Provincial tax withheld (T4)", amount: -5800 }],
        refundOrOwed: -333,
      },
    ],
    summary: {
      federalAmount: 1129,
      stateAmounts: [{ state: "Ontario", amount: -333 }],
      netPosition: 796,
    },
    rates: {
      federal: { marginal: 20.5, effective: 13.6 },
      state: { marginal: 9.15, effective: 6.7 },
      combined: { marginal: 29.65, effective: 20.3 },
    },
  },
};

// Sample data spanning 4 years for testing multi-year views
export const sampleReturns: Record<number, TaxReturn> = {
  2021: {
    year: 2021,
    name: "Jane Smith",
    country: "US",
    filingStatus: "single",
    dependents: [],
    income: {
      items: [
        { label: "Wages, salaries", amount: 78000 },
        { label: "Interest income", amount: 320 },
        { label: "Dividend income", amount: 1200 },
      ],
      total: 79520,
    },
    federal: {
      agi: 79520,
      deductions: [{ label: "− Standard deduction", amount: -12550 }],
      taxableIncome: 66970,
      tax: 10594,
      additionalTaxes: [],
      credits: [],
      payments: [{ label: "− Withheld", amount: -11800 }],
      refundOrOwed: 1206,
    },
    states: [
      {
        name: "California",
        agi: 79520,
        deductions: [{ label: "− Standard deduction", amount: -4803 }],
        taxableIncome: 74717,
        tax: 3680,
        adjustments: [],
        payments: [{ label: "− Withheld", amount: -3500 }],
        refundOrOwed: -180,
      },
    ],
    summary: {
      federalAmount: 1206,
      stateAmounts: [{ state: "California", amount: -180 }],
      netPosition: 1026,
    },
    rates: {
      federal: { marginal: 22, effective: 13.3 },
      state: { marginal: 9.3, effective: 4.6 },
      combined: { marginal: 31.3, effective: 17.9 },
    },
  },

  2022: {
    year: 2022,
    name: "Jane Smith",
    country: "US",
    filingStatus: "single",
    dependents: [],
    income: {
      items: [
        { label: "Wages, salaries", amount: 85000 },
        { label: "Interest income", amount: 480 },
        { label: "Dividend income", amount: 1800 },
        { label: "Capital gains", amount: 2400 },
      ],
      total: 89680,
    },
    federal: {
      agi: 89680,
      deductions: [{ label: "− Standard deduction", amount: -12950 }],
      taxableIncome: 76730,
      tax: 12460,
      additionalTaxes: [],
      credits: [],
      payments: [{ label: "− Withheld", amount: -14200 }],
      refundOrOwed: 1740,
    },
    states: [
      {
        name: "California",
        agi: 89680,
        deductions: [{ label: "− Standard deduction", amount: -5202 }],
        taxableIncome: 84478,
        tax: 4320,
        adjustments: [],
        payments: [{ label: "− Withheld", amount: -4100 }],
        refundOrOwed: -220,
      },
    ],
    summary: {
      federalAmount: 1740,
      stateAmounts: [{ state: "California", amount: -220 }],
      netPosition: 1520,
    },
    rates: {
      federal: { marginal: 22, effective: 13.9 },
      state: { marginal: 9.3, effective: 4.8 },
      combined: { marginal: 31.3, effective: 18.7 },
    },
  },

  2023: {
    year: 2023,
    name: "Jane Smith",
    country: "US",
    filingStatus: "single",
    dependents: [],
    income: {
      items: [
        { label: "Wages, salaries", amount: 92000 },
        { label: "Interest income", amount: 890 },
        { label: "Dividend income", amount: 2400 },
        { label: "Capital gains", amount: 1500 },
      ],
      total: 96790,
    },
    federal: {
      agi: 96790,
      deductions: [{ label: "− Standard deduction", amount: -13850 }],
      taxableIncome: 82940,
      tax: 13580,
      additionalTaxes: [],
      credits: [],
      payments: [{ label: "− Withheld", amount: -15800 }],
      refundOrOwed: 2220,
    },
    states: [
      {
        name: "California",
        agi: 96790,
        deductions: [{ label: "− Standard deduction", amount: -5363 }],
        taxableIncome: 91427,
        tax: 4890,
        adjustments: [],
        payments: [{ label: "− Withheld", amount: -4600 }],
        refundOrOwed: -290,
      },
    ],
    summary: {
      federalAmount: 2220,
      stateAmounts: [{ state: "California", amount: -290 }],
      netPosition: 1930,
    },
    rates: {
      federal: { marginal: 22, effective: 14.0 },
      state: { marginal: 9.3, effective: 5.1 },
      combined: { marginal: 31.3, effective: 19.1 },
    },
  },

  2024: {
    year: 2024,
    name: "Jane Smith",
    country: "US",
    filingStatus: "single",
    dependents: [],
    income: {
      items: [
        { label: "Wages, salaries", amount: 95000 },
        { label: "Dividend income", amount: 3200 },
        { label: "Interest income", amount: 450 },
        { label: "Capital gains", amount: 1800 },
      ],
      total: 100450,
    },
    federal: {
      agi: 100450,
      deductions: [{ label: "− Standard deduction", amount: -14600 }],
      taxableIncome: 85850,
      tax: 14260,
      additionalTaxes: [],
      credits: [],
      payments: [{ label: "− Withheld", amount: -16500 }],
      refundOrOwed: 2240,
    },
    states: [
      {
        name: "California",
        agi: 100450,
        deductions: [{ label: "− Standard deduction", amount: -5540 }],
        taxableIncome: 94910,
        tax: 5180,
        adjustments: [],
        payments: [{ label: "− Withheld", amount: -4800 }],
        refundOrOwed: -380,
      },
    ],
    summary: {
      federalAmount: 2240,
      stateAmounts: [{ state: "California", amount: -380 }],
      netPosition: 1860,
    },
    rates: {
      federal: { marginal: 22, effective: 14.2 },
      state: { marginal: 9.3, effective: 5.2 },
      combined: { marginal: 31.3, effective: 19.4 },
    },
  },
};
