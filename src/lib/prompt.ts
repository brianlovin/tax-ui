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

CANADIAN T1 RETURN LABEL NORMALIZATION - Use these EXACT labels when processing a T1 return:

Income items (CA):
- "Employment income" (T4 Box 14, Line 10100)
- "Other employment income" (Line 10400)
- "OAS pension" (Line 11300)
- "CPP/QPP benefits" (Lines 11400/11410)
- "EI benefits" (Line 11900)
- "Pension income" (T4A, Line 11500)
- "RRSP income" (Line 12900)
- "Interest income"
- "Dividend income"
- "Capital gains"
- "Rental income"
- "Self-employment income" (T2125 net income)
- "Other income"

Federal deductions (CA — from total income to net income, Line 23600):
- "− RRSP deduction" (Line 20800)
- "− Union/professional dues" (Line 21200)
- "− Child care expenses" (Line 21400)
- "− Moving expenses" (Line 21900)
- "− Employment expenses" (Line 22900)
- "− Other deductions" (Line 23200)

Federal additional taxes (CA):
- "CPP contributions on self-employment" (Schedule 8)
- "EI premiums on self-employment"

Federal payments (CA):
- "Federal income tax withheld" (T4 Box 22)
- "Federal installment payments"

Provincial payments (CA — use province-specific labels):
- "[Province] income tax withheld" (e.g., "Ontario income tax withheld")
- "[Province] installment payments"

RULES:
1. All amounts are numbers (no currency symbols)
2. For refundOrOwed: positive = refund, negative = owed
3. Calculate rates as percentages (22% = 22, not 0.22)
4. Effective rate = (tax / agi) * 100
5. Include all states found in the return
6. Use empty arrays and 0 for missing fields
7. IMPORTANT: Self-employment tax, Additional Medicare tax, Net investment income tax, and AMT are FEDERAL taxes from Schedule 2. Put them in federal.additionalTaxes, NOT in state adjustments.
8. For Canadian T1 returns: set country = "CA". For US Form 1040 returns: set country = "US".
9. For Canadian T1 returns: agi = Line 23600 (Net income); taxableIncome = Line 26000 (Taxable income after additional federal deductions from net income).
10. For Canadian T1 returns: federal.tax = Line 40400 (Net federal tax after credits). federal.refundOrOwed: use Line 48400 as positive refund or Line 48500 as negative balance owing.
11. For Canadian T1 returns: extract filingStatus as-is from the marital status field (e.g., "single", "married or common-law", "widowed", "divorced", "separated").`;
