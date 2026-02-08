import { describe, expect, test } from "bun:test";

import { formatCurrency, formatPercent, formatPercentChange } from "./format";

describe("formatCurrency", () => {
  test("formats positive amounts", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  test("formats negative amounts", () => {
    expect(formatCurrency(-500)).toBe("-$500");
  });

  test("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  test("shows sign when requested", () => {
    expect(formatCurrency(100, true)).toBe("+$100");
    expect(formatCurrency(-100, true)).toBe("-$100");
    expect(formatCurrency(0, true)).toBe("+$0");
  });
});

describe("formatPercent", () => {
  test("formats percentages with one decimal", () => {
    expect(formatPercent(22)).toBe("22.0%");
    expect(formatPercent(22.5)).toBe("22.5%");
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("formatPercentChange", () => {
  test("formats positive changes with plus sign", () => {
    expect(formatPercentChange(110, 100)).toBe("+10.0%");
    expect(formatPercentChange(200, 100)).toBe("+100.0%");
  });

  test("formats negative changes with minus sign", () => {
    expect(formatPercentChange(90, 100)).toBe("-10.0%");
    expect(formatPercentChange(50, 100)).toBe("-50.0%");
  });

  test("handles zero change", () => {
    expect(formatPercentChange(100, 100)).toBe("+0.0%");
  });

  test("handles negative base values", () => {
    // -100 to -50 is an increase (less negative)
    expect(formatPercentChange(-50, -100)).toBe("+50.0%");
    // -100 to -150 is a decrease (more negative)
    expect(formatPercentChange(-150, -100)).toBe("-50.0%");
  });
});
