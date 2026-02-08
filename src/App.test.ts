import { describe, expect, test } from "bun:test";

import type { TaxReturn } from "./lib/schema";

// Extract and test the pure functions from App.tsx
// These are duplicated here for testing since they're not exported

type SelectedView = "summary" | "demo" | number;

function getDefaultSelection(returns: Record<number, TaxReturn>): SelectedView {
  const years = Object.keys(returns)
    .map(Number)
    .sort((a, b) => a - b);
  if (years.length === 0) return "demo";
  if (years.length === 1) return years[0] ?? "demo";
  return "summary";
}

function buildSidebarItems(returns: Record<number, TaxReturn>): { id: string; label: string }[] {
  const years = Object.keys(returns)
    .map(Number)
    .sort((a, b) => a - b);

  if (years.length === 0) {
    return [{ id: "demo", label: "Demo" }];
  }

  if (years.length === 1) {
    return years.map((y) => ({ id: String(y), label: String(y) }));
  }

  return [
    { id: "summary", label: "Summary" },
    ...years.map((y) => ({ id: String(y), label: String(y) })),
  ];
}

const mockReturn = { year: 2023 } as TaxReturn;

describe("getDefaultSelection", () => {
  test("returns demo when no returns exist", () => {
    expect(getDefaultSelection({})).toBe("demo");
  });

  test("returns the year when exactly one return exists", () => {
    expect(getDefaultSelection({ 2023: mockReturn })).toBe(2023);
  });

  test("returns summary when multiple returns exist", () => {
    expect(
      getDefaultSelection({
        2022: { ...mockReturn, year: 2022 },
        2023: mockReturn,
      }),
    ).toBe("summary");

    expect(
      getDefaultSelection({
        2021: { ...mockReturn, year: 2021 },
        2022: { ...mockReturn, year: 2022 },
        2023: mockReturn,
      }),
    ).toBe("summary");
  });
});

describe("buildSidebarItems", () => {
  test("shows only Demo when no returns exist", () => {
    expect(buildSidebarItems({})).toEqual([{ id: "demo", label: "Demo" }]);
  });

  test("shows only the year when exactly one return exists", () => {
    expect(buildSidebarItems({ 2023: mockReturn })).toEqual([{ id: "2023", label: "2023" }]);
  });

  test("shows Summary + years when multiple returns exist", () => {
    expect(
      buildSidebarItems({
        2022: { ...mockReturn, year: 2022 },
        2023: mockReturn,
      }),
    ).toEqual([
      { id: "summary", label: "Summary" },
      { id: "2022", label: "2022" },
      { id: "2023", label: "2023" },
    ]);
  });

  test("sorts years in ascending order", () => {
    const items = buildSidebarItems({
      2023: mockReturn,
      2021: { ...mockReturn, year: 2021 },
      2022: { ...mockReturn, year: 2022 },
    });

    expect(items.map((i) => i.id)).toEqual(["summary", "2021", "2022", "2023"]);
  });
});
