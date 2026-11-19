import { describe, expect, it } from "vitest";
import { craftVersions, parseCraftVersion } from "./craft-versions";
import { EUR_PER_USD, PRICES } from "./prices";
import type { Ticket } from "./readers";
import type { Segment, SessionMetadata } from "./session-metadata";

const ticket = (key: string): Ticket => ({
  key,
  title: `Feature ${key}`,
  state: "Done",
  stateType: "completed",
  project: "Sample",
  projectUrl: null,
  milestone: null,
  parent: null,
  brief: null,
});

/** A build segment of about `eur` euros of claude-opus-5-5 output tokens. */
const segment = (
  ticketKey: string,
  version: string | null | undefined,
  eur: number,
  over: Partial<Segment> = {},
): Segment => ({
  step: "build",
  ticket: ticketKey,
  started_at: null,
  ended_at: null,
  tokens: {
    "claude-opus-5-5": {
      input_tokens: 0,
      output_tokens: Math.round(
        (eur / EUR_PER_USD / PRICES["claude-opus-5-5"].output) * 1e6,
      ),
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  },
  subagents: [],
  ...(version === undefined ? {} : { craft_version: version }),
  ...over,
});

const session = (segments: Segment[]): SessionMetadata => ({
  repo: "o/r",
  branch: "main",
  session_id: "s1",
  tickets: [],
  segments,
  event: null,
  uploaded_at: "2026-11-01T00:00:00Z",
});

const versionsOf = (segments: Segment[]) => {
  const keys = [...new Set(segments.map((s) => s.ticket!))];
  return craftVersions([session(segments)], keys.map(ticket));
};

describe("parseCraftVersion", () => {
  it.each([
    ["2.9.0", [2, 9, 0]],
    ["2.10.0", [2, 10, 0]],
    ["10.0.0", [10, 0, 0]],
    ["0.0.1", [0, 0, 1]],
  ] as const)("parses %s", (value, parts) => {
    expect(parseCraftVersion(value)).toEqual(parts);
  });

  it.each([
    null,
    undefined,
    "",
    "2.9",
    "v2.9.0",
    "2.9.0-rc.1",
    "2.9.0.1",
    " 2.9.0",
    "a.b.c",
  ])("%j is an unknown version", (value) => {
    expect(parseCraftVersion(value)).toBeNull();
  });
});

describe("craftVersions", () => {
  it("sorts versions newest first by a numeric compare", () => {
    const { rows } = versionsOf([
      segment("A-1", "2.9.0", 1),
      segment("A-2", "2.10.0", 1),
      segment("A-3", "9.9.9", 1),
      segment("A-4", "10.0.0", 1),
      segment("A-5", "2.9.1", 1),
    ]);
    expect(rows.map((row) => row.version)).toEqual([
      "10.0.0",
      "9.9.9",
      "2.10.0",
      "2.9.1",
      "2.9.0",
    ]);
  });

  it("with only unknown versions, has no known row", () => {
    const { rows, largest } = versionsOf([
      segment("A-1", null, 1),
      segment("A-2", undefined, 2),
      segment("A-3", "v2.9.0", 3),
    ]);
    expect(rows.map((row) => row.version)).toEqual([null]);
    expect(rows[0].tickets).toBe(3);
    expect(rows[0].costChange).toBeNull();
    expect(rows[0].timeChange).toBeNull();
    expect(largest).toEqual({ cost: 0, workSeconds: 0 });
  });

  it("with no segments, has no rows", () => {
    expect(craftVersions([], [])).toEqual({
      rows: [],
      largest: { cost: 0, workSeconds: 0 },
    });
  });

  it("an older total of 0 gives no change line", () => {
    const { rows } = versionsOf([
      segment("A-1", "2.9.0", 1, { work_seconds: 60 }),
      segment("A-2", "2.8.0", 0, { work_seconds: 0 }),
    ]);
    expect(rows[0].costChange).toBeNull();
    expect(rows[0].timeChange).toBeNull();
    expect(rows[1].costChange).toEqual({ kind: "first" });
  });

  it("rounds a change of -0.5% to 0 and +0.5% to 1", () => {
    const down = versionsOf([
      segment("A-1", "2.9.0", 1, { work_seconds: 199 }),
      segment("A-2", "2.8.0", 1, { work_seconds: 200 }),
    ]);
    expect(down.rows[0].timeChange).toEqual({
      kind: "change",
      percent: 0,
      vs: "2.8.0",
    });
    expect(
      Object.is((down.rows[0].timeChange as { percent: number }).percent, -0),
    ).toBe(false);
    const up = versionsOf([
      segment("A-1", "2.9.0", 1, { work_seconds: 201 }),
      segment("A-2", "2.8.0", 1, { work_seconds: 200 }),
    ]);
    expect(up.rows[0].timeChange).toEqual({
      kind: "change",
      percent: 1,
      vs: "2.8.0",
    });
  });

  it("compares a total with the nearest older version that has a value for it", () => {
    const { rows } = versionsOf([
      segment("A-1", "2.9.0", 2, { work_seconds: 300 }),
      segment("A-2", "2.8.1", 1),
      segment("A-3", "2.8.0", 1, { work_seconds: 600 }),
    ]);
    expect(rows.map((row) => row.timeChange)).toEqual([
      { kind: "change", percent: -50, vs: "2.8.0" },
      null,
      { kind: "first" },
    ]);
    expect(rows[0].costChange).toEqual({
      kind: "change",
      percent: 100,
      vs: "2.8.1",
    });
  });

  it("sums two segments of one phase of one ticket into one ticket", () => {
    const { rows } = versionsOf([
      segment("A-1", "2.9.0", 1, { work_seconds: 60 }),
      segment("A-1", "2.9.0", 3, { work_seconds: 120 }),
      segment("A-2", "2.9.0", 2, { work_seconds: 600 }),
    ]);
    expect(rows[0].tickets).toBe(2);
    expect(rows[0].cells.build!.cost).toBeCloseTo(3, 4);
    expect(rows[0].cells.build!.workSeconds).toBe(390);
  });

  it("an Unknown version cell larger than every known cell does not change largest", () => {
    const { largest } = versionsOf([
      segment("A-1", "2.9.0", 1, { work_seconds: 60 }),
      segment("A-2", null, 50, { work_seconds: 6000 }),
    ]);
    expect(largest.cost).toBeCloseTo(1, 4);
    expect(largest.workSeconds).toBe(60);
  });
});
