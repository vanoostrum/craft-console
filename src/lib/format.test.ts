import { describe, expect, it } from "vitest";
import { formatDuration, formatEuro, formatPlanPrice } from "./format";

describe("formatDuration", () => {
  it.each([
    [0, "0m"],
    [29, "0m"],
    [59 * 60 + 29, "59m"],
    [59 * 60 + 30, "1h00m"],
    [5 * 3600 + 2 * 60, "5h02m"],
    [9 * 3600 + 59 * 60, "9h59m"],
    [9 * 3600 + 59 * 60 + 30, "10h"],
    [10 * 3600, "10h"],
    [10 * 3600 + 59 * 60, "10h"],
    [196 * 3600 + 40 * 60, "196h"],
  ])("formats %i seconds as %s", (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe("formatEuro", () => {
  it.each([
    [0, "€0.00"],
    [0.005, "€0.01"],
    [192.3, "€192.30"],
    [1234.5, "€1,234.50"],
    [1234567.891, "€1,234,567.89"],
  ])("formats %d as %s", (eur, text) => {
    expect(formatEuro(eur)).toBe(text);
  });
});

describe("formatPlanPrice", () => {
  it.each([
    [93, "€93"],
    [93.5, "€93.50"],
    [100.25, "€100.25"],
  ])("formats %d as %s", (eur, text) => {
    expect(formatPlanPrice(eur)).toBe(text);
  });
});
