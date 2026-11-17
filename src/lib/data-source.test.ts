import { describe, expect, it } from "vitest";
import { LIVE_NOT_AVAILABLE, parseDataSource } from "./console-data";
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
      const sessions = await readers.sessions.sessions();
      expect(sessions.length).toBeGreaterThan(0);
      const keys = [...new Set(sessions.flatMap((session) => session.tickets))];
      const tickets = await readers.tickets.tickets(keys);
      expect(tickets.length).toBeGreaterThan(0);
      expect(tickets.every((ticket) => keys.includes(ticket.key))).toBe(true);
    },
  );

  it("throws that live data comes with the Live data ticket, and gives no readers", () => {
    expect(LIVE_NOT_AVAILABLE).toBe(
      "CONSOLE_DATA=live is not available yet: live data comes with the Live data ticket (CRAFT-63).",
    );
    expect(() => selectReaders("live")).toThrow(LIVE_NOT_AVAILABLE);
  });

  it("throws the same message as the parsing for a wrong value", () => {
    expect(() => selectReaders("fixture")).toThrow(
      'CONSOLE_DATA="fixture" is not a data source. Use fixtures or live.',
    );
  });
});
