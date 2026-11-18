import { describe, expect, it } from "vitest";
import { consoleNow, parseDataSource, parseMaxPlanEur } from "./console-data";
import { selectReaders } from "./data-source";

describe("parseDataSource", () => {
  it.each([
    [undefined, "fixtures"],
    ["", "fixtures"],
    ["fixtures", "fixtures"],
    ["live", "live"],
  ] as const)("reads %j as %s", (value, source) => {
    expect(parseDataSource(value)).toBe(source);
  });

  it.each(["Live", "fixture", "FIXTURES", " live"])(
    "refuses %j and names the value and the allowed values",
    (value) => {
      expect(() => parseDataSource(value)).toThrow(
        `CONSOLE_DATA="${value}" is not a data source. Use fixtures or live.`,
      );
    },
  );
});

describe("selectReaders", () => {
  it.each([undefined, "", "fixtures"])(
    "gives the fixture readers for %j",
    async (value) => {
      const readers = selectReaders(value);
      const { sessions, unreadable } = await readers.sessions.sessions();
      expect(sessions.length).toBeGreaterThan(0);
      expect(unreadable).toEqual([]);
      const keys = [...new Set(sessions.flatMap((session) => session.tickets))];
      const tickets = await readers.tickets.tickets(keys);
      expect(tickets.length).toBeGreaterThan(0);
      expect(tickets.every((ticket) => keys.includes(ticket.key))).toBe(true);
    },
  );

  it("throws the same message as the parsing for a wrong value", () => {
    expect(() => selectReaders("fixture")).toThrow(
      'CONSOLE_DATA="fixture" is not a data source. Use fixtures or live.',
    );
  });
});

describe("parseMaxPlanEur", () => {
  it.each([
    [undefined, 93],
    ["", 93],
    ["93", 93],
    ["93.50", 93.5],
    ["100", 100],
    ["0.5", 0.5],
  ] as const)("reads %j as %d", (value, eur) => {
    expect(parseMaxPlanEur(value)).toBe(eur);
  });

  it.each([
    "abc",
    "0",
    "0.00",
    "-5",
    " 93",
    "93 ",
    "93,50",
    "1e2",
    "Infinity",
    "€93",
  ])("refuses %j and names the value", (value) => {
    expect(() => parseMaxPlanEur(value)).toThrow(
      `CONSOLE_MAX_PLAN_EUR="${value}" is not a positive number of euros, such as 93 or 93.50.`,
    );
  });
});

describe("consoleNow", () => {
  it("reads CONSOLE_NOW with the fixtures", () => {
    expect(consoleNow("fixtures", "2026-11-22T12:00:00Z").toISOString()).toBe(
      "2026-11-22T12:00:00.000Z",
    );
    expect(
      consoleNow("fixtures", "2026-11-22T13:00:00+01:00").toISOString(),
    ).toBe("2026-11-22T12:00:00.000Z");
  });

  it.each([
    ["fixtures", undefined],
    ["fixtures", ""],
    ["live", "2026-11-22T12:00:00Z"],
  ] as const)("uses the real clock for %s with %j", (source, value) => {
    const before = Date.now();
    const now = consoleNow(source, value).getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it.each([
    "tomorrow",
    "2026-11-22",
    "2026-13-01T00:00:00Z",
    "2026-11-22T12:00:00",
  ])("refuses %j and names the value", (value) => {
    expect(() => consoleNow("fixtures", value)).toThrow(
      `CONSOLE_NOW="${value}" is not an ISO time, such as 2026-11-22T12:00:00Z.`,
    );
  });
});
