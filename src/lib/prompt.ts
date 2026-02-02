export const EXTRACTION_PROMPT = `Extract all tax data from this tax return PDF.

LABEL NORMALIZATION - Use these EXACT labels:

Income items:
- "W-2 wages" (for wages, salaries, tips)
- "Interest income"
- "Dividend income"
- "Qualified dividends"
- "Capital gains/losses"
- "IRA distributions"
- "Pension/annuity"
- "Social Security"
- "Business income"
- "Rental income"
- "K-1 income" (combined partnership, S-corp, estate/trust income from K-1s)
- "Farm income"
- "Unemployment compensation"
- "Gambling income"
- "Alimony received"
- "Royalty income"
- "Other income"

Federal deductions:
- "− Standard deduction" or "− Itemized deductions"
- "− Qualified business income deduction"
- "− SALT (capped)"
- "− Mortgage interest"
- "− Charitable contributions"
- "− Medical expenses"

Federal additional taxes (Schedule 2 - these are FEDERAL, not state):
- "Self-employment tax"
- "Additional Medicare tax"
- "Net investment income tax"
- "Alternative minimum tax"
- "Household employment tax"
- "Repayment of first-time homebuyer credit"

Federal payments:
- "Federal withholding"
- "Federal estimated payments"
- "Extension payment"
- "Other federal withholding"

State payments (use state-specific labels):
- "[State] withholding" (e.g., "NYS withholding", "CA withholding")
- "[City] withholding" (e.g., "NYC withholding")
- "Estimated payments"

RULES:
1. All amounts are numbers (no currency symbols)
2. For refundOrOwed: positive = refund, negative = owed
3. Calculate rates as percentages (22% = 22, not 0.22)
4. Effective rate = (tax / agi) * 100
5. Include all states found in the return
6. Use empty arrays and 0 for missing fields
7. IMPORTANT: Self-employment tax, Additional Medicare tax, Net investment income tax, and AMT are FEDERAL taxes from Schedule 2. Put them in federal.additionalTaxes, NOT in state adjustments.`;
