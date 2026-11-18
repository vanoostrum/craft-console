import { describe, expect, it } from "vitest";
import { phaseOf, segmentCost } from "./cost";
import type { Segment } from "./session-metadata";

const usage = (input: number, output: number, write: number, read: number) => ({
  input_tokens: input,
  output_tokens: output,
  cache_creation_input_tokens: write,
  cache_read_input_tokens: read,
});

const segment = (
  tokens: Segment["tokens"],
  subagents: Segment["tokens"][] = [],
): Segment => ({
  step: "craft:build",
  ticket: "X-1",
  started_at: null,
  ended_at: null,
  tokens,
  subagents: subagents.map((t, i) => ({
    agent_id: `a${i}`,
    role: null,
    started_at: null,
    ended_at: null,
    tokens: t,
  })),
});

describe("segmentCost", () => {
  it("prices each token kind of one model in euros", () => {
    // Opus 5.5: $4 in, $20 out, $5 cache write, $0.20 cache read per million; €0.93 per $.
    const cost = segmentCost(
      segment({ "claude-opus-5-5": usage(1e6, 1e6, 1e6, 1e6) }),
    );
    expect(cost.eur).toBeCloseTo(29.2 * 0.93, 10);
    expect(cost.missing).toEqual([]);
  });

  it("adds several models", () => {
    const cost = segmentCost(
      segment({
        "claude-sonnet-5-5": usage(1e6, 0, 0, 0),
        "claude-haiku-5-5": usage(0, 2e6, 0, 0),
      }),
    );
    expect(cost.eur).toBeCloseTo((2 + 1) * 0.93, 10);
  });

  it("adds the tokens of every subagent", () => {
    const cost = segmentCost(
      segment({ "claude-opus-5-5": usage(0, 0, 0, 1e6) }, [
        { "claude-sonnet-5-5": usage(0, 0, 1e6, 0) },
        { "claude-haiku-5-5": usage(1e6, 0, 0, 0) },
      ]),
    );
    expect(cost.eur).toBeCloseTo((0.2 + 2.5 + 0.1) * 0.93, 10);
  });

  it("leaves out a model that is not in the price table, and names it", () => {
    const cost = segmentCost(
      segment({
        "claude-opus-5-5": usage(1e6, 0, 0, 0),
        "claude-opus-6": usage(1, 0, 0, 0),
      }),
    );
    expect(cost.eur).toBeCloseTo(4 * 0.93, 10);
    expect(cost.missing).toEqual(["claude-opus-6"]);
  });

  it("does not name an unknown model with only zero counts", () => {
    const cost = segmentCost(
      segment({ "<synthetic>": usage(0, 0, 0, 0) }, [
        { "<synthetic>": usage(0, 0, 0, 0) },
      ]),
    );
    expect(cost).toEqual({ eur: 0, missing: [] });
  });

  it("names an unknown model that only a subagent used, once", () => {
    const cost = segmentCost(
      segment({ "claude-opus-5-5": usage(0, 0, 0, 0) }, [
        { "claude-opus-6": usage(0, 0, 0, 5) },
        { "claude-opus-6": usage(0, 3, 0, 0) },
      ]),
    );
    expect(cost).toEqual({ eur: 0, missing: ["claude-opus-6"] });
  });

  it("prices by the token keys, not the model field", () => {
    const cost = segmentCost({
      ...segment({ "claude-haiku-5-5": usage(1e6, 0, 0, 0) }),
      model: "claude-opus-5-5",
    });
    expect(cost.eur).toBeCloseTo(0.1 * 0.93, 10);
  });
});

describe("phaseOf", () => {
  it.each([
    ["craft:plan", "plan"],
    ["craft:spec", "spec"],
    ["craft:design", "design"],
    ["craft:build", "build"],
    ["craft:review", "review"],
    ["craft:merge", "merge"],
    ["craft:brainstorm", "other"],
    ["craft:setup", "other"],
    ["craft:next", "other"],
    ["plan", "other"],
    ["craft:unknown", "other"],
    [null, "other"],
  ] as const)("gives %j the phase %s", (step, phase) => {
    expect(phaseOf(step)).toBe(phase);
  });
});
