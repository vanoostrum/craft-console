/**
 * The price table (ADR 0006): Anthropic API list prices in US dollars per
 * million tokens, keyed by the model id as it appears in `metadata.json`.
 * Cache writes use the 5-minute rate (1.25 × input). Every session is priced
 * with this table. A price change, or a new model, is a commit.
 */
export type ModelPrice = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  /** The day the prices were read. */
  read: string;
};

export const PRICES: Readonly<Record<string, ModelPrice>> = {
  "claude-fable-5-2": {
    input: 8,
    output: 40,
    cacheWrite: 10,
    cacheRead: 0.2,
    read: "2026-11-18",
  },
  "claude-opus-5-5": {
    input: 4,
    output: 20,
    cacheWrite: 5,
    cacheRead: 0.2,
    read: "2026-11-18",
  },
  "claude-sonnet-5-5": {
    input: 2,
    output: 10,
    cacheWrite: 2.5,
    cacheRead: 0.1,
    read: "2026-11-18",
  },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
    read: "2026-11-18",
  },
};

/** One fixed rate: euros per US dollar, read 2026-11-18. */
export const EUR_PER_USD = 0.93;
