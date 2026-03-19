import { z } from "zod";

import type { AustralianState } from "../data/postcodes";

const LabeledAmount = z.object({
  label: z.string(),
  amount: z.number(),
});

// Australian income items (from ATO tax return)
const IncomeItem = z.object({
  label: z.string(),
  amount: z.number(),
});

// Australian deductions (work-related, etc.)
const DeductionItem = z.object({
  label: z.string(),
  amount: z.number(),
});

// Australian tax offsets (not "credits" like US)
const TaxOffsetItem = z.object({
  label: z.string(),
  amount: z.number(),
});

// PAYG (Pay As You Go) withholding payments
const PAYGPayment = z.object({
  label: z.string(),
  amount: z.number(),
});

// Australian location information
const AustralianLocationSchema = z.object({
  postcode: z.string(),
  suburb: z.string(),
  state: z.string(),
});

// Australian tax rates (Medicare levy, etc.)
const AustralianTaxRates = z.object({
  federal: z.object({
    marginal: z.number(),
    effective: z.number(),
  }),
  medicare: z
    .object({
      rate: z.number(),
      amount: z.number(),
    })
    .optional(),
});

// Main Australian Tax Return schema
export const TaxReturnSchema = z.object({
  year: z.number(),
  name: z.string(),

  // Australian location
  location: AustralianLocationSchema,

  // Tax File Number indicator (not the actual TFN for privacy)
  hasTFN: z.boolean().optional(),

  // Australian residency status
  residencyStatus: z.enum(["resident", "foreign_resident", "working_holiday"]).optional(),

  // Assessable Income (Australian term)
  income: z.object({
    items: z.array(IncomeItem),
    total: z.number(),
  }),

  // Deductions
  deductions: z.object({
    items: z.array(DeductionItem),
    total: z.number(),
  }),

  // Taxable Income (Income - Deductions)
  taxableIncome: z.number(),

  // Australian tax calculation
  tax: z.object({
    // Income tax before offsets
    grossTax: z.number(),
    // Medicare Levy (typically 2% of taxable income)
    medicareLevy: z.number(),
    // Medicare Levy Surcharge (if applicable)
    medicareLevySurcharge: z.number().optional(),
    // HELP/HECS repayment (if applicable)
    helpRepayment: z.number().optional(),
    // Total tax before offsets
    totalTaxBeforeOffsets: z.number(),
    // Tax offsets (reduce tax payable)
    offsets: z.array(TaxOffsetItem),
    totalOffsets: z.number(),
    // Final tax payable
    taxPayable: z.number(),
  }),

  // PAYG Withholding (tax already paid)
  paygWithholding: z.object({
    items: z.array(PAYGPayment),
    total: z.number(),
  }),

  // Final result
  result: z.object({
    // Positive = refund, Negative = amount owing
    refundOrOwing: z.number(),
    // True if getting a refund
    isRefund: z.boolean(),
  }),

  // Tax rates information
  rates: AustralianTaxRates.optional(),

  // Additional Australian-specific fields
  privateHealthInsurance: z
    .object({
      hasCover: z.boolean(),
      rebate: z.number().optional(),
    })
    .optional(),

  // Spouse details (for offsets)
  spouse: z
    .object({
      hasSpouse: z.boolean(),
      taxableIncome: z.number().optional(),
    })
    .optional(),
});

export type TaxReturn = z.infer<typeof TaxReturnSchema>;
export type LabeledAmount = z.infer<typeof LabeledAmount>;
export type AustralianLocation = z.infer<typeof AustralianLocationSchema>;

// Helper type for creating Australian tax returns
export interface AustralianTaxReturnInput {
  year: number;
  name: string;
  location: {
    postcode: string;
    suburb: string;
    state: AustralianState;
  };
  income: Array<{ label: string; amount: number }>;
  deductions: Array<{ label: string; amount: number }>;
  offsets?: Array<{ label: string; amount: number }>;
  paygWithholding?: Array<{ label: string; amount: number }>;
}

export interface PendingUpload {
  id: string;
  filename: string;
  year: number | null;
  status: "extracting-year" | "parsing";
  file: File;
}

export interface FileProgress {
  id: string;
  filename: string;
  status: "pending" | "parsing" | "complete" | "error";
  year?: number;
  error?: string;
}

export interface FileWithId {
  id: string;
  file: File;
}

// ============================================
// UP BANK EXPENSE CATEGORIES
// ============================================

