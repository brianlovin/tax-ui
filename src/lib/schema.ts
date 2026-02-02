import { z } from "zod";

const LabeledAmount = z.object({
  label: z.string(),
  amount: z.number(),
});

const Dependent = z.object({
  name: z.string(),
  relationship: z.string(),
});

const StateReturn = z.object({
  name: z.string(),
  agi: z.number(),
  deductions: z.array(LabeledAmount),
  taxableIncome: z.number(),
  tax: z.number(),
  adjustments: z.array(LabeledAmount),
  payments: z.array(LabeledAmount),
  refundOrOwed: z.number(),
});

const TaxRates = z.object({
  federal: z.object({ marginal: z.number(), effective: z.number() }),
  state: z.object({ marginal: z.number(), effective: z.number() }).optional(),
  combined: z.object({ marginal: z.number(), effective: z.number() }).optional(),
});

export const TaxReturnSchema = z.object({
  year: z.number(),
  name: z.string(),
  filingStatus: z.enum([
    "single",
    "married_filing_jointly",
    "married_filing_separately",
    "head_of_household",
    "qualifying_surviving_spouse",
  ]),
  dependents: z.array(Dependent),
  income: z.object({
    items: z.array(LabeledAmount),
    total: z.number(),
  }),
  federal: z.object({
    agi: z.number(),
    deductions: z.array(LabeledAmount),
    taxableIncome: z.number(),
    tax: z.number(),
    additionalTaxes: z.array(LabeledAmount),
    credits: z.array(LabeledAmount),
    payments: z.array(LabeledAmount),
    refundOrOwed: z.number(),
  }),
  states: z.array(StateReturn),
  summary: z.object({
    federalAmount: z.number(),
    stateAmounts: z.array(z.object({ state: z.string(), amount: z.number() })),
    netPosition: z.number(),
  }),
  rates: TaxRates.optional(),
});

export type TaxReturn = z.infer<typeof TaxReturnSchema>;
export type LabeledAmount = z.infer<typeof LabeledAmount>;

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
