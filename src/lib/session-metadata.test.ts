import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionMetadata } from "./session-metadata";

const dir = join(__dirname, "..", "fixtures", "sessions");
const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
const read = (name: string) =>
  JSON.parse(readFileSync(join(dir, name), "utf8"));

const valid = {
  repo: "vanoostrum/craft",
  branch: "craft-1/example",
  session_id: "s-1",
  tickets: ["CRAFT-1"],
  segments: [
    {
      step: null,
      ticket: "CRAFT-1",
      started_at: null,
      ended_at: null,
      tokens: {
        "claude-x": {
          input_tokens: 1,
          output_tokens: 2,
          cache_creation_input_tokens: 3,
          cache_read_input_tokens: 4,
        },
      },
      subagents: [
        {
          agent_id: "a1",
          role: null,
          started_at: "2026-11-01T10:00:00.000Z",
          ended_at: "2026-11-01T10:01:00.000Z",
          tokens: {},
        },
      ],
    },
  ],
  event: "Stop",
  uploaded_at: "2026-11-01T10:02:00.123456+00:00",
};

describe("SessionMetadata", () => {
  it("has fixture files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("parses fixture %s", (name) => {
    expect(SessionMetadata.safeParse(read(name)).success).toBe(true);
  });

  it("has a fixture with an extra field, and parses it", () => {
    const extra = files.map(read).filter((data) => "moved_from" in data);
    expect(extra.length).toBeGreaterThan(0);
    for (const data of extra)
      expect(SessionMetadata.safeParse(data).success).toBe(true);
  });

  it("accepts extra fields at every level", () => {
    const data = structuredClone(valid) as Record<string, unknown> &
      typeof valid;
    Object.assign(data, { moved_from: "old/path" });
    Object.assign(data.segments[0], { extra: 1 });
    Object.assign(data.segments[0].subagents[0], { extra: true });
    expect(SessionMetadata.safeParse(data).success).toBe(true);
  });

  it("parses a valid file", () => {
    expect(SessionMetadata.safeParse(valid).success).toBe(true);
  });

  it("fails on a missing field", () => {
    const data: Partial<typeof valid> = structuredClone(valid);
    delete data.repo;
    expect(SessionMetadata.safeParse(data).success).toBe(false);
  });

  it("fails on a field of the wrong type", () => {
    expect(
      SessionMetadata.safeParse({ ...valid, tickets: "CRAFT-1" }).success,
    ).toBe(false);
  });

  it("fails on a time that is not an ISO time", () => {
    expect(
      SessionMetadata.safeParse({ ...valid, uploaded_at: "yesterday" }).success,
    ).toBe(false);
  });

  it("fails on a token count that is not a number", () => {
    const data = structuredClone(valid);
    (
      data.segments[0].tokens["claude-x"] as Record<string, unknown>
    ).input_tokens = "1";
    expect(SessionMetadata.safeParse(data).success).toBe(false);
  });
});

describe("the session fixtures", () => {
  const sessions = files.map((name) => SessionMetadata.parse(read(name)));
  const segments = sessions.flatMap((session) => session.segments);

  it("cover the shapes that real files hold", () => {
    expect(sessions.some((s) => s.segments[0]?.step === null)).toBe(true);
    expect(sessions.some((s) => s.segments[0]?.step !== null)).toBe(true);
    expect(segments.some((segment) => segment.ticket === null)).toBe(true);
    expect(segments.some((segment) => segment.subagents.length > 0)).toBe(true);
    expect(
      sessions.every((s) =>
        s.segments.slice(1).every((segment) => segment.step !== null),
      ),
    ).toBe(true);
  });

  it("use both time forms", () => {
    for (const session of sessions) {
      expect(session.uploaded_at).toMatch(/\.\d{6}\+00:00$/);
      for (const segment of session.segments) {
        for (const time of [segment.started_at, segment.ended_at]) {
          if (time !== null) expect(time).toMatch(/Z$/);
        }
      }
    }
  });
});
