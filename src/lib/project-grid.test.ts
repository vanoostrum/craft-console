import { describe, expect, it } from "vitest";
import { attributedSegments, type AttributedSegment } from "./attribution";
import { byKey, projectGrid, shadeStep, type GridRow } from "./project-grid";
import type { Ticket } from "./readers";
import type { Segment, SessionMetadata } from "./session-metadata";

const ticket = (key: string, over: Partial<Ticket> = {}): Ticket => ({
  key,
  title: `Feature ${key}`,
  state: "Done",
  stateType: "completed",
  project: "Sample",
  projectUrl: null,
  milestone: null,
  parent: null,
  brief: null,
  ...over,
});

/** A segment of `output` output tokens of claude-opus-5-5: 1M output tokens cost $20. */
const segment = (
  ticketKey: string | null,
  output: number,
  over: Partial<Segment> = {},
): Segment => ({
  step: "build",
  ticket: ticketKey,
  started_at: null,
  ended_at: null,
  tokens: {
    "claude-opus-5-5": {
      input_tokens: 0,
      output_tokens: output,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  },
  subagents: [],
  ...over,
});

const session = (repo: string, segments: Segment[]): SessionMetadata => ({
  repo,
  branch: "main",
  session_id: `s-${repo}-${segments.length}`,
  tickets: [],
  segments,
  event: null,
  uploaded_at: "2026-11-01T00:00:00Z",
});

const attributed = (segments: Segment[]): AttributedSegment[] =>
  attributedSegments([session("o/r", segments)], []);

/** The rows as `<kind> <label or key>`, depth first, indented by level. */
function outline(rows: readonly GridRow[], depth = 0): string[] {
  return rows.flatMap((row) => {
    const pad = "  ".repeat(depth);
    switch (row.kind) {
      case "ticket":
        return [`${pad}${row.ticket.key}`];
      case "noTicket":
        return [`${pad}No ticket`];
      case "single":
        return [`${pad}Single tickets`, ...outline(row.rows, depth + 1)];
      default:
        return [`${pad}${row.label}`, ...outline(row.rows, depth + 1)];
    }
  });
}

describe("projectGrid", () => {
  it("heads a group with a plan ticket that has a parent of its own", () => {
    const tickets = [
      ticket("A-1", { title: "Plan: Outer" }),
      ticket("A-2", { title: "Plan: Inner", parent: "A-1" }),
      ticket("A-3", { parent: "A-2" }),
    ];
    const grid = projectGrid(
      attributed([segment("A-2", 1000), segment("A-3", 1000)]),
      tickets,
    );
    expect(outline(grid.rows)).toEqual(["Plan: Inner", "  A-2", "  A-3"]);
  });

  it("puts a ticket whose parent Linear does not find under Single tickets", () => {
    const grid = projectGrid(attributed([segment("A-3", 1000)]), [
      ticket("A-3", { parent: "A-99" }),
    ]);
    expect(outline(grid.rows)).toEqual(["Single tickets", "  A-3"]);
  });

  it("puts a key that Linear does not know under No ticket", () => {
    const grid = projectGrid(
      attributed([segment("A-404", 1000), segment(null, 1000)]),
      [],
    );
    expect(outline(grid.rows)).toEqual(["No ticket"]);
    expect(grid.rows[0].sums.cost).toBeCloseTo(2 * 0.02 * 0.93, 10);
  });

  it("shows a plan with no plan ticket row when no segment names the plan ticket", () => {
    const grid = projectGrid(attributed([segment("A-2", 1000)]), [
      ticket("A-1", { title: "Plan: P" }),
      ticket("A-2", { parent: "A-1" }),
    ]);
    expect(outline(grid.rows)).toEqual(["Plan: P", "  A-2"]);
  });

  it("shows no milestone rows when the plan's tickets have one milestone and no milestone", () => {
    const grid = projectGrid(
      attributed([segment("A-3", 1000), segment("A-2", 1000)]),
      [
        ticket("A-1", { title: "Plan: P" }),
        ticket("A-2", { parent: "A-1", milestone: "P: One" }),
        ticket("A-3", { parent: "A-1" }),
      ],
    );
    expect(outline(grid.rows)).toEqual(["Plan: P", "  A-2", "  A-3"]);
  });

  it("puts tickets with no milestone before the milestones, and sorts milestones and plans by cost, then label", () => {
    const grid = projectGrid(
      attributed([
        segment("A-1", 1000),
        segment("A-4", 1000),
        segment("A-3", 1000),
        segment("A-5", 1000),
        segment("A-2", 1000),
        segment("B-1", 2000),
        segment("C-1", 2000),
      ]),
      [
        ticket("A-1", { title: "Plan: A" }),
        ticket("A-2", { parent: "A-1", milestone: "A: Zeta" }),
        ticket("A-3", { parent: "A-1", milestone: "A: Alpha" }),
        ticket("A-4", { parent: "A-1" }),
        ticket("A-5", { parent: "A-1" }),
        ticket("B-1", { title: "Plan: C" }),
        ticket("C-1", { title: "Plan: B" }),
      ],
    );
    expect(outline(grid.rows)).toEqual([
      "Plan: A",
      "  A-1",
      "  A-4",
      "  A-5",
      "  A: Alpha",
      "    A-3",
      "  A: Zeta",
      "    A-2",
      "Plan: B",
      "  C-1",
      "Plan: C",
      "  B-1",
    ]);
  });

  it("sorts keys by team, then by number", () => {
    expect(["NAP-100", "CRAFT-2", "NAP-99", "x", "NAP-7"].sort(byKey)).toEqual([
      "CRAFT-2",
      "NAP-7",
      "NAP-99",
      "NAP-100",
      "x",
    ]);
  });

  it("gives null time to a cell and a row with no time data, and time to a cell that has it", () => {
    const grid = projectGrid(
      attributed([
        segment("A-1", 1000),
        segment("A-1", 1000, {
          step: "spec",
          work_seconds: 60,
          wait_seconds: 5,
        }),
      ]),
      [ticket("A-1")],
    );
    const row = (grid.rows[0] as GridRow & { kind: "single" }).rows[0];
    expect(row.sums.cells.build).toEqual({
      cost: expect.any(Number),
      workSeconds: null,
    });
    expect(row.sums.cells.spec?.workSeconds).toBe(60);
    expect(row.sums.cells.plan).toBeNull();
    expect(row.sums.workSeconds).toBe(60);
    expect(row.sums.waitSeconds).toBe(5);
    expect(grid.largest.workSeconds).toBe(60);

    const untimed = projectGrid(attributed([segment("A-1", 1000)]), [
      ticket("A-1"),
    ]);
    expect(untimed.total.workSeconds).toBeNull();
    expect(untimed.total.waitSeconds).toBeNull();
    expect(untimed.largest.workSeconds).toBe(0);
  });
});

describe("attributedSegments", () => {
  const brief = "https://linear.app/example/document/brief-p-0123456789ab";
  const briefSegment = segment(null, 1000, { step: "brainstorm", brief });

  it("moves a brief segment to the plan in the repository with the most of its tickets' segments, the first by name on a tie", () => {
    const tickets = [
      ticket("A-1", { title: "Plan: P", brief }),
      ticket("A-2", { parent: "A-1" }),
      ticket("A-3", { parent: "A-1" }),
    ];
    const moved = attributedSegments(
      [
        session("no-repo", [briefSegment]),
        session("o/b", [segment("A-2", 1)]),
        session("o/a", [segment("A-3", 1)]),
      ],
      tickets,
    );
    expect(moved[0]).toMatchObject({ repo: "o/a", ticket: "A-1" });
  });

  it("prefers the repository of the plan ticket's own segments", () => {
    const moved = attributedSegments(
      [
        session("no-repo", [briefSegment]),
        session("o/a", [segment("A-2", 1), segment("A-2", 1)]),
        session("o/b", [segment("A-1", 1)]),
      ],
      [
        ticket("A-1", { title: "Plan: P", brief }),
        ticket("A-2", { parent: "A-1" }),
      ],
    );
    expect(moved[0]).toMatchObject({ repo: "o/b", ticket: "A-1" });
  });

  it("leaves a brief segment where it ran when its plan has no segments yet", () => {
    const moved = attributedSegments(
      [session("no-repo", [briefSegment])],
      [ticket("A-1", { title: "Plan: P", brief })],
    );
    expect(moved[0]).toMatchObject({ repo: "no-repo", ticket: null });
  });
});

describe("shadeStep", () => {
  it.each([
    [null, 10, null],
    [0, 10, null],
    [5, 0, null],
    [10, 10, 5],
    [0.01, 10, 1],
    [2, 10, 1],
    [2.01, 10, 2],
    [4, 10, 2],
    [6, 10, 3],
    [8, 10, 4],
    [8.01, 10, 5],
  ] as const)("gives %j of %j the step %j", (value, largest, step) => {
    expect(shadeStep(value, largest)).toBe(step);
  });
});
