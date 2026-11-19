import { EUR_PER_USD, PRICES } from "./prices";
import type { Segment, Tokens } from "./session-metadata";

export const PHASES = [
  "plan",
  "spec",
  "design",
  "build",
  "review",
  "merge",
  "other",
] as const;

export type Phase = (typeof PHASES)[number];

const STEP_PHASES: Readonly<Record<string, Phase>> = {
  plan: "plan",
  spec: "spec",
  design: "design",
  build: "build",
  review: "review",
  merge: "merge",
};

/** The phase of a segment's stored step, such as `build` (GLOSSARY). Every other step, and null, is `other`. */
export function phaseOf(step: string | null): Phase {
  return step !== null && Object.hasOwn(STEP_PHASES, step)
    ? STEP_PHASES[step]
    : "other";
}

/** A cost in euros, and the models with tokens that the price table cannot price. */
export type Cost = { eur: number; missing: string[] };

function tokensCost(tokens: Tokens, missing: Set<string>): number {
  let usd = 0;
  for (const [model, u] of Object.entries(tokens)) {
    const price = PRICES[model];
    if (!price) {
      const used =
        u.input_tokens ||
        u.output_tokens ||
        u.cache_creation_input_tokens ||
        u.cache_read_input_tokens;
      if (used) missing.add(model);
      continue;
    }
    usd +=
      (u.input_tokens * price.input +
        u.output_tokens * price.output +
        u.cache_creation_input_tokens * price.cacheWrite +
        u.cache_read_input_tokens * price.cacheRead) /
      1e6;
  }
  return usd * EUR_PER_USD;
}

/**
 * The cost of a segment: its own tokens and the tokens of every subagent, at the
 * price table. craft's upload does not count subagent tokens in `segment.tokens`.
 */
export function segmentCost(segment: Segment): Cost {
  const missing = new Set<string>();
  let eur = tokensCost(segment.tokens, missing);
  for (const subagent of segment.subagents)
    eur += tokensCost(subagent.tokens, missing);
  return { eur, missing: [...missing].sort() };
}
