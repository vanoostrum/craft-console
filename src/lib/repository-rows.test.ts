import { describe, expect, it } from "vitest";
import type { Ticket } from "./readers";
import { repositoryRows } from "./repository-rows";
import type { SessionMetadata } from "./session-metadata";

let next = 0;
const session = (repo: string, tickets: string[]): SessionMetadata => ({
  repo,
  branch: "",
  session_id: `s-${++next}`,
  tickets,
  segments: [],
  event: "Stop",
  uploaded_at: "2026-11-01T10:00:00.000000+00:00",
});

const ticket = (key: string): Ticket => ({
  key,
  title: key,
  state: "Todo",
  stateType: "unstarted",
  project: null,
  milestone: null,
  parent: null,
});

describe("repositoryRows", () => {
  it("counts the sessions of each repository", () => {
    const rows = repositoryRows(
      [session("a/x", []), session("a/x", []), session("a/y", [])],
      [],
    );
    expect(rows).toEqual([
      { repository: "a/x", sessions: 2, tickets: 0 },
      { repository: "a/y", sessions: 1, tickets: 0 },
    ]);
  });

  it("counts a ticket that several sessions of one repository name once", () => {
    const rows = repositoryRows(
      [session("a/x", ["K-1"]), session("a/x", ["K-1", "K-2"])],
      [ticket("K-1"), ticket("K-2")],
    );
    expect(rows).toEqual([{ repository: "a/x", sessions: 2, tickets: 2 }]);
  });

  it("does not count a key that the ticket reader does not find, but counts its session", () => {
    const rows = repositoryRows(
      [session("a/x", ["K-1"]), session("a/x", ["TYPO-9"])],
      [ticket("K-1")],
    );
    expect(rows).toEqual([{ repository: "a/x", sessions: 2, tickets: 1 }]);
  });

  it("counts a ticket named by two repositories in each", () => {
    const rows = repositoryRows(
      [session("a/x", ["K-1"]), session("a/y", ["K-1"])],
      [ticket("K-1")],
    );
    expect(rows).toEqual([
      { repository: "a/x", sessions: 1, tickets: 1 },
      { repository: "a/y", sessions: 1, tickets: 1 },
    ]);
  });

  it("sorts by session count, highest first, then by name", () => {
    const rows = repositoryRows(
      [
        session("b/b", []),
        session("a/a", []),
        session("c/c", []),
        session("c/c", []),
      ],
      [],
    );
    expect(rows.map((row) => row.repository)).toEqual(["c/c", "a/a", "b/b"]);
  });

  it("puts no-repo sessions in one last row, even with the most sessions", () => {
    const rows = repositoryRows(
      [
        session("no-repo", ["K-1"]),
        session("no-repo", []),
        session("no-repo", ["K-1"]),
        session("a/x", []),
      ],
      [ticket("K-1")],
    );
    expect(rows).toEqual([
      { repository: "a/x", sessions: 1, tickets: 0 },
      { repository: null, sessions: 3, tickets: 1 },
    ]);
  });

  it("shows no No repository row when no session is outside a repository", () => {
    const rows = repositoryRows([session("a/x", [])], []);
    expect(rows.some((row) => row.repository === null)).toBe(false);
  });

  it("has no rows without sessions", () => {
    expect(repositoryRows([], [])).toEqual([]);
  });
});
