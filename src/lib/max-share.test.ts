import { describe, expect, it } from "vitest";
import { maxShare, monthOf, segmentMonth } from "./max-share";

const segment = (started_at: string | null, ended_at: string | null) => ({
  started_at,
  ended_at,
});
const UPLOADED = "2026-12-03T10:00:00.000000+00:00";

describe("monthOf", () => {
  it.each([
    ["2026-10-31T22:59:59Z", "2026-10"],
    ["2026-10-31T23:00:00Z", "2026-11"],
    ["2026-10-31T23:30:00Z", "2026-11"],
    // Summer time: the last day of September ends at 22:00 UTC.
    ["2026-09-30T21:59:59Z", "2026-09"],
    ["2026-09-30T22:00:00Z", "2026-10"],
    ["2026-12-31T23:00:00Z", "2027-01"],
    ["2026-11-22T12:00:00.123456+00:00", "2026-11"],
  ])("puts %s in %s in Europe/Amsterdam", (time, month) => {
    expect(monthOf(new Date(time))).toBe(month);
  });
});

describe("segmentMonth", () => {
  it("uses ended_at first", () => {
    expect(
      segmentMonth(
        segment("2026-10-31T22:00:00Z", "2026-10-31T23:30:00Z"),
        UPLOADED,
      ),
    ).toBe("2026-11");
  });

  it("falls back to started_at", () => {
    expect(segmentMonth(segment("2026-10-15T10:00:00Z", null), UPLOADED)).toBe(
      "2026-10",
    );
  });

  it("falls back to the session's uploaded_at", () => {
    expect(segmentMonth(segment(null, null), UPLOADED)).toBe("2026-12");
  });
});

describe("maxShare", () => {
  it("splits the price by month cost", () => {
    expect(
      maxShare([{ monthCost: 30 }, { monthCost: 10 }, { monthCost: 60 }], 93),
    ).toEqual([27.9, 9.3, 55.8]);
  });

  it("gives null to a project with no cost this month", () => {
    expect(maxShare([{ monthCost: 5 }, { monthCost: 0 }], 93)).toEqual([
      93,
      null,
    ]);
  });

  it("gives null to every project when the month has no cost", () => {
    expect(maxShare([{ monthCost: 0 }, { monthCost: 0 }], 93)).toEqual([
      null,
      null,
    ]);
    expect(maxShare([], 93)).toEqual([]);
  });

  it("leaves the rounding to the page", () => {
    const shares = maxShare([{ monthCost: 1 }, { monthCost: 2 }], 100);
    expect(shares[0]).toBeCloseTo(33.333, 3);
    expect(shares[1]).toBeCloseTo(66.667, 3);
  });
});
