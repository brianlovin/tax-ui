// Patterns to extract tax year from filename
const YEAR_PATTERNS = [
  /(?:^|[_\-\s])(\d{4})(?:[_\-\s]|\.pdf$)/i, // 2023_tax.pdf, 2023-tax.pdf
  /(?:TY|FY)(\d{4})/i, // TY2023.pdf, FY2023.pdf
  /(\d{4})[-_](?:1040|tax|return)/i, // 2023-tax-return.pdf, 2023_1040.pdf
  /(?:1040|tax|return)[-_](\d{4})/i, // tax-return-2023.pdf
  /^(\d{4})\.pdf$/i, // 2023.pdf
];

// Valid tax year range
const MIN_YEAR = 1990;
const MAX_YEAR = new Date().getFullYear() + 1;

function isValidYear(year: number): boolean {
  return year >= MIN_YEAR && year <= MAX_YEAR;
}

export function extractYearFromFilename(filename: string): number | null {
  for (const pattern of YEAR_PATTERNS) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      const year = parseInt(match[1], 10);
      if (isValidYear(year)) {
        return year;
      }
    }
  }
  return null;
}