export const EXPENSE_CATEGORIES = {
  home: {
    id: "home",
    name: "Home",
    children: [
      { id: "groceries", name: "Groceries" },
      { id: "homeware-appliances", name: "Homeware & Appliances" },
      { id: "internet", name: "Internet" },
      { id: "maintenance-improvements", name: "Maintenance & Improvements" },
      { id: "pets", name: "Pets" },
      { id: "rates-insurance", name: "Rates & Insurance" },
      { id: "rent-mortgage", name: "Rent & Mortgage" },
      { id: "utilities", name: "Utilities" },
    ],
  },
  transport: {
    id: "transport",
    name: "Transport",
    children: [
      { id: "car-insurance-rego", name: "Car Insurance, Rego & Maintenance" },
      { id: "cycling", name: "Cycling" },
      { id: "fuel", name: "Fuel" },
      { id: "parking", name: "Parking" },
      { id: "public-transport", name: "Public Transport" },
      { id: "repayments", name: "Repayments" },
      { id: "taxis-share-cars", name: "Taxis & Share Cars" },
      { id: "tolls", name: "Tolls" },
    ],
  },
  goodlife: {
    id: "goodlife",
    name: "Good Life",
    children: [
      { id: "apps-games-software", name: "Apps, Games & Software" },
      { id: "booze", name: "Booze" },
      { id: "events-gigs", name: "Events & Gigs" },
      { id: "hobbies", name: "Hobbies" },
      { id: "holidays-travel", name: "Holidays & Travel" },
      { id: "lottery-gambling", name: "Lottery & Gambling" },
      { id: "pubs-bars", name: "Pubs & Bars" },
      { id: "restaurants-cafes", name: "Restaurants & Cafes" },
      { id: "takeaway", name: "Takeaway" },
      { id: "tobacco-vaping", name: "Tobacco & Vaping" },
      { id: "tv-music-streaming", name: "TV, Music & Streaming" },
      { id: "adult", name: "Adult" },
    ],
  },
  personal: {
    id: "personal",
    name: "Personal",
    children: [
      { id: "children-family", name: "Children & Family" },
      { id: "clothing-accessories", name: "Clothing & Accessories" },
      { id: "education-student-loans", name: "Education & Student Loans" },
      { id: "fitness-wellbeing", name: "Fitness & Wellbeing" },
      { id: "gifts-charity", name: "Gifts & Charity" },
      { id: "hair-beauty", name: "Hair & Beauty" },
      { id: "health-medical", name: "Health & Medical" },
      { id: "investments", name: "Investments" },
      { id: "life-admin", name: "Life Admin" },
      { id: "mobile-phone", name: "Mobile Phone" },
      { id: "news-magazines-books", name: "News, Magazines & Books" },
      { id: "technology", name: "Technology" },
    ],
  },
} as const;

export type ExpenseCategoryId =
  | (typeof EXPENSE_CATEGORIES.home.children)[number]["id"]
  | (typeof EXPENSE_CATEGORIES.transport.children)[number]["id"]
  | (typeof EXPENSE_CATEGORIES.goodlife.children)[number]["id"]
  | (typeof EXPENSE_CATEGORIES.personal.children)[number]["id"];

export type ExpenseCategoryParent = "home" | "transport" | "goodlife" | "personal";

// Helper to get parent category for a category id
export function getCategoryParent(categoryId: ExpenseCategoryId): ExpenseCategoryParent {
  for (const [parentKey, parent] of Object.entries(EXPENSE_CATEGORIES)) {
    if (parent.children.some((c) => c.id === categoryId)) {
      return parentKey as ExpenseCategoryParent;
    }
  }
  return "personal"; // default
}

// Helper to get category name by id
export function getCategoryName(categoryId: ExpenseCategoryId): string {
  for (const parent of Object.values(EXPENSE_CATEGORIES)) {
    const found = parent.children.find((c) => c.id === categoryId);
    if (found) return found.name;
  }
  return categoryId;
}

// ============================================
// EXPENSE ENTRIES
// ============================================

