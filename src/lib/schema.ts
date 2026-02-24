import { z } from "zod";

const coerceNum = z.coerce.number();

const LabeledAmount = z.object({
  label: z.string(),
  amount: coerceNum,
});

const Dependent = z.object({
  name: z.string(),
  relationship: z.string().default(""),
});

const StateReturn = z.object({
  name: z.string(),
  agi: coerceNum.default(0),
  deductions: z.array(LabeledAmount).default([]),
  taxableIncome: coerceNum.default(0),
  tax: coerceNum.default(0),
  adjustments: z.array(LabeledAmount).default([]),
  payments: z.array(LabeledAmount).default([]),
  refundOrOwed: coerceNum.default(0),
});

const TaxRates = z.object({
  federal: z.object({ marginal: coerceNum, effective: coerceNum }),
  state: z.object({ marginal: coerceNum, effective: coerceNum }).optional(),
  combined: z.object({ marginal: coerceNum, effective: coerceNum }).optional(),
});

export const TaxReturnSchema = z.object({
  year: coerceNum,
  name: z.string().default(""),
  country: z.enum(["US", "CA"]).default("US"),
  filingStatus: z.string().default(""),
  dependents: z.array(Dependent).default([]),
  income: z.object({
    items: z.array(LabeledAmount).default([]),
    total: coerceNum.default(0),
  }),
  federal: z.object({
    agi: coerceNum.default(0),
    deductions: z.array(LabeledAmount).default([]),
    taxableIncome: coerceNum.default(0),
    tax: coerceNum.default(0),
    additionalTaxes: z.array(LabeledAmount).default([]),
    credits: z.array(LabeledAmount).default([]),
    payments: z.array(LabeledAmount).default([]),
    refundOrOwed: coerceNum.default(0),
  }),
  states: z.array(StateReturn).default([]),
  summary: z
    .object({
      federalAmount: coerceNum.default(0),
      stateAmounts: z.array(z.object({ state: z.string(), amount: coerceNum })).default([]),
      netPosition: coerceNum.default(0),
    })
    .default({ federalAmount: 0, stateAmounts: [], netPosition: 0 }),
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
