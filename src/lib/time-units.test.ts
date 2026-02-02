import { describe, expect, test } from "bun:test";
import {
  convertToTimeUnit,
  formatTimeUnitValue,
  formatTimeUnitValueCompact,
  TIME_UNIT_LABELS,
  TIME_UNIT_SUFFIXES,
} from "./time-units";

describe("TIME_UNIT_LABELS", () => {
  test("has all expected labels", () => {
    expect(TIME_UNIT_LABELS.daily).toBe("Daily");
    expect(TIME_UNIT_LABELS.hourly).toBe("Hourly");
    expect(TIME_UNIT_LABELS.minute).toBe("Minute");
    expect(TIME_UNIT_LABELS.second).toBe("Second");
  });
});

describe("TIME_UNIT_SUFFIXES", () => {
  test("has all expected suffixes", () => {
    expect(TIME_UNIT_SUFFIXES.daily).toBe("d");
    expect(TIME_UNIT_SUFFIXES.hourly).toBe("h");
    expect(TIME_UNIT_SUFFIXES.minute).toBe("m");
    expect(TIME_UNIT_SUFFIXES.second).toBe("s");
  });
});

describe("convertToTimeUnit", () => {
  const hourlyRate = 60; // $60/hour

  test("converts to daily (8 hours)", () => {
    expect(convertToTimeUnit(hourlyRate, "daily")).toBe(480);
  });

  test("returns hourly as-is", () => {
    expect(convertToTimeUnit(hourlyRate, "hourly")).toBe(60);
  });

  test("converts to per-minute", () => {
    expect(convertToTimeUnit(hourlyRate, "minute")).toBe(1);
  });

  test("converts to per-second", () => {
    expect(convertToTimeUnit(hourlyRate, "second")).toBeCloseTo(0.0167, 3);
  });

  test("handles fractional hourly rates", () => {
    expect(convertToTimeUnit(45.5, "daily")).toBe(364);
    expect(convertToTimeUnit(45.5, "minute")).toBeCloseTo(0.758, 2);
  });
});

describe("formatTimeUnitValue", () => {
  test("formats daily as rounded currency", () => {
    expect(formatTimeUnitValue(480.5, "daily")).toBe("$481");
  });

  test("formats hourly as rounded currency", () => {
    expect(formatTimeUnitValue(60.75, "hourly")).toBe("$61");
  });

  test("formats minute with suffix", () => {
    expect(formatTimeUnitValue(1.25, "minute")).toBe("$1.25/m");
  });

  test("formats second with suffix", () => {
    expect(formatTimeUnitValue(0.02, "second")).toBe("$0.02/s");
  });

  test("handles sub-cent values", () => {
    expect(formatTimeUnitValue(0.005, "second")).toBe("$0.005/s");
  });
});

describe("formatTimeUnitValueCompact", () => {
  test("formats daily compactly with suffix", () => {
    expect(formatTimeUnitValueCompact(480, "daily")).toBe("$480/d");
  });

  test("formats hourly compactly with suffix", () => {
    expect(formatTimeUnitValueCompact(60, "hourly")).toBe("$60/h");
  });

  test("formats large daily values with K suffix", () => {
    expect(formatTimeUnitValueCompact(1500, "daily")).toBe("$2K/d");
  });

  test("formats minute same as regular", () => {
    expect(formatTimeUnitValueCompact(1.25, "minute")).toBe("$1.25/m");
  });

  test("formats second same as regular", () => {
    expect(formatTimeUnitValueCompact(0.02, "second")).toBe("$0.02/s");
  });
});