export const ExpenseEntrySchema = z.object({
  id: z.string(),
  // Year the expense occurred
  year: z.number(),
  // Month 1-12
  month: z.number().min(1).max(12),
  // Week 1-5 (for weekly breakdown)
  week: z.number().min(1).max(5).optional(),
  // Up Bank category ID
  category: z.string(),
  // Amount in dollars (positive for expense)
  amount: z.number(),
  // Optional description/notes
  description: z.string().optional(),
  // Created/updated timestamps
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ExpenseEntry = z.infer<typeof ExpenseEntrySchema>;

// Year-based expense data structure
export const YearExpensesSchema = z.object({
  year: z.number(),
  entries: z.array(ExpenseEntrySchema),
});

export type YearExpenses = z.infer<typeof YearExpensesSchema>;

// ============================================
// PAYSLIP
// ============================================

export const PayslipSchema = z.object({
  id: z.string(),
  // Period the payslip covers
  period: z.object({
    startDate: z.string(), // ISO date
    endDate: z.string(), // ISO date
    payDate: z.string(), // ISO date - when paid
  }),
  // Employer information
  employer: z.object({
    name: z.string(),
    abn: z.string().optional(), // Australian Business Number
  }),
  // Employee information
  employee: z.object({
    name: z.string(),
    employeeId: z.string().optional(),
  }),
  // Earnings breakdown
  earnings: z.array(
    z.object({
      description: z.string(), // e.g., "Base Salary", "Overtime", "Bonus"
      hours: z.number().optional(),
      rate: z.number().optional(),
      amount: z.number(),
    }),
  ),
  grossEarnings: z.number(), // Total before deductions
  // Deductions
  deductions: z.array(
    z.object({
      description: z.string(), // e.g., "PAYG Tax", "Superannuation"
      amount: z.number(),
    }),
  ),
  totalDeductions: z.number(),
  // Net pay
  netPay: z.number(),
  // Superannuation (if separate)
  superannuation: z
    .object({
      fund: z.string().optional(),
      memberNumber: z.string().optional(),
      employerContribution: z.number(),
      employeeContribution: z.number().optional(),
    })
    .optional(),
  // Year to date summary
  ytd: z
    .object({
      gross: z.number(),
      tax: z.number(),
      super: z.number().optional(),
      net: z.number(),
    })
    .optional(),
  // Source file
  sourceFile: z.string(), // Original filename
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Payslip = z.infer<typeof PayslipSchema>;

// ============================================
// BANK STATEMENT
// ============================================

export const BankTransactionSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO date or bank date format
  description: z.string(),
  amount: z.number(), // Negative for debits, positive for credits
  balance: z.number().optional(), // Running balance
  // Auto-categorized expense category (from Up Bank categories)
  category: z.string().optional(),
  // Detected transaction type
  type: z.enum(["debit", "credit"]),
});

export type BankTransaction = z.infer<typeof BankTransactionSchema>;

export const BankStatementSchema = z.object({
  id: z.string(),
  // Bank/Account information
  bank: z.object({
    name: z.string(), // e.g., "ANZ", "Commonwealth", "Up Bank"
    accountName: z.string().optional(),
    accountNumber: z.string().optional(), // Last 4 digits for privacy
  }),
  // Statement period
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  // Opening and closing balances
  openingBalance: z.number(),
  closingBalance: z.number(),
  // Transactions
  transactions: z.array(BankTransactionSchema),
  // Summary stats
  totalCredits: z.number(),
  totalDebits: z.number(),
  // Source file
  sourceFile: z.string(), // Original filename
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BankStatement = z.infer<typeof BankStatementSchema>;

// ============================================
// DOCUMENT TYPE
// ============================================

export const DocumentTypeSchema = z.enum(["tax-return", "payslip", "bank-statement"]);

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

// ============================================
// TRANSACTIONS
// ============================================

export const INCOME_CATEGORIES = {
  employment: {
    id: "employment",
    name: "Employment",
    children: [
      { id: "salary", name: "Salary" },
      { id: "bonus", name: "Bonus" },
      { id: "commission", name: "Commission" },
      { id: "overtime", name: "Overtime" },
      { id: "allowances", name: "Allowances" },
    ],
  },
  business: {
    id: "business",
    name: "Business",
    children: [
      { id: "business-income", name: "Business Income" },
      { id: "consulting", name: "Consulting" },
      { id: "freelance", name: "Freelance" },
    ],
  },
  investments: {
    id: "investments",
    name: "Investments",
    children: [
      { id: "dividends", name: "Dividends" },
      { id: "interest", name: "Interest" },
      { id: "capital-gains", name: "Capital Gains" },
      { id: "rental-income", name: "Rental Income" },
    ],
  },
  other: {
    id: "other",
    name: "Other",
    children: [
      { id: "government-benefits", name: "Government Benefits" },
      { id: "gifts", name: "Gifts" },
      { id: "refunds", name: "Refunds" },
      { id: "other-income", name: "Other Income" },
    ],
  },
} as const;

export type IncomeCategoryId =
  | (typeof INCOME_CATEGORIES.employment.children)[number]["id"]
  | (typeof INCOME_CATEGORIES.business.children)[number]["id"]
  | (typeof INCOME_CATEGORIES.investments.children)[number]["id"]
  | (typeof INCOME_CATEGORIES.other.children)[number]["id"];

export type IncomeCategoryParent = "employment" | "business" | "investments" | "other";

export function getIncomeCategoryParent(categoryId: IncomeCategoryId): IncomeCategoryParent {
  for (const [parentKey, parent] of Object.entries(INCOME_CATEGORIES)) {
    if (parent.children.some((c) => c.id === categoryId)) {
      return parentKey as IncomeCategoryParent;
    }
  }
  return "other"; // default
}

export function getIncomeCategoryName(categoryId: IncomeCategoryId): string {
  for (const parent of Object.values(INCOME_CATEGORIES)) {
    const found = parent.children.find((c) => c.id === categoryId);
    if (found) return found.name;
  }
  return categoryId;
}

export const TransactionSchema = z.object({
  id: z.string(),
  // Date of transaction
  date: z.string(), // ISO date YYYY-MM-DD
  // Amount in dollars (positive)
  amount: z.number(),
  // Category based on type
  category: z.string(),
  // Type: income or expense
  type: z.enum(["income", "expense"]),
  // Optional description/notes
  description: z.string().optional(),
  // Created/updated timestamps
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
