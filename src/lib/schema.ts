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
