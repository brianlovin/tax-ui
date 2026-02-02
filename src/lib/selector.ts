import type { FormType, PageClassification } from "./classifier";

export interface PageSelection {
  selectedPages: number[];
  skippedPages: number[];
  reason: Map<number, string>;
}

// Priority tiers for page selection
const ESSENTIAL: FormType[] = ["1040_main", "state_main"];
const IMPORTANT: FormType[] = [
  "schedule_1",
  "schedule_a",
  "schedule_b",
  "schedule_c",
  "schedule_d",
  "schedule_e",
  "k1_summary",
];
const OPTIONAL: FormType[] = ["schedule_2", "schedule_3", "state_schedule"];
const SKIP: FormType[] = [
  "k1_detail",
  "worksheet",
  "supporting_doc",
  "cover_letter",
  "direct_deposit",
  "carryover_summary",
  "efiling_auth",
  "crypto_detail",
  "other",
];

// Target page count to stay under token limits (~40 pages max)
const MAX_SELECTED_PAGES = 40;

export function selectPages(classifications: PageClassification[]): PageSelection {
  const selectedPages: number[] = [];
  const skippedPages: number[] = [];
  const reason = new Map<number, string>();

  // Group pages by priority
  const essential: number[] = [];
  const important: number[] = [];
  const optional: number[] = [];
  const skip: number[] = [];

  for (const { pageNumber, formType } of classifications) {
    if (ESSENTIAL.includes(formType)) {
      essential.push(pageNumber);
      reason.set(pageNumber, `essential: ${formType}`);
    } else if (IMPORTANT.includes(formType)) {
      important.push(pageNumber);
      reason.set(pageNumber, `important: ${formType}`);
    } else if (OPTIONAL.includes(formType)) {
      optional.push(pageNumber);
      reason.set(pageNumber, `optional: ${formType}`);
    } else {
      skip.push(pageNumber);
      reason.set(pageNumber, `skip: ${formType}`);
    }
  }

  // Add pages in priority order until we hit the limit
  let remaining = MAX_SELECTED_PAGES;

  // Always include essential pages
  for (const page of essential) {
    if (remaining > 0) {
      selectedPages.push(page);
      remaining--;
    } else {
      skippedPages.push(page);
    }
  }

  // Add important pages if we have room
  for (const page of important) {
    if (remaining > 0) {
      selectedPages.push(page);
      remaining--;
    } else {
      skippedPages.push(page);
    }
  }

  // Add optional pages if we have room
  for (const page of optional) {
    if (remaining > 0) {
      selectedPages.push(page);
      remaining--;
    } else {
      skippedPages.push(page);
    }
  }

  // Skip pages are always skipped
  skippedPages.push(...skip);

  // Sort selected pages by page number for proper PDF ordering
  selectedPages.sort((a, b) => a - b);
  skippedPages.sort((a, b) => a - b);

  return { selectedPages, skippedPages, reason };
}
